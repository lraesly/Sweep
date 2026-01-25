from datetime import datetime, timezone
import hashlib
import uuid

from google.cloud import firestore

from app.rules.models import Rule, MagicFolder, AutoLearnFolder, MatchType, ActionType, UserSettings, MagicFolderSettings
from app.config import get_settings

settings = get_settings()
db = firestore.AsyncClient()


class RuleEngine:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.rules_collection = db.collection("users").document(user_id).collection("rules")
        self.magic_folders_collection = db.collection("users").document(user_id).collection("magic_folders")
        self.auto_learn_collection = db.collection("users").document(user_id).collection("auto_learn_folders")
        self.folder_settings_collection = db.collection("users").document(user_id).collection("folder_settings")
        self.stats_doc = db.collection("users").document(user_id)

    async def find_matching_rule(self, sender_email: str) -> Rule | None:
        """Find the first rule that matches the sender email."""
        sender_email = sender_email.lower()

        # Get all enabled rules
        rules_query = self.rules_collection.where("enabled", "==", True)
        rules_docs = rules_query.stream()

        async for doc in rules_docs:
            rule_data = doc.to_dict()
            rule_data["id"] = doc.id
            rule = Rule(**rule_data)

            if self._matches_pattern(sender_email, rule.email_pattern, rule.match_type):
                return rule

        return None

    async def get_rule_by_pattern(self, email_pattern: str) -> Rule | None:
        """Find a rule by exact email pattern match (for deduplication)."""
        email_pattern = email_pattern.lower()
        rules_query = self.rules_collection.where("email_pattern", "==", email_pattern)
        async for doc in rules_query.stream():
            rule_data = doc.to_dict()
            rule_data["id"] = doc.id
            return Rule(**rule_data)
        return None

    def _matches_pattern(
        self,
        sender: str,
        pattern: str,
        match_type: MatchType
    ) -> bool:
        """Check if sender matches the pattern based on match type."""
        sender = sender.lower()
        pattern = pattern.lower()

        if match_type == MatchType.EXACT:
            return sender == pattern
        elif match_type == MatchType.DOMAIN:
            # Pattern is like "@example.com" or "example.com"
            domain = pattern.lstrip("@")
            return sender.endswith(f"@{domain}")
        elif match_type == MatchType.CONTAINS:
            return pattern in sender

        return False

    async def create_rule(
        self,
        email_pattern: str,
        match_type: str,
        action: str,
        destination_label_id: str | None,
        destination_label_name: str | None,
        use_deterministic_id: bool = False
    ) -> Rule:
        """Create a new rule.

        If use_deterministic_id is True, uses a hash of the email pattern as the
        document ID to prevent duplicates from race conditions.
        """
        email_pattern_lower = email_pattern.lower()

        if use_deterministic_id:
            # Create deterministic ID from email pattern to prevent duplicates
            rule_id = hashlib.sha256(email_pattern_lower.encode()).hexdigest()[:20]
        else:
            rule_id = str(uuid.uuid4())

        now = datetime.now(timezone.utc)

        rule_data = {
            "email_pattern": email_pattern_lower,
            "match_type": match_type,
            "action": action,
            "destination_label_id": destination_label_id,
            "destination_label_name": destination_label_name,
            "created_at": now,
            "enabled": True,
            "times_applied": 0
        }

        # Use set() which will create or overwrite - prevents duplicates with deterministic ID
        await self.rules_collection.document(rule_id).set(rule_data)

        rule_data["id"] = rule_id
        return Rule(**rule_data)

    async def list_rules(self) -> list[Rule]:
        """Get all rules for the user."""
        rules = []
        async for doc in self.rules_collection.stream():
            rule_data = doc.to_dict()
            rule_data["id"] = doc.id
            rules.append(Rule(**rule_data))
        return rules

    async def get_rule(self, rule_id: str) -> Rule | None:
        """Get a specific rule."""
        doc = await self.rules_collection.document(rule_id).get()
        if doc.exists:
            rule_data = doc.to_dict()
            rule_data["id"] = doc.id
            return Rule(**rule_data)
        return None

    async def update_rule(self, rule_id: str, updates: dict) -> Rule:
        """Update a rule."""
        # Remove None values and id from updates
        updates = {k: v for k, v in updates.items() if v is not None and k != "id"}

        await self.rules_collection.document(rule_id).update(updates)
        return await self.get_rule(rule_id)

    async def delete_rule(self, rule_id: str) -> None:
        """Delete a rule."""
        await self.rules_collection.document(rule_id).delete()

    async def delete_rules_by_destination(self, label_id: str) -> int:
        """Delete all rules that point to a specific destination label. Returns count deleted."""
        deleted_count = 0
        async for doc in self.rules_collection.where("destination_label_id", "==", label_id).stream():
            await doc.reference.delete()
            deleted_count += 1
        return deleted_count

    async def increment_rule_counter(self, rule_id: str) -> None:
        """Increment the times_applied counter for a rule."""
        await self.rules_collection.document(rule_id).update({
            "times_applied": firestore.Increment(1)
        })

    async def increment_emails_processed(self) -> None:
        """Increment the total emails processed counter."""
        await self.stats_doc.set({
            "emails_processed": firestore.Increment(1),
            "last_processed_at": datetime.now(timezone.utc)
        }, merge=True)

    # Magic Folders

    async def get_magic_folders(self) -> list[MagicFolder]:
        """Get all magic folders for the user."""
        folders = []
        async for doc in self.magic_folders_collection.stream():
            folder_data = doc.to_dict()
            folders.append(MagicFolder(**folder_data))
        return folders

    async def get_magic_folder_ids(self) -> set[str]:
        """Get set of magic folder label IDs."""
        folders = await self.get_magic_folders()
        return {f.label_id for f in folders}

    async def register_magic_folder(
        self,
        label_id: str,
        label_name: str,
        destination_label_id: str | None,
        destination_label_name: str | None,
        action: ActionType
    ) -> MagicFolder:
        """Register a magic folder."""
        folder_data = {
            "label_id": label_id,
            "label_name": label_name,
            "destination_label_id": destination_label_id,
            "destination_label_name": destination_label_name,
            "action": action.value if isinstance(action, ActionType) else action
        }

        await self.magic_folders_collection.document(label_id).set(folder_data)
        return MagicFolder(**folder_data)

    async def delete_magic_folder(self, label_id: str) -> None:
        """Delete a magic folder registration."""
        await self.magic_folders_collection.document(label_id).delete()

    # Auto-Learn Folders

    async def get_auto_learn_folders(self) -> list[AutoLearnFolder]:
        """Get all auto-learn folders for the user."""
        folders = []
        async for doc in self.auto_learn_collection.stream():
            folder_data = doc.to_dict()
            folders.append(AutoLearnFolder(**folder_data))
        return folders

    async def get_auto_learn_folder_ids(self) -> set[str]:
        """Get set of auto-learn folder label IDs."""
        folders = await self.get_auto_learn_folders()
        return {f.label_id for f in folders if f.enabled}

    async def enable_auto_learn(self, label_id: str, label_name: str) -> AutoLearnFolder:
        """Enable auto-learning for an existing folder."""
        folder_data = {
            "label_id": label_id,
            "label_name": label_name,
            "enabled": True
        }
        await self.auto_learn_collection.document(label_id).set(folder_data)
        return AutoLearnFolder(**folder_data)

    async def disable_auto_learn(self, label_id: str) -> None:
        """Disable auto-learning for a folder."""
        await self.auto_learn_collection.document(label_id).delete()

    async def toggle_auto_learn(self, label_id: str, enabled: bool) -> AutoLearnFolder | None:
        """Toggle auto-learning for a folder."""
        doc = await self.auto_learn_collection.document(label_id).get()
        if doc.exists:
            await self.auto_learn_collection.document(label_id).update({"enabled": enabled})
            data = doc.to_dict()
            data["enabled"] = enabled
            return AutoLearnFolder(**data)
        return None

    # Stats

    async def get_stats(self) -> dict:
        """Get processing statistics."""
        doc = await self.stats_doc.get()
        if doc.exists:
            data = doc.to_dict()
            return {
                "emails_processed": data.get("emails_processed", 0),
                "rules_count": len(await self.list_rules()),
                "last_processed_at": data.get("last_processed_at")
            }
        return {
            "emails_processed": 0,
            "rules_count": 0,
            "last_processed_at": None
        }

    # User Settings

    async def get_user_settings(self) -> UserSettings:
        """Get user settings, returning defaults if not set."""
        doc = await self.stats_doc.get()
        if doc.exists:
            data = doc.to_dict()
            settings_data = data.get("settings", {})
            return UserSettings(
                blackhole_enabled=settings_data.get("blackhole_enabled", True),
                blackhole_delete_days=settings_data.get("blackhole_delete_days", 7)
            )
        return UserSettings()

    async def update_user_settings(self, updates: dict) -> UserSettings:
        """Update user settings with provided values."""
        # Filter out None values
        updates = {k: v for k, v in updates.items() if v is not None}

        if updates:
            # Prefix keys with "settings." for nested update
            prefixed_updates = {f"settings.{k}": v for k, v in updates.items()}
            await self.stats_doc.set(prefixed_updates, merge=True)

        return await self.get_user_settings()

    # Magic Folder Settings (per-folder archive settings)

    async def get_folder_settings(self, label_id: str, label_name: str = "") -> MagicFolderSettings:
        """Get settings for a specific magic folder, returning defaults if not set."""
        doc = await self.folder_settings_collection.document(label_id).get()
        if doc.exists:
            data = doc.to_dict()
            # Handle migration from old field names (archive_read_days -> archive_read_value)
            if "archive_read_days" in data and "archive_read_value" not in data:
                data["archive_read_value"] = data.pop("archive_read_days")
                data["archive_read_unit"] = "days"
            if "archive_unread_days" in data and "archive_unread_value" not in data:
                data["archive_unread_value"] = data.pop("archive_unread_days")
                data["archive_unread_unit"] = "days"
            return MagicFolderSettings(**data)
        return MagicFolderSettings(label_id=label_id, label_name=label_name)

    async def update_folder_settings(self, label_id: str, label_name: str, updates: dict) -> MagicFolderSettings:
        """Update settings for a specific magic folder."""
        # Filter out None values
        updates = {k: v for k, v in updates.items() if v is not None}

        # Always include label_id and label_name
        updates["label_id"] = label_id
        updates["label_name"] = label_name

        await self.folder_settings_collection.document(label_id).set(updates, merge=True)
        return await self.get_folder_settings(label_id, label_name)

    async def get_all_folder_settings(self) -> list[MagicFolderSettings]:
        """Get settings for all magic folders that have archive settings configured."""
        settings_list = []
        async for doc in self.folder_settings_collection.stream():
            data = doc.to_dict()
            # Handle migration from old field names
            if "archive_read_days" in data and "archive_read_value" not in data:
                data["archive_read_value"] = data.pop("archive_read_days")
                data["archive_read_unit"] = "days"
            if "archive_unread_days" in data and "archive_unread_value" not in data:
                data["archive_unread_value"] = data.pop("archive_unread_days")
                data["archive_unread_unit"] = "days"
            settings_list.append(MagicFolderSettings(**data))
        return settings_list

    async def delete_folder_settings(self, label_id: str) -> None:
        """Delete settings for a magic folder."""
        await self.folder_settings_collection.document(label_id).delete()
