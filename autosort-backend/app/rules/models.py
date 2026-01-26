from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class MatchType(str, Enum):
    EXACT = "exact"
    DOMAIN = "domain"
    CONTAINS = "contains"


class ActionType(str, Enum):
    MOVE = "move"
    BLOCK_DELETE = "block_delete"


class Rule(BaseModel):
    id: str
    email_pattern: str
    match_type: MatchType
    action: ActionType
    destination_label_id: Optional[str] = None
    destination_label_name: Optional[str] = None
    created_at: datetime
    enabled: bool = True
    times_applied: int = 0


class RuleCreate(BaseModel):
    email_pattern: str
    match_type: MatchType = MatchType.EXACT
    action: ActionType = ActionType.MOVE
    destination_label_id: Optional[str] = None
    destination_label_name: Optional[str] = None


class RuleUpdate(BaseModel):
    email_pattern: Optional[str] = None
    match_type: Optional[MatchType] = None
    action: Optional[ActionType] = None
    destination_label_id: Optional[str] = None
    destination_label_name: Optional[str] = None
    enabled: Optional[bool] = None


class MagicFolder(BaseModel):
    label_id: str
    label_name: str
    destination_label_id: Optional[str]
    destination_label_name: Optional[str]
    action: ActionType


class AutoLearnFolder(BaseModel):
    """An existing Gmail folder enabled for auto-learning."""
    label_id: str
    label_name: str
    enabled: bool = True


class ProcessingStats(BaseModel):
    emails_processed: int = 0
    rules_count: int = 0
    last_processed_at: Optional[datetime] = None


class UserSettings(BaseModel):
    """User-configurable settings for the app."""
    blackhole_enabled: bool = True
    blackhole_delete_days: int = 7
    blackhole_label_id: Optional[str] = None  # Gmail label ID for blackhole folder


class UserSettingsUpdate(BaseModel):
    """Partial update for user settings."""
    blackhole_enabled: Optional[bool] = None
    blackhole_delete_days: Optional[int] = None
    blackhole_label_id: Optional[str] = None


class TimeUnit(str, Enum):
    HOURS = "hours"
    DAYS = "days"


class MagicFolderSettings(BaseModel):
    """Per-folder settings for auto-archiving."""
    label_id: str
    label_name: str
    archive_read_enabled: bool = False
    archive_read_value: int = 30
    archive_read_unit: TimeUnit = TimeUnit.DAYS
    archive_unread_enabled: bool = False
    archive_unread_value: int = 60
    archive_unread_unit: TimeUnit = TimeUnit.DAYS


class MagicFolderSettingsUpdate(BaseModel):
    """Partial update for magic folder settings."""
    archive_read_enabled: Optional[bool] = None
    archive_read_value: Optional[int] = None
    archive_read_unit: Optional[TimeUnit] = None
    archive_unread_enabled: Optional[bool] = None
    archive_unread_value: Optional[int] = None
    archive_unread_unit: Optional[TimeUnit] = None
