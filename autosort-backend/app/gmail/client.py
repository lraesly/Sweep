from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import re

from app.config import get_settings

settings = get_settings()


class GmailClient:
    def __init__(self, credentials: Credentials):
        self.service = build("gmail", "v1", credentials=credentials)
        self.user_id = "me"

    async def start_watch(self) -> dict:
        """
        Subscribe to Gmail push notifications.
        Must be called on initial setup AND renewed every 7 days.
        Returns: {"historyId": "...", "expiration": "..."}
        """
        request_body = {
            "labelIds": ["INBOX"],
            "topicName": settings.pubsub_topic,
            "labelFilterBehavior": "INCLUDE"
        }
        return self.service.users().watch(
            userId=self.user_id,
            body=request_body
        ).execute()

    async def stop_watch(self) -> None:
        """Unsubscribe from push notifications."""
        self.service.users().stop(userId=self.user_id).execute()

    async def get_history(
        self,
        start_history_id: str,
        history_types: list[str] = None
    ) -> dict:
        """
        Get mailbox changes since a history ID.
        history_types: ["messageAdded", "labelAdded", "labelRemoved", "messageDeleted"]
        """
        params = {
            "userId": self.user_id,
            "startHistoryId": start_history_id,
        }
        if history_types:
            params["historyTypes"] = history_types

        try:
            all_history = []
            page_token = None

            while True:
                if page_token:
                    params["pageToken"] = page_token

                response = self.service.users().history().list(**params).execute()
                all_history.extend(response.get("history", []))

                page_token = response.get("nextPageToken")
                if not page_token:
                    break

            result = {"history": all_history}
            # Include the latest historyId from the response
            if "historyId" in response:
                result["historyId"] = response["historyId"]
            return result
        except HttpError as e:
            if e.resp.status == 404:
                # History ID too old, need to do a full sync
                return {"history": []}
            raise

    async def get_message_metadata(
        self,
        message_id: str,
        headers: list[str] = None
    ) -> dict:
        """
        Get message metadata (not full content).
        headers: List of headers to include, e.g., ["From", "Subject"]
        """
        params = {
            "userId": self.user_id,
            "id": message_id,
            "format": "metadata",
        }
        if headers:
            params["metadataHeaders"] = headers

        return self.service.users().messages().get(**params).execute()

    async def modify_labels(
        self,
        message_id: str,
        add_labels: list[str] = None,
        remove_labels: list[str] = None
    ) -> dict:
        """Add or remove labels from a message."""
        body = {}
        if add_labels:
            body["addLabelIds"] = add_labels
        if remove_labels:
            body["removeLabelIds"] = remove_labels

        return self.service.users().messages().modify(
            userId=self.user_id,
            id=message_id,
            body=body
        ).execute()

    async def trash_message(self, message_id: str) -> dict:
        """Move message to trash."""
        return self.service.users().messages().trash(
            userId=self.user_id,
            id=message_id
        ).execute()

    async def list_labels(self) -> list[dict]:
        """Get all labels for the user."""
        response = self.service.users().labels().list(
            userId=self.user_id
        ).execute()
        return response.get("labels", [])

    async def create_label(self, name: str) -> dict:
        """Create a new label."""
        label_body = {
            "name": name,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show"
        }
        return self.service.users().labels().create(
            userId=self.user_id,
            body=label_body
        ).execute()

    async def delete_label(self, label_id: str) -> None:
        """Delete a label."""
        self.service.users().labels().delete(
            userId=self.user_id,
            id=label_id
        ).execute()

    async def search_messages(self, query: str, max_results: int = 500) -> list[str]:
        """
        Search for messages matching a query.
        Returns list of message IDs.
        """
        message_ids = []
        page_token = None

        while True:
            params = {
                "userId": self.user_id,
                "q": query,
                "maxResults": min(max_results - len(message_ids), 100)
            }
            if page_token:
                params["pageToken"] = page_token

            response = self.service.users().messages().list(**params).execute()
            messages = response.get("messages", [])
            message_ids.extend([m["id"] for m in messages])

            if len(message_ids) >= max_results:
                break

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return message_ids

    async def get_messages_by_label(self, label_id: str, read_only: bool = False, unread_only: bool = False, max_results: int = 500) -> list[str]:
        """
        Get messages with a specific label, optionally filtered by read status.
        More reliable than search queries for labels with special characters.
        Returns list of message IDs.
        """
        message_ids = []
        page_token = None

        # Build label filter - must have the specified label
        label_ids = [label_id]
        if unread_only:
            label_ids.append("UNREAD")

        while True:
            params = {
                "userId": self.user_id,
                "labelIds": label_ids,
                "maxResults": min(max_results - len(message_ids), 100)
            }
            if page_token:
                params["pageToken"] = page_token

            response = self.service.users().messages().list(**params).execute()
            messages = response.get("messages", [])

            if read_only:
                # Filter for read messages (those without UNREAD label)
                for msg in messages:
                    # Get message to check labels
                    msg_detail = self.service.users().messages().get(
                        userId=self.user_id,
                        id=msg["id"],
                        format="minimal"
                    ).execute()
                    if "UNREAD" not in msg_detail.get("labelIds", []):
                        message_ids.append(msg["id"])
            else:
                message_ids.extend([m["id"] for m in messages])

            if len(message_ids) >= max_results:
                break

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return message_ids[:max_results]

    async def delete_message(self, message_id: str) -> None:
        """Permanently delete a message (not trash)."""
        self.service.users().messages().delete(
            userId=self.user_id,
            id=message_id
        ).execute()

    async def batch_delete_messages(self, message_ids: list[str]) -> None:
        """Permanently delete multiple messages."""
        if not message_ids:
            return
        self.service.users().messages().batchDelete(
            userId=self.user_id,
            body={"ids": message_ids}
        ).execute()

    async def batch_modify_labels(
        self,
        message_ids: list[str],
        add_labels: list[str] = None,
        remove_labels: list[str] = None
    ) -> None:
        """Modify labels on multiple messages at once."""
        if not message_ids:
            return
        body = {"ids": message_ids}
        if add_labels:
            body["addLabelIds"] = add_labels
        if remove_labels:
            body["removeLabelIds"] = remove_labels

        self.service.users().messages().batchModify(
            userId=self.user_id,
            body=body
        ).execute()


def extract_email_address(message: dict) -> str | None:
    """Extract email address from message metadata."""
    headers = message.get("payload", {}).get("headers", [])
    for header in headers:
        if header.get("name", "").lower() == "from":
            value = header.get("value", "")
            # Extract email from "Name <email@example.com>" format
            match = re.search(r'<([^>]+)>', value)
            if match:
                return match.group(1).lower()
            # Or just the plain email
            if "@" in value:
                return value.strip().lower()
    return None
