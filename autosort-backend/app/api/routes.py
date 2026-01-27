from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_user, User
from app.rules.engine import RuleEngine
from app.rules.models import Rule, RuleCreate, RuleUpdate, MagicFolder, AutoLearnFolder, UserSettings, UserSettingsUpdate, MagicFolderSettings, MagicFolderSettingsUpdate
from pydantic import BaseModel
from app.gmail.client import GmailClient
from app.config import get_settings

router = APIRouter()
settings = get_settings()


# ============ RULES ============

@router.get("/rules", response_model=list[Rule])
async def list_rules(user: User = Depends(get_current_user)):
    """Get all rules for the authenticated user."""
    engine = RuleEngine(user.id)
    rules = await engine.list_rules()

    # Sync label names with Gmail (handles renames)
    gmail = GmailClient(user.credentials)
    labels = await gmail.list_labels()
    label_map = {l["id"]: l["name"] for l in labels}

    # Update any rules with stale label names
    for rule in rules:
        if rule.destination_label_id and rule.destination_label_id in label_map:
            current_name = label_map[rule.destination_label_id]
            if rule.destination_label_name != current_name:
                await engine.update_rule(rule.id, {"destination_label_name": current_name})
                rule.destination_label_name = current_name

    return rules


@router.post("/rules", response_model=Rule)
async def create_rule(
    rule: RuleCreate,
    user: User = Depends(get_current_user)
):
    """Manually create a rule."""
    engine = RuleEngine(user.id)
    return await engine.create_rule(
        email_pattern=rule.email_pattern,
        match_type=rule.match_type,
        action=rule.action,
        destination_label_id=rule.destination_label_id,
        destination_label_name=rule.destination_label_name
    )


@router.get("/rules/{rule_id}", response_model=Rule)
async def get_rule(
    rule_id: str,
    user: User = Depends(get_current_user)
):
    """Get a specific rule."""
    engine = RuleEngine(user.id)
    rule = await engine.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/rules/{rule_id}", response_model=Rule)
async def update_rule(
    rule_id: str,
    update: RuleUpdate,
    user: User = Depends(get_current_user)
):
    """Update a rule."""
    engine = RuleEngine(user.id)
    rule = await engine.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return await engine.update_rule(rule_id, update.model_dump(exclude_unset=True))


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a rule."""
    engine = RuleEngine(user.id)
    rule = await engine.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await engine.delete_rule(rule_id)
    return {"status": "deleted", "id": rule_id}


# ============ LABELS ============

@router.get("/labels")
async def list_labels(user: User = Depends(get_current_user)):
    """Get user's Gmail labels."""
    gmail = GmailClient(user.credentials)
    labels = await gmail.list_labels()

    # Filter to user labels (not system labels)
    return [
        {"id": l["id"], "name": l["name"], "type": l.get("type", "user")}
        for l in labels
    ]


class CreateMagicFoldersRequest(BaseModel):
    folders: list[str]  # e.g., ["Newsletters", "Shopping", "Receipts"]


@router.post("/magic-folders/create")
async def create_magic_folders(
    request: CreateMagicFoldersRequest,
    user: User = Depends(get_current_user)
):
    """
    Create magic folders (with @ prefix) in user's Gmail.
    Used during onboarding to set up initial folders.
    """
    gmail = GmailClient(user.credentials)

    # Get existing labels
    existing_labels = await gmail.list_labels()
    existing_names = {l["name"] for l in existing_labels}

    created = []
    skipped = []

    for folder_name in request.folders:
        # Ensure @ prefix
        magic_name = folder_name if folder_name.startswith("@") else f"@{folder_name}"

        if magic_name in existing_names:
            skipped.append(magic_name)
            continue

        try:
            label = await gmail.create_label(magic_name)
            created.append({"id": label["id"], "name": label["name"]})
        except Exception as e:
            skipped.append({"name": magic_name, "error": str(e)})

    return {
        "created": created,
        "skipped": skipped,
        "message": f"Created {len(created)} magic folders"
    }


@router.get("/magic-folders/list")
async def list_magic_folders_simple(user: User = Depends(get_current_user)):
    """Get all magic folders (labels starting with @)."""
    gmail = GmailClient(user.credentials)
    labels = await gmail.list_labels()

    return [
        {"id": l["id"], "name": l["name"]}
        for l in labels
        if l["name"].startswith("@")
    ]


@router.delete("/magic-folders/{label_id}")
async def delete_magic_folder(
    label_id: str,
    user: User = Depends(get_current_user)
):
    """
    Delete a magic folder and all rules associated with it.
    This removes the Gmail label and deletes any rules that sort to this folder.
    """
    gmail = GmailClient(user.credentials)
    engine = RuleEngine(user.id)

    # Get label info before deleting
    labels = await gmail.list_labels()
    label_info = next((l for l in labels if l["id"] == label_id), None)

    if not label_info:
        raise HTTPException(status_code=404, detail="Label not found")

    # Delete all rules that point to this folder
    rules_deleted = await engine.delete_rules_by_destination(label_id)

    # Delete the Gmail label
    try:
        await gmail.delete_label(label_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete label: {e}")

    return {
        "status": "deleted",
        "label_id": label_id,
        "label_name": label_info.get("name"),
        "rules_deleted": rules_deleted
    }


@router.get("/magic-folders", response_model=list[MagicFolder])
async def list_magic_folders(user: User = Depends(get_current_user)):
    """Get the magic folders and their destinations."""
    engine = RuleEngine(user.id)
    return await engine.get_magic_folders()


@router.post("/magic-folders/setup")
async def setup_magic_folders(user: User = Depends(get_current_user)):
    """Create magic folders in user's Gmail account."""
    gmail = GmailClient(user.credentials)
    engine = RuleEngine(user.id)

    # Get user's existing labels
    labels = await gmail.list_labels()
    user_labels = [l for l in labels if l.get("type") == "user"]

    created = []

    # Create magic folder for each user label
    for label in user_labels:
        magic_name = f"{settings.magic_folder_prefix}/Move to {label['name']}"

        # Check if magic folder already exists
        existing = [l for l in labels if l["name"] == magic_name]
        if existing:
            continue

        try:
            magic_label = await gmail.create_label(magic_name)
            await engine.register_magic_folder(
                label_id=magic_label["id"],
                label_name=magic_label["name"],
                destination_label_id=label["id"],
                destination_label_name=label["name"],
                action="move"
            )
            created.append(magic_label)
        except Exception as e:
            print(f"Failed to create magic folder for {label['name']}: {e}")

    # Create block & delete folder
    block_name = f"{settings.magic_folder_prefix}/Block & Delete"
    existing_block = [l for l in labels if l["name"] == block_name]

    if not existing_block:
        try:
            block_label = await gmail.create_label(block_name)
            await engine.register_magic_folder(
                label_id=block_label["id"],
                label_name=block_label["name"],
                destination_label_id=None,
                destination_label_name=None,
                action="block_delete"
            )
            created.append(block_label)
        except Exception as e:
            print(f"Failed to create block folder: {e}")

    return {
        "created": created,
        "message": f"Created {len(created)} magic folders"
    }


# ============ MAGIC FOLDER SETTINGS ============

@router.get("/magic-folders/{label_id}/settings", response_model=MagicFolderSettings)
async def get_folder_settings(
    label_id: str,
    user: User = Depends(get_current_user)
):
    """Get archive settings for a specific magic folder."""
    gmail = GmailClient(user.credentials)
    engine = RuleEngine(user.id)

    # Get label name
    labels = await gmail.list_labels()
    label_info = next((l for l in labels if l["id"] == label_id), None)
    label_name = label_info.get("name", "") if label_info else ""

    return await engine.get_folder_settings(label_id, label_name)


@router.put("/magic-folders/{label_id}/settings", response_model=MagicFolderSettings)
async def update_folder_settings(
    label_id: str,
    updates: MagicFolderSettingsUpdate,
    user: User = Depends(get_current_user)
):
    """Update archive settings for a specific magic folder."""
    gmail = GmailClient(user.credentials)
    engine = RuleEngine(user.id)

    # Get label name
    labels = await gmail.list_labels()
    label_info = next((l for l in labels if l["id"] == label_id), None)

    if not label_info:
        raise HTTPException(status_code=404, detail="Label not found")

    return await engine.update_folder_settings(
        label_id,
        label_info.get("name", ""),
        updates.model_dump(exclude_unset=True)
    )


# ============ AUTO-LEARN FOLDERS ============

class AutoLearnRequest(BaseModel):
    label_id: str
    label_name: str


@router.get("/auto-learn")
async def list_auto_learn_folders(user: User = Depends(get_current_user)):
    """Get all folders with auto-learn enabled."""
    engine = RuleEngine(user.id)
    return await engine.get_auto_learn_folders()


@router.get("/labels/with-auto-learn")
async def list_labels_with_auto_learn_status(user: User = Depends(get_current_user)):
    """Get all Gmail labels with their auto-learn status."""
    gmail = GmailClient(user.credentials)
    engine = RuleEngine(user.id)

    labels = await gmail.list_labels()
    auto_learn_folders = await engine.get_auto_learn_folders()
    auto_learn_ids = {f.label_id for f in auto_learn_folders}

    # Return user labels with auto-learn status
    return [
        {
            "id": l["id"],
            "name": l["name"],
            "type": l.get("type", "user"),
            "auto_learn": l["id"] in auto_learn_ids
        }
        for l in labels
        if l.get("type") == "user"  # Only user-created labels
    ]


@router.post("/auto-learn/enable", response_model=AutoLearnFolder)
async def enable_auto_learn(
    request: AutoLearnRequest,
    user: User = Depends(get_current_user)
):
    """Enable auto-learning for an existing folder."""
    engine = RuleEngine(user.id)
    return await engine.enable_auto_learn(request.label_id, request.label_name)


@router.post("/auto-learn/disable/{label_id}")
async def disable_auto_learn(
    label_id: str,
    user: User = Depends(get_current_user)
):
    """Disable auto-learning for a folder."""
    engine = RuleEngine(user.id)
    await engine.disable_auto_learn(label_id)
    return {"status": "disabled", "label_id": label_id}


@router.post("/auto-learn/toggle/{label_id}")
async def toggle_auto_learn(
    label_id: str,
    enabled: bool,
    user: User = Depends(get_current_user)
):
    """Toggle auto-learning for a folder."""
    engine = RuleEngine(user.id)
    result = await engine.toggle_auto_learn(label_id, enabled)
    if not result:
        raise HTTPException(status_code=404, detail="Auto-learn folder not found")
    return result


# ============ STATS ============

@router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    """Get processing statistics."""
    engine = RuleEngine(user.id)
    return await engine.get_stats()


# ============ SETTINGS ============

@router.get("/settings", response_model=UserSettings)
async def get_settings(user: User = Depends(get_current_user)):
    """Get user settings."""
    engine = RuleEngine(user.id)
    return await engine.get_user_settings()


@router.put("/settings", response_model=UserSettings)
async def update_settings(
    updates: UserSettingsUpdate,
    user: User = Depends(get_current_user)
):
    """Update user settings."""
    engine = RuleEngine(user.id)
    return await engine.update_user_settings(updates.model_dump(exclude_unset=True))


# ============ WATCH ============

@router.get("/watch/status")
async def get_watch_status(user: User = Depends(get_current_user)):
    """Get the current watch status for the user."""
    from google.cloud import firestore
    import time

    db = firestore.AsyncClient(project=settings.project_id)
    doc = await db.collection("users").document(user.id).get()

    if doc.exists:
        data = doc.to_dict()
        expiration = data.get("watch_expiration")
        if expiration:
            # Check if watch is still active (expiration is in milliseconds)
            is_active = int(expiration) > int(time.time() * 1000)
            return {
                "watching": is_active,
                "expiration": expiration
            }

    return {"watching": False, "expiration": None}


@router.post("/watch/start")
async def start_watch(user: User = Depends(get_current_user)):
    """Start watching user's Gmail for changes."""
    from app.auth.tokens import update_history_id, get_last_history_id
    from google.cloud import firestore

    gmail = GmailClient(user.credentials)
    result = await gmail.start_watch()

    # Store the initial history ID so we have a baseline for processing
    history_id = result.get("historyId")
    if history_id:
        # Only update if we don't already have one (preserve existing baseline)
        existing = await get_last_history_id(user.id)
        if not existing:
            await update_history_id(user.id, history_id)

    # Store watch expiration
    expiration = result.get("expiration")
    if expiration:
        db = firestore.AsyncClient(project=settings.project_id)
        await db.collection("users").document(user.id).set(
            {"watch_expiration": expiration},
            merge=True
        )

    return {
        "status": "watching",
        "expiration": expiration,
        "history_id": history_id
    }


@router.post("/watch/stop")
async def stop_watch(user: User = Depends(get_current_user)):
    """Stop watching user's Gmail."""
    from google.cloud import firestore

    gmail = GmailClient(user.credentials)
    await gmail.stop_watch()

    # Clear watch expiration
    db = firestore.AsyncClient(project=settings.project_id)
    await db.collection("users").document(user.id).set(
        {"watch_expiration": None},
        merge=True
    )

    return {"status": "stopped"}


@router.post("/watch/renew")
async def renew_watch(user: User = Depends(get_current_user)):
    """Renew the Gmail watch (call before expiration)."""
    from google.cloud import firestore

    gmail = GmailClient(user.credentials)
    # Stop existing watch first
    try:
        await gmail.stop_watch()
    except Exception:
        pass
    # Start new watch
    result = await gmail.start_watch()

    # Store watch expiration
    expiration = result.get("expiration")
    if expiration:
        db = firestore.AsyncClient(project=settings.project_id)
        await db.collection("users").document(user.id).set(
            {"watch_expiration": expiration},
            merge=True
        )

    return {
        "status": "renewed",
        "expiration": result.get("expiration")
    }


@router.post("/watch/renew-all")
async def renew_all_watches():
    """
    Internal endpoint to renew watches for all users.
    Called by Cloud Scheduler to keep watches active.
    """
    import logging
    from google.cloud import firestore
    from app.auth.tokens import get_user_credentials

    logger = logging.getLogger(__name__)
    db = firestore.AsyncClient(project=settings.project_id)

    renewed = []
    failed = []

    # Get all users from Firestore
    users_ref = db.collection("users")
    async for doc in users_ref.stream():
        user_id = doc.id  # Use document ID for consistency with subcollections
        user_data = doc.to_dict()
        user_email = user_data.get("email", user_id)

        try:
            credentials = await get_user_credentials(user_id)
            if not credentials:
                logger.warning(f"No credentials for {user_email}")
                failed.append({"email": user_email, "error": "No credentials"})
                continue

            gmail = GmailClient(credentials)

            # Stop existing watch
            try:
                await gmail.stop_watch()
            except Exception:
                pass

            # Start new watch
            result = await gmail.start_watch()
            renewed.append({
                "email": user_email,
                "expiration": result.get("expiration")
            })
            logger.info(f"Renewed watch for {user_email}")

        except Exception as e:
            logger.error(f"Failed to renew watch for {user_email}: {e}")
            failed.append({"email": user_email, "error": str(e)})

    return {
        "renewed": len(renewed),
        "failed": len(failed),
        "details": {"renewed": renewed, "failed": failed}
    }


# ============ CLEANUP ============

@router.post("/cleanup/blackhole")
async def cleanup_blackhole():
    """
    Internal endpoint to delete old emails from @Blackhole folders.
    Called by Cloud Scheduler daily.
    Deletes emails older than user's configured blackhole_delete_days.
    """
    import logging
    from google.cloud import firestore
    from app.auth.tokens import get_user_credentials

    logger = logging.getLogger(__name__)
    db = firestore.AsyncClient(project=settings.project_id)

    cleaned = []
    failed = []

    # Get all users from Firestore
    users_ref = db.collection("users")
    async for doc in users_ref.stream():
        user_id = doc.id  # Use document ID for consistency with subcollections
        user_data = doc.to_dict()
        user_email = user_data.get("email", user_id)

        try:
            # Get user settings
            engine = RuleEngine(user_id)
            user_settings = await engine.get_user_settings()

            # Skip if blackhole is disabled
            if not user_settings.blackhole_enabled:
                logger.info(f"Blackhole disabled for {user_email}, skipping")
                continue

            credentials = await get_user_credentials(user_id)
            if not credentials:
                logger.warning(f"No credentials for {user_email}")
                failed.append({"email": user_email, "error": "No credentials"})
                continue

            gmail = GmailClient(credentials)

            # Get all labels
            labels = await gmail.list_labels()
            label_map = {l["id"]: l for l in labels}

            # Get blackhole label - prefer stored ID, fall back to name search
            blackhole_label = None
            if user_settings.blackhole_label_id:
                blackhole_label = label_map.get(user_settings.blackhole_label_id)

            # Fall back to name search if ID not stored or label not found
            if not blackhole_label:
                blackhole_label = next(
                    (l for l in labels if l["name"] == "@Blackhole"),
                    None
                )
                # Store the ID for future use
                if blackhole_label:
                    await engine.set_blackhole_label_id(blackhole_label["id"])
                    logger.info(f"Stored blackhole label ID for {user_email}")

            if not blackhole_label:
                logger.info(f"No blackhole folder for {user_email}")
                continue

            # Search for emails older than configured days
            delete_days = user_settings.blackhole_delete_days
            query = f'label:"{blackhole_label["name"]}" older_than:{delete_days}d'
            old_messages = await gmail.search_messages(query)

            if old_messages:
                await gmail.batch_delete_messages(old_messages)
                logger.info(f"Deleted {len(old_messages)} old emails from @Blackhole for {user_email}")
                cleaned.append({
                    "email": user_email,
                    "deleted": len(old_messages)
                })
            else:
                logger.info(f"No old emails to delete for {user_email}")

        except Exception as e:
            logger.error(f"Failed to cleanup blackhole for {user_email}: {e}")
            failed.append({"email": user_email, "error": str(e)})

    return {
        "cleaned": len(cleaned),
        "failed": len(failed),
        "details": {"cleaned": cleaned, "failed": failed}
    }


@router.post("/cleanup/archive")
async def cleanup_archive():
    """
    Internal endpoint to auto-archive old emails from magic folders.
    Called by Cloud Scheduler daily.
    Archives emails based on per-folder settings for read and unread emails.
    """
    import logging
    from google.cloud import firestore
    from app.auth.tokens import get_user_credentials

    logger = logging.getLogger(__name__)
    db = firestore.AsyncClient(project=settings.project_id)

    processed = []
    failed = []

    # Get all users from Firestore
    users_ref = db.collection("users")
    async for doc in users_ref.stream():
        user_id = doc.id  # Use document ID for consistency with subcollections
        user_data = doc.to_dict()
        user_email = user_data.get("email", user_id)

        try:
            credentials = await get_user_credentials(user_id)
            if not credentials:
                logger.warning(f"No credentials for {user_email}")
                failed.append({"email": user_email, "error": "No credentials"})
                continue

            gmail = GmailClient(credentials)
            engine = RuleEngine(user_id)

            # Get all folder settings for this user
            folder_settings_list = await engine.get_all_folder_settings()
            logger.info(f"User {user_email} has {len(folder_settings_list)} folder settings")

            if not folder_settings_list:
                logger.info(f"No folder settings for {user_email}")
                continue

            # Get fresh label names from Gmail
            labels = await gmail.list_labels()
            label_map = {l["id"]: l["name"] for l in labels}

            user_archived = {"email": user_email, "folders": []}

            for folder_settings in folder_settings_list:
                # Use fresh label name from Gmail
                label_name = label_map.get(folder_settings.label_id, folder_settings.label_name)
                logger.info(f"Processing folder {label_name}: archive_read={folder_settings.archive_read_enabled}, archive_unread={folder_settings.archive_unread_enabled}")
                folder_result = {
                    "label_id": folder_settings.label_id,
                    "label_name": label_name,
                    "read_archived": 0,
                    "unread_archived": 0
                }

                # Archive read emails if enabled (no time restriction - archive immediately when read)
                if folder_settings.archive_read_enabled:
                    logger.info(f"Getting read messages from {label_name} (label_id: {folder_settings.label_id})")
                    read_messages = await gmail.get_messages_by_label(folder_settings.label_id, read_only=True)
                    logger.info(f"Found {len(read_messages)} read messages in {label_name}")

                    if read_messages:
                        await gmail.batch_modify_labels(
                            read_messages,
                            remove_labels=[folder_settings.label_id]
                        )
                        folder_result["read_archived"] = len(read_messages)
                        logger.info(f"Archived {len(read_messages)} read emails from {label_name} for {user_email}")

                # Archive unread emails if enabled (and mark as read)
                if folder_settings.archive_unread_enabled:
                    unit_suffix = "h" if folder_settings.archive_unread_unit == "hours" else "d"
                    query = f'label:"{label_name}" older_than:{folder_settings.archive_unread_value}{unit_suffix} is:unread'
                    unread_messages = await gmail.search_messages(query)

                    if unread_messages:
                        await gmail.batch_modify_labels(
                            unread_messages,
                            remove_labels=[folder_settings.label_id, "UNREAD"]
                        )
                        folder_result["unread_archived"] = len(unread_messages)
                        logger.info(f"Archived {len(unread_messages)} unread emails from {label_name} for {user_email}")

                if folder_result["read_archived"] > 0 or folder_result["unread_archived"] > 0:
                    user_archived["folders"].append(folder_result)

            if user_archived["folders"]:
                processed.append(user_archived)

        except Exception as e:
            logger.error(f"Failed to process archive for {user_email}: {e}")
            failed.append({"email": user_email, "error": str(e)})

    return {
        "processed": len(processed),
        "failed": len(failed),
        "details": {"processed": processed, "failed": failed}
    }


@router.post("/magic-folders/{label_id}/cleanup")
async def cleanup_magic_folder(
    label_id: str,
    user: User = Depends(get_current_user)
):
    """
    Manually trigger cleanup for a specific magic folder.
    - Archives ALL read emails immediately (regardless of time settings)
    - Archives unread emails older than the configured unread time setting
    """
    import logging
    logger = logging.getLogger(__name__)

    user_email = user.id
    credentials = user.credentials

    gmail = GmailClient(credentials)
    engine = RuleEngine(user_email)

    # Get folder settings
    folder_settings = await engine.get_folder_settings(label_id)

    # Get the label name from Gmail
    labels = await gmail.list_labels()
    label = next((l for l in labels if l["id"] == label_id), None)
    if not label:
        raise HTTPException(status_code=404, detail="Folder not found")

    label_name = label["name"]
    result = {
        "label_id": label_id,
        "label_name": label_name,
        "read_archived": 0,
        "unread_archived": 0
    }

    # Archive ALL read emails (no time restriction)
    if folder_settings.archive_read_enabled:
        query = f'label:"{label_name}" is:read'
        read_messages = await gmail.search_messages(query)

        if read_messages:
            await gmail.batch_modify_labels(
                read_messages,
                remove_labels=[label_id]
            )
            result["read_archived"] = len(read_messages)
            logger.info(f"Manually archived {len(read_messages)} read emails from {label_name}")

    # Archive unread emails older than configured time
    if folder_settings.archive_unread_enabled:
        unit_suffix = "h" if folder_settings.archive_unread_unit == "hours" else "d"
        query = f'label:"{label_name}" older_than:{folder_settings.archive_unread_value}{unit_suffix} is:unread'
        unread_messages = await gmail.search_messages(query)

        if unread_messages:
            await gmail.batch_modify_labels(
                unread_messages,
                remove_labels=[label_id, "UNREAD"]
            )
            result["unread_archived"] = len(unread_messages)
            logger.info(f"Manually archived {len(unread_messages)} unread emails from {label_name}")

    return result
