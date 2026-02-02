import base64
import json
import logging
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from google.oauth2.credentials import Credentials

from app.gmail.client import GmailClient, extract_email_address
from app.rules.engine import RuleEngine
from app.rules.models import ActionType
from app.auth.tokens import get_user_credentials, update_history_id, get_last_history_id
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.post("/gmail")
async def handle_gmail_push(request: Request, background_tasks: BackgroundTasks):
    """
    Endpoint: POST /webhooks/gmail

    Gmail sends notifications for ANY mailbox change.
    We need to:
    1. Detect NEW emails → apply existing rules
    2. Detect LABEL ADDITIONS to magic folders → create new rules
    """
    logger.info("Received Gmail push notification")

    try:
        envelope = await request.json()
        logger.info(f"Envelope: {envelope}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Decode the Pub/Sub message
    try:
        message_data = base64.b64decode(
            envelope["message"]["data"]
        ).decode("utf-8")
        notification = json.loads(message_data)
        logger.info(f"Notification: {notification}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Pub/Sub message: {e}")

    user_email = notification.get("emailAddress")
    history_id = notification.get("historyId")

    logger.info(f"User: {user_email}, History ID: {history_id}")

    if not user_email or not history_id:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Process in background to return quickly to Pub/Sub
    background_tasks.add_task(
        process_gmail_notification,
        user_email,
        history_id
    )

    return {"status": "accepted"}


async def process_gmail_notification(user_email: str, history_id: str):
    """Background task to process Gmail changes."""
    logger.info(f"Processing notification for {user_email}, history_id: {history_id}")

    # Get user credentials from Firestore
    credentials = await get_user_credentials(user_email)
    if not credentials:
        logger.warning(f"No credentials for user: {user_email}")
        return

    gmail = GmailClient(credentials)
    rule_engine = RuleEngine(user_email)

    # Get last known history ID
    last_history_id = await get_last_history_id(user_email)
    logger.info(f"Last history ID: {last_history_id}")
    if not last_history_id:
        last_history_id = history_id

    # Fetch history since last known historyId
    history = await gmail.get_history(
        start_history_id=last_history_id,
        history_types=["messageAdded", "labelAdded"]
    )
    logger.info(f"History records: {len(history.get('history', []))}")

    for record in history.get("history", []):
        # Handle new messages → apply existing rules
        for msg_added in record.get("messagesAdded", []):
            message_id = msg_added["message"]["id"]
            logger.info(f"Processing new message: {message_id}")
            await process_new_email(gmail, rule_engine, message_id)

        # Handle label additions → detect magic folder drops
        for label_added in record.get("labelsAdded", []):
            message_id = label_added["message"]["id"]
            added_labels = label_added.get("labelIds", [])
            logger.info(f"Processing label change: {message_id}, labels: {added_labels}")
            await process_label_change(
                gmail, rule_engine, message_id, added_labels
            )

    # Update stored historyId for next notification
    await update_history_id(user_email, history_id)
    logger.info(f"Updated history ID to: {history_id}")


async def process_new_email(
    gmail: GmailClient,
    rule_engine: RuleEngine,
    message_id: str
):
    """Apply existing rules to a newly arrived email."""

    try:
        # Fetch message metadata (From header only - minimal API call)
        message = await gmail.get_message_metadata(
            message_id,
            headers=["From"]
        )

        sender = extract_email_address(message)
        logger.info(f"Message {message_id} from: {sender}")
        if not sender:
            return

        current_labels = message.get("labelIds", [])
        logger.info(f"Current labels: {current_labels}")

        # Only process if it's in INBOX (not already sorted)
        if "INBOX" not in current_labels:
            logger.info("Message not in INBOX, skipping")
            return

        # Check if email is already in an auto-learn folder (user is organizing)
        auto_learn_ids = await rule_engine.get_auto_learn_folder_ids()
        if any(label in auto_learn_ids for label in current_labels):
            logger.info("Message in auto-learn folder, skipping")
            return

        # Find matching rule
        rule = await rule_engine.find_matching_rule(sender)
        logger.info(f"Matching rule: {rule}")

        if rule and rule.enabled:
            logger.info(f"Applying rule: {rule.action} -> {rule.destination_label_name}")
            if rule.action == ActionType.MOVE:
                remove_labels = ["INBOX"]
                # Mark as read if rule has mark_as_read enabled or destination is blackhole
                blackhole_label_id = await rule_engine.get_blackhole_label_id()
                if rule.mark_as_read or rule.destination_label_id == blackhole_label_id:
                    remove_labels.append("UNREAD")
                    logger.info("Marking as read")

                await gmail.modify_labels(
                    message_id,
                    add_labels=[rule.destination_label_id],
                    remove_labels=remove_labels
                )
                logger.info(f"Moved message to {rule.destination_label_name}")
            elif rule.action == ActionType.READ_ARCHIVE:
                await gmail.modify_labels(
                    message_id,
                    remove_labels=["INBOX", "UNREAD"]
                )
                logger.info("Marked as read and archived")
            elif rule.action == ActionType.BLOCK_DELETE:
                await gmail.modify_labels(
                    message_id,
                    remove_labels=["UNREAD"]
                )
                await gmail.trash_message(message_id)
                logger.info("Marked as read and trashed message")

            # Update stats
            await rule_engine.increment_rule_counter(rule.id)
            await rule_engine.increment_emails_processed()
        else:
            logger.info("No matching rule found")

    except Exception as e:
        logger.error(f"Error processing new email {message_id}: {e}")


async def process_label_change(
    gmail: GmailClient,
    rule_engine: RuleEngine,
    message_id: str,
    added_labels: list[str]
):
    """
    Detect when user drags email to a magic folder (starts with @).
    Create a rule so future emails from that sender go to the same folder.
    No opt-in required - any @folder learns automatically.
    """

    try:
        # Get all labels to map IDs to names
        all_labels = await gmail.list_labels()
        label_map = {l["id"]: l["name"] for l in all_labels}

        # Get stored blackhole label ID
        blackhole_label_id = await rule_engine.get_blackhole_label_id()

        for label_id in added_labels:
            label_name = label_map.get(label_id, "")

            # Only process magic folders (start with @)
            if not label_name.startswith("@"):
                continue

            logger.info(f"Magic folder detected: {label_name}")

            # Auto-detect and store blackhole folder ID if not set
            if label_name == "@Blackhole" and blackhole_label_id != label_id:
                await rule_engine.set_blackhole_label_id(label_id)
                blackhole_label_id = label_id
                logger.info(f"Stored blackhole label ID: {label_id}")

            # Get the sender from this message
            message = await gmail.get_message_metadata(
                message_id,
                headers=["From"]
            )
            sender = extract_email_address(message)

            if not sender:
                logger.warning("Could not extract sender from message")
                return

            logger.info(f"Creating rule: {sender} -> {label_name}")

            # Check if rule already exists for this exact sender (prevents duplicates)
            existing_rule = await rule_engine.get_rule_by_pattern(sender)
            if existing_rule:
                # Rule exists - update it to point to new folder
                if existing_rule.destination_label_id != label_id:
                    await rule_engine.update_rule(existing_rule.id, {
                        "destination_label_id": label_id,
                        "destination_label_name": label_name,
                        "action": "move"
                    })
                    logger.info(f"Updated existing rule for {sender}")
            else:
                # Create new rule with deterministic ID to prevent duplicates
                await rule_engine.create_rule(
                    email_pattern=sender,
                    match_type="exact",
                    action="move",
                    destination_label_id=label_id,
                    destination_label_name=label_name,
                    use_deterministic_id=True
                )
                logger.info(f"Created new rule: {sender} -> {label_name}")

            # Email stays in the folder where user dragged it
            # Just remove from INBOX if present
            current_labels = message.get("labelIds", [])
            remove_labels = []
            if "INBOX" in current_labels:
                remove_labels.append("INBOX")

            # If moved to blackhole folder, also mark as read
            if label_id == blackhole_label_id:
                remove_labels.append("UNREAD")
                logger.info("Blackhole folder - marking as read")

            if remove_labels:
                await gmail.modify_labels(
                    message_id,
                    remove_labels=remove_labels
                )

            break  # Only process first magic folder match

    except Exception as e:
        logger.error(f"Error processing label change for {message_id}: {e}")
