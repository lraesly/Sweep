# AutoSort - Email Sorting Application

## Complete Technical Specification

**Version**: 1.0  
**Date**: January 24, 2026  
**Author**: Developed with Claude

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Backend Specification (Google Cloud)](#3-backend-specification)
4. [Frontend Specification (Tauri + React)](#4-frontend-specification)
5. [Data Models](#5-data-models)
6. [Authentication Flow](#6-authentication-flow)
7. [Setup & Deployment Guide](#7-setup--deployment-guide)
8. [Claude Code Session Prompts](#8-claude-code-session-prompts)

---

## 1. Project Overview

### 1.1 Purpose

AutoSort is an email management application that automatically sorts incoming Gmail emails based on user-defined rules. It uses a "magic folders" approach inspired by SaneBox, where dragging an email to a special folder automatically creates a sorting rule for that sender.

### 1.2 Key Features

- **Magic Folders**: Drag emails to special `@AutoSort/*` folders in any email client (Apple Mail, Gmail web, Outlook) to create rules automatically
- **Real-time Processing**: Gmail push notifications trigger immediate sorting of new emails
- **Rule Management**: Desktop app to view, edit, enable/disable, and delete rules
- **Cross-Platform**: Mac, Windows, and Linux support via Tauri
- **Local Caching**: Rules cached locally for offline viewing and fast UI
- **Statistics**: Track emails processed, rules triggered, and processing history

### 1.3 How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ANY EMAIL CLIENT                                │
│          (Apple Mail, Gmail Web, Outlook, Mobile Apps)              │
│                                                                      │
│   User drags email ──────► @AutoSort/Move to Work                   │
│                            @AutoSort/Move to Shopping                │
│                            @AutoSort/Block & Delete                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Gmail syncs the label change
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GMAIL (Google Servers)                       │
│                                                                      │
│   Push notification sent via Pub/Sub ───────────────────────────────►│
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTOSORT BACKEND (Cloud Run)                     │
│                                                                      │
│   1. Detects email moved to @AutoSort folder                        │
│   2. Extracts sender address                                        │
│   3. Creates rule: "sender@example.com → Work folder"               │
│   4. Moves email to actual destination                              │
│   5. Future emails from sender sorted automatically                 │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ REST API
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTOSORT DESKTOP APP (Tauri)                     │
│                                                                      │
│   • View all rules                                                  │
│   • Edit rules (change destination, enable/disable)                 │
│   • Delete rules                                                    │
│   • View processing statistics                                      │
│   • Manual rule creation (as backup)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture

### 2.1 Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Backend Runtime** | Python 3.11+ | Excellent Gmail API SDK |
| **Backend Framework** | FastAPI | Async support, automatic OpenAPI docs |
| **Database** | Firestore | Serverless, real-time sync, free tier |
| **Hosting** | Cloud Run | Scales to zero, handles Pub/Sub triggers |
| **Push Notifications** | Cloud Pub/Sub | Gmail's required notification mechanism |
| **Secrets** | Secret Manager | Secure credential storage |
| **Desktop Framework** | Tauri 2 | Cross-platform, small bundle size |
| **Desktop Frontend** | React 19 | Component-based UI |
| **Build Tool** | Vite 7 | Fast development server |
| **Styling** | Tailwind CSS 4 | Utility-first, consistent with Chops |
| **Icons** | Lucide React | Consistent with Chops |

### 2.2 System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GOOGLE CLOUD                                 │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Cloud Run   │◄───│   Pub/Sub    │◄───│  Gmail API   │          │
│  │  (Backend)   │    │   Topic      │    │  Push        │          │
│  └──────┬───────┘    └──────────────┘    └──────────────┘          │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐    ┌──────────────┐                              │
│  │  Firestore   │    │   Secret     │                              │
│  │  (Rules DB)  │    │   Manager    │                              │
│  └──────────────┘    └──────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS REST API
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DESKTOP APP (Tauri)                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    React Frontend                             │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │  │
│  │  │ Rules   │  │ Stats   │  │Settings │  │Onboard  │         │  │
│  │  │ View    │  │ View    │  │ View    │  │ Flow    │         │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Tauri (Rust)                               │  │
│  │  • OAuth callback listener                                    │  │
│  │  • Keychain token storage                                     │  │
│  │  • File system access                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Specification

### 3.1 Project Structure

```
autosort-backend/
├── main.py                     # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── cloudbuild.yaml             # CI/CD configuration
├── .gcloudignore
│
├── app/
│   ├── __init__.py
│   ├── config.py               # Environment variables, constants
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py           # REST endpoints for desktop app
│   │   ├── auth_routes.py      # OAuth endpoints
│   │   └── dependencies.py     # Auth middleware
│   │
│   ├── gmail/
│   │   ├── __init__.py
│   │   ├── client.py           # Gmail API wrapper
│   │   ├── push.py             # Pub/Sub notification handler
│   │   └── labels.py           # Magic folder management
│   │
│   ├── rules/
│   │   ├── __init__.py
│   │   ├── engine.py           # Rule matching logic
│   │   ├── models.py           # Pydantic models
│   │   └── store.py            # Firestore operations
│   │
│   └── auth/
│       ├── __init__.py
│       ├── oauth.py            # Google OAuth handling
│       └── tokens.py           # Token management
│
└── tests/
    ├── __init__.py
    ├── test_rules.py
    ├── test_gmail.py
    └── test_api.py
```

### 3.2 Configuration

```python
# app/config.py
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Google Cloud
    project_id: str = os.getenv("GOOGLE_CLOUD_PROJECT", "autosort-prod")
    pubsub_topic: str = f"projects/{project_id}/topics/gmail-notifications"
    
    # OAuth
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    oauth_redirect_uri: str = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:9876/callback")
    
    # Gmail API scopes
    gmail_scopes: list[str] = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
    ]
    
    # Magic folder prefix
    magic_folder_prefix: str = "@AutoSort"
    
    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### 3.3 Main Application

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import router as api_router
from app.api.auth_routes import router as auth_router
from app.gmail.push import router as webhook_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("AutoSort backend starting...")
    yield
    # Shutdown
    print("AutoSort backend shutting down...")

app = FastAPI(
    title="AutoSort API",
    description="Email sorting automation backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for desktop app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/auth")
app.include_router(webhook_router, prefix="/webhooks")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "autosort-backend"}
```

### 3.4 Gmail Client

```python
# app/gmail/client.py
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
            return self.service.users().history().list(**params).execute()
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
```

### 3.5 Push Notification Handler

```python
# app/gmail/push.py
import base64
import json
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from google.oauth2.credentials import Credentials

from app.gmail.client import GmailClient, extract_email_address
from app.rules.engine import RuleEngine
from app.rules.models import ActionType
from app.auth.tokens import get_user_credentials, update_history_id, get_last_history_id
from app.config import get_settings

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
    try:
        envelope = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Decode the Pub/Sub message
    try:
        message_data = base64.b64decode(
            envelope["message"]["data"]
        ).decode("utf-8")
        notification = json.loads(message_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Pub/Sub message: {e}")
    
    user_email = notification.get("emailAddress")
    history_id = notification.get("historyId")
    
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
    
    # Get user credentials from Firestore
    credentials = await get_user_credentials(user_email)
    if not credentials:
        print(f"No credentials for user: {user_email}")
        return
    
    gmail = GmailClient(credentials)
    rule_engine = RuleEngine(user_email)
    
    # Get last known history ID
    last_history_id = await get_last_history_id(user_email)
    if not last_history_id:
        last_history_id = history_id
    
    # Fetch history since last known historyId
    history = await gmail.get_history(
        start_history_id=last_history_id,
        history_types=["messageAdded", "labelsAdded"]
    )
    
    for record in history.get("history", []):
        # Handle new messages → apply existing rules
        for msg_added in record.get("messagesAdded", []):
            message_id = msg_added["message"]["id"]
            await process_new_email(gmail, rule_engine, message_id)
        
        # Handle label additions → detect magic folder drops
        for label_added in record.get("labelsAdded", []):
            message_id = label_added["message"]["id"]
            added_labels = label_added.get("labelIds", [])
            await process_label_change(
                gmail, rule_engine, message_id, added_labels
            )
    
    # Update stored historyId for next notification
    await update_history_id(user_email, history_id)


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
        if not sender:
            return
        
        current_labels = message.get("labelIds", [])
        
        # Only process if it's in INBOX (not already sorted)
        if "INBOX" not in current_labels:
            return
        
        # Check if email is already in a magic folder (being processed)
        magic_folders = await rule_engine.get_magic_folder_ids()
        if any(label in magic_folders for label in current_labels):
            return
        
        # Find matching rule
        rule = await rule_engine.find_matching_rule(sender)
        
        if rule and rule.enabled:
            if rule.action == ActionType.MOVE:
                await gmail.modify_labels(
                    message_id,
                    add_labels=[rule.destination_label_id],
                    remove_labels=["INBOX"]
                )
            elif rule.action == ActionType.BLOCK_DELETE:
                await gmail.trash_message(message_id)
            
            # Update stats
            await rule_engine.increment_rule_counter(rule.id)
            await rule_engine.increment_emails_processed()
            
    except Exception as e:
        print(f"Error processing new email {message_id}: {e}")


async def process_label_change(
    gmail: GmailClient,
    rule_engine: RuleEngine,
    message_id: str,
    added_labels: list[str]
):
    """
    Detect when user drags email to a magic folder.
    Create a rule and move email to actual destination.
    """
    
    try:
        magic_folders = await rule_engine.get_magic_folders()
        magic_folder_map = {mf.label_id: mf for mf in magic_folders}
        
        for label_id in added_labels:
            if label_id in magic_folder_map:
                magic_folder = magic_folder_map[label_id]
                
                # Get the sender from this message
                message = await gmail.get_message_metadata(
                    message_id, 
                    headers=["From"]
                )
                sender = extract_email_address(message)
                
                if not sender:
                    return
                
                # Check if rule already exists
                existing_rule = await rule_engine.find_matching_rule(sender)
                if existing_rule:
                    # Rule exists, just move the email
                    pass
                else:
                    # Create new rule
                    await rule_engine.create_rule(
                        email_pattern=sender,
                        match_type="exact",
                        action=magic_folder.action,
                        destination_label_id=magic_folder.destination_label_id,
                        destination_label_name=magic_folder.destination_label_name
                    )
                
                # Move email from magic folder to actual destination
                if magic_folder.action == ActionType.MOVE:
                    await gmail.modify_labels(
                        message_id,
                        add_labels=[magic_folder.destination_label_id],
                        remove_labels=[label_id, "INBOX"]
                    )
                elif magic_folder.action == ActionType.BLOCK_DELETE:
                    await gmail.trash_message(message_id)
                
                break  # Only process first magic folder match
                
    except Exception as e:
        print(f"Error processing label change for {message_id}: {e}")
```

### 3.6 Rule Engine

```python
# app/rules/engine.py
from datetime import datetime, timezone
import uuid

from google.cloud import firestore

from app.rules.models import Rule, MagicFolder, MatchType, ActionType
from app.config import get_settings

settings = get_settings()
db = firestore.AsyncClient()


class RuleEngine:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.rules_collection = db.collection("users").document(user_id).collection("rules")
        self.magic_folders_collection = db.collection("users").document(user_id).collection("magic_folders")
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
        destination_label_name: str | None
    ) -> Rule:
        """Create a new rule."""
        rule_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        rule_data = {
            "email_pattern": email_pattern.lower(),
            "match_type": match_type,
            "action": action,
            "destination_label_id": destination_label_id,
            "destination_label_name": destination_label_name,
            "created_at": now,
            "enabled": True,
            "times_applied": 0
        }
        
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
            "action": action.value
        }
        
        await self.magic_folders_collection.document(label_id).set(folder_data)
        return MagicFolder(**folder_data)
    
    async def delete_magic_folder(self, label_id: str) -> None:
        """Delete a magic folder registration."""
        await self.magic_folders_collection.document(label_id).delete()
    
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
```

### 3.7 REST API Routes

```python
# app/api/routes.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import get_current_user, User
from app.rules.engine import RuleEngine
from app.rules.models import Rule, RuleCreate, RuleUpdate, MagicFolder
from app.gmail.client import GmailClient
from app.config import get_settings

router = APIRouter()
settings = get_settings()


# ============ RULES ============

@router.get("/rules", response_model=list[Rule])
async def list_rules(user: User = Depends(get_current_user)):
    """Get all rules for the authenticated user."""
    engine = RuleEngine(user.id)
    return await engine.list_rules()


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


# ============ STATS ============

@router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    """Get processing statistics."""
    engine = RuleEngine(user.id)
    return await engine.get_stats()


# ============ WATCH ============

@router.post("/watch/start")
async def start_watch(user: User = Depends(get_current_user)):
    """Start watching user's Gmail for changes."""
    gmail = GmailClient(user.credentials)
    result = await gmail.start_watch()
    return {
        "status": "watching",
        "expiration": result.get("expiration"),
        "history_id": result.get("historyId")
    }


@router.post("/watch/stop")
async def stop_watch(user: User = Depends(get_current_user)):
    """Stop watching user's Gmail."""
    gmail = GmailClient(user.credentials)
    await gmail.stop_watch()
    return {"status": "stopped"}


@router.post("/watch/renew")
async def renew_watch(user: User = Depends(get_current_user)):
    """Renew the Gmail watch (call before expiration)."""
    gmail = GmailClient(user.credentials)
    # Stop existing watch first
    try:
        await gmail.stop_watch()
    except Exception:
        pass
    # Start new watch
    result = await gmail.start_watch()
    return {
        "status": "renewed",
        "expiration": result.get("expiration")
    }
```

### 3.8 OAuth Routes

```python
# app/api/auth_routes.py
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import json

from app.auth.tokens import store_user_credentials
from app.config import get_settings

router = APIRouter()
settings = get_settings()


class TokenExchangeRequest(BaseModel):
    code: str
    redirect_uri: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "Bearer"


@router.get("/login")
async def login():
    """Generate OAuth authorization URL."""
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=settings.gmail_scopes
    )
    flow.redirect_uri = settings.oauth_redirect_uri
    
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"  # Force consent to get refresh token
    )
    
    return {
        "authorization_url": authorization_url,
        "state": state
    }


@router.post("/callback", response_model=TokenResponse)
async def oauth_callback(request: TokenExchangeRequest):
    """Exchange authorization code for tokens."""
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=settings.gmail_scopes
    )
    flow.redirect_uri = request.redirect_uri
    
    try:
        flow.fetch_token(code=request.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {e}")
    
    credentials = flow.credentials
    
    # Get user info to get user ID
    from googleapiclient.discovery import build
    service = build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()
    user_email = user_info["email"]
    
    # Store credentials in Firestore
    await store_user_credentials(
        user_email=user_email,
        credentials=credentials
    )
    
    return TokenResponse(
        access_token=credentials.token,
        refresh_token=credentials.refresh_token,
        expires_in=3600  # 1 hour
    )


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Refresh an access token."""
    from google.auth.transport.requests import Request
    
    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    
    try:
        credentials.refresh(Request())
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token refresh failed: {e}")
    
    return TokenResponse(
        access_token=credentials.token,
        refresh_token=credentials.refresh_token or refresh_token,
        expires_in=3600
    )
```

### 3.9 Dependencies

```python
# app/api/dependencies.py
from fastapi import Depends, HTTPException, Header
from google.oauth2.credentials import Credentials
from pydantic import BaseModel

from app.auth.tokens import get_user_credentials_by_token
from app.config import get_settings

settings = get_settings()


class User(BaseModel):
    id: str  # email
    credentials: Credentials
    
    class Config:
        arbitrary_types_allowed = True


async def get_current_user(
    authorization: str = Header(..., description="Bearer token")
) -> User:
    """Validate Bearer token and return user."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header"
        )
    
    token = authorization[7:]  # Remove "Bearer " prefix
    
    # Get user credentials from token
    user_data = await get_user_credentials_by_token(token)
    
    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    
    return User(
        id=user_data["email"],
        credentials=user_data["credentials"]
    )
```

### 3.10 Token Management

```python
# app/auth/tokens.py
from datetime import datetime, timezone
from google.oauth2.credentials import Credentials
from google.cloud import firestore

from app.config import get_settings

settings = get_settings()
db = firestore.AsyncClient()


async def store_user_credentials(
    user_email: str,
    credentials: Credentials
) -> None:
    """Store user credentials in Firestore."""
    doc_ref = db.collection("users").document(user_email)
    
    await doc_ref.set({
        "email": user_email,
        "credentials": {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else [],
        },
        "updated_at": datetime.now(timezone.utc)
    }, merge=True)


async def get_user_credentials(user_email: str) -> Credentials | None:
    """Get user credentials from Firestore."""
    doc_ref = db.collection("users").document(user_email)
    doc = await doc_ref.get()
    
    if not doc.exists:
        return None
    
    data = doc.to_dict()
    creds_data = data.get("credentials", {})
    
    if not creds_data:
        return None
    
    return Credentials(
        token=creds_data.get("token"),
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=creds_data.get("client_id", settings.google_client_id),
        client_secret=creds_data.get("client_secret", settings.google_client_secret),
        scopes=creds_data.get("scopes", settings.gmail_scopes),
    )


async def get_user_credentials_by_token(access_token: str) -> dict | None:
    """Look up user by access token."""
    # Query users collection for matching token
    query = db.collection("users").where("credentials.token", "==", access_token)
    
    async for doc in query.stream():
        data = doc.to_dict()
        credentials = await get_user_credentials(data["email"])
        if credentials:
            return {
                "email": data["email"],
                "credentials": credentials
            }
    
    return None


async def update_history_id(user_email: str, history_id: str) -> None:
    """Update the last known history ID for a user."""
    doc_ref = db.collection("users").document(user_email)
    await doc_ref.set({
        "last_history_id": history_id,
        "history_updated_at": datetime.now(timezone.utc)
    }, merge=True)


async def get_last_history_id(user_email: str) -> str | None:
    """Get the last known history ID for a user."""
    doc_ref = db.collection("users").document(user_email)
    doc = await doc_ref.get()
    
    if doc.exists:
        return doc.to_dict().get("last_history_id")
    return None
```

### 3.11 Deployment Files

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

```txt
# requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
google-cloud-firestore==2.14.0
google-api-python-client==2.111.0
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
pydantic==2.5.3
pydantic-settings==2.1.0
python-multipart==0.0.6
```

```yaml
# cloudbuild.yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/autosort-backend', '.']
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/autosort-backend']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'autosort-backend'
      - '--image=gcr.io/$PROJECT_ID/autosort-backend'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=GOOGLE_CLOUD_PROJECT=$PROJECT_ID'
      - '--set-secrets=GOOGLE_CLIENT_ID=oauth-client-id:latest,GOOGLE_CLIENT_SECRET=oauth-client-secret:latest'

images:
  - 'gcr.io/$PROJECT_ID/autosort-backend'
```

---

## 4. Frontend Specification (Tauri + React)

### 4.1 Project Structure

```
autosort/
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── eslint.config.js
├── .gitignore
├── README.md
│
├── public/
│   └── autosort-icon.svg
│
├── src/
│   ├── main.jsx                    # React entry point
│   ├── App.jsx                     # Main app component
│   ├── index.css                   # Tailwind imports
│   │
│   ├── components/
│   │   ├── Navigation.jsx          # Tab navigation bar
│   │   ├── RulesList.jsx           # Rules table view
│   │   ├── RuleRow.jsx             # Individual rule row
│   │   ├── RuleEditor.jsx          # Edit/create rule modal
│   │   ├── StatsView.jsx           # Processing statistics
│   │   ├── SettingsView.jsx        # App settings
│   │   ├── OnboardingFlow.jsx      # First-run setup + OAuth
│   │   ├── MagicFolderSetup.jsx    # Magic folder configuration
│   │   ├── ConfirmDialog.jsx       # Confirmation modal
│   │   ├── Toast.jsx               # Toast notifications
│   │   ├── LoadingSpinner.jsx      # Loading indicator
│   │   └── EmptyState.jsx          # Empty list placeholder
│   │
│   ├── hooks/
│   │   ├── useAuth.js              # OAuth state management
│   │   ├── useRules.js             # Rules CRUD operations
│   │   ├── useApi.js               # Backend API client
│   │   ├── useLocalStorage.js      # Local storage persistence
│   │   ├── useToast.js             # Toast notification hook
│   │   └── useKeyboardShortcuts.js # Keyboard shortcuts
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx         # Auth state provider
│   │   ├── ThemeContext.jsx        # Theme state provider
│   │   └── ToastContext.jsx        # Toast notifications provider
│   │
│   └── constants/
│       ├── themes.js               # Theme definitions
│       └── api.js                  # API configuration
│
├── src-tauri/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── tauri.conf.json
│   ├── build.rs
│   │
│   ├── capabilities/
│   │   └── default.json
│   │
│   ├── icons/
│   │   ├── icon.icns               # macOS icon
│   │   ├── icon.ico                # Windows icon
│   │   └── icon.png                # Linux icon
│   │
│   └── src/
│       ├── main.rs                 # Tauri entry point
│       └── lib.rs                  # Tauri commands
│
└── .github/
    └── workflows/
        └── build.yml               # CI/CD workflow
```

### 4.2 Package Configuration

```json
// package.json
{
  "name": "autosort",
  "version": "1.0.0",
  "description": "Email sorting automation",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "lint": "eslint ."
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-log": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "lucide-react": "^0.453.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.0.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "globals": "^15.0.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0"
  }
}
```

### 4.3 Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host: host,
          port: 5174,
        }
      : undefined,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

### 4.4 Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom theme colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },
  plugins: [],
};
```

### 4.5 Main Entry Point

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
```

### 4.6 Main App Component

```jsx
// src/App.jsx
import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Navigation from './components/Navigation';
import RulesList from './components/RulesList';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import OnboardingFlow from './components/OnboardingFlow';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';

const TABS = {
  RULES: 'rules',
  STATS: 'stats',
  SETTINGS: 'settings',
};

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.RULES);

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Show onboarding if not authenticated
  if (!isAuthenticated) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/autosort-icon.svg" 
              alt="AutoSort" 
              className="w-8 h-8"
            />
            <h1 className="text-xl font-semibold">AutoSort</h1>
          </div>
          <Navigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            tabs={TABS}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {activeTab === TABS.RULES && <RulesList />}
        {activeTab === TABS.STATS && <StatsView />}
        {activeTab === TABS.SETTINGS && <SettingsView />}
      </main>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}

export default App;
```

### 4.7 Navigation Component

```jsx
// src/components/Navigation.jsx
import { List, BarChart2, Settings } from 'lucide-react';

function Navigation({ activeTab, onTabChange, tabs }) {
  const navItems = [
    { id: tabs.RULES, label: 'Rules', icon: List },
    { id: tabs.STATS, label: 'Stats', icon: BarChart2 },
    { id: tabs.SETTINGS, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="flex gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              transition-colors duration-150
              ${isActive 
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
            `}
          >
            <Icon size={18} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default Navigation;
```

### 4.8 Rules List Component

```jsx
// src/components/RulesList.jsx
import { useState } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { useRules } from '../hooks/useRules';
import RuleRow from './RuleRow';
import RuleEditor from './RuleEditor';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

function RulesList() {
  const { 
    rules, 
    isLoading, 
    error, 
    refresh, 
    updateRule, 
    deleteRule,
    createRule 
  } = useRules();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter rules by search
  const filteredRules = rules.filter(rule => 
    rule.email_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rule.destination_label_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleEnabled = async (rule) => {
    await updateRule(rule.id, { enabled: !rule.enabled });
  };

  const handleDelete = async (rule) => {
    await deleteRule(rule.id);
  };

  const handleSaveRule = async (ruleData) => {
    if (editingRule) {
      await updateRule(editingRule.id, ruleData);
      setEditingRule(null);
    } else {
      await createRule(ruleData);
      setShowCreateModal(false);
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={18} />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Rules Table */}
      {isLoading && rules.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredRules.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching rules" : "No rules yet"}
          description={
            searchQuery 
              ? "Try a different search term" 
              : "Drag emails to @AutoSort folders in your email client to create rules automatically, or click 'Add Rule' to create one manually."
          }
          action={
            !searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create First Rule
              </button>
            )
          }
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <div className="col-span-1">Status</div>
            <div className="col-span-4">Email Pattern</div>
            <div className="col-span-2">Match Type</div>
            <div className="col-span-3">Destination</div>
            <div className="col-span-1 text-right">Used</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={() => setEditingRule(rule)}
                onToggleEnabled={() => handleToggleEnabled(rule)}
                onDelete={() => handleDelete(rule)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{filteredRules.length} rules{searchQuery && ` matching "${searchQuery}"`}</span>
        <span>{rules.filter(r => r.enabled).length} active</span>
      </div>

      {/* Edit Modal */}
      {editingRule && (
        <RuleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onClose={() => setEditingRule(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <RuleEditor
          onSave={handleSaveRule}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

export default RulesList;
```

### 4.9 Rule Row Component

```jsx
// src/components/RuleRow.jsx
import { Pencil, Trash2, MoreVertical, Folder, Ban } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const MATCH_TYPE_LABELS = {
  exact: 'Exact',
  domain: 'Domain',
  contains: 'Contains',
};

function RuleRow({ rule, onEdit, onToggleEnabled, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isBlockRule = rule.action === 'block_delete';

  return (
    <div 
      className={`
        grid grid-cols-12 gap-4 px-4 py-3 items-center
        hover:bg-gray-50 dark:hover:bg-gray-700/50
        ${!rule.enabled ? 'opacity-50' : ''}
      `}
    >
      {/* Status Toggle */}
      <div className="col-span-1">
        <button
          onClick={onToggleEnabled}
          className={`
            w-10 h-6 rounded-full transition-colors duration-200
            ${rule.enabled 
              ? 'bg-green-500' 
              : 'bg-gray-300 dark:bg-gray-600'}
          `}
        >
          <span 
            className={`
              block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${rule.enabled ? 'translate-x-5' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Email Pattern */}
      <div className="col-span-4">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {rule.email_pattern}
        </span>
      </div>

      {/* Match Type */}
      <div className="col-span-2">
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          {MATCH_TYPE_LABELS[rule.match_type] || rule.match_type}
        </span>
      </div>

      {/* Destination */}
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          {isBlockRule ? (
            <>
              <Ban size={16} className="text-red-500" />
              <span className="text-red-600 dark:text-red-400">Block & Delete</span>
            </>
          ) : (
            <>
              <Folder size={16} className="text-blue-500" />
              <span>{rule.destination_label_name || 'Unknown'}</span>
            </>
          )}
        </div>
      </div>

      {/* Times Applied */}
      <div className="col-span-1 text-right">
        <span className="text-gray-500 dark:text-gray-400">
          {rule.times_applied || 0}×
        </span>
      </div>

      {/* Actions Menu */}
      <div className="col-span-1 text-right relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <MoreVertical size={18} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-8 z-10 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
            <button
              onClick={() => {
                setShowMenu(false);
                onEdit();
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onDelete();
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RuleRow;
```

### 4.10 Auth Hook

```javascript
// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { useToast } from './useToast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { showToast } = useToast();

  // Check for existing token on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const token = await invoke('get_stored_token');
      if (token) {
        // Validate token by making a test API call
        const response = await fetch(`${API_BASE_URL}/api/v1/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // Token invalid, clear it
          await invoke('delete_token');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get OAuth URL from backend
      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`);
      const { authorization_url } = await loginResponse.json();
      
      // Start local server to receive callback
      const callbackPromise = invoke('start_oauth_callback_server');
      
      // Open browser for OAuth
      await open(authorization_url);
      
      // Wait for callback with authorization code
      const code = await callbackPromise;
      
      // Exchange code for tokens
      const tokenResponse = await fetch(`${API_BASE_URL}/auth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          redirect_uri: 'http://localhost:9876/callback' 
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Token exchange failed');
      }
      
      const tokens = await tokenResponse.json();
      
      // Store access token securely
      await invoke('store_token', { token: tokens.access_token });
      
      // Also store refresh token if available
      if (tokens.refresh_token) {
        await invoke('store_refresh_token', { token: tokens.refresh_token });
      }
      
      setIsAuthenticated(true);
      showToast('success', 'Signed in successfully');
      
    } catch (error) {
      console.error('Sign in failed:', error);
      showToast('error', 'Sign in failed. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const signOut = useCallback(async () => {
    try {
      await invoke('delete_token');
      await invoke('delete_refresh_token');
      setIsAuthenticated(false);
      setUser(null);
      showToast('success', 'Signed out');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [showToast]);

  const getAccessToken = useCallback(async () => {
    try {
      return await invoke('get_stored_token');
    } catch {
      return null;
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    signIn,
    signOut,
    getAccessToken,
    checkAuth,
  };
}
```

### 4.11 Rules Hook

```javascript
// src/hooks/useRules.js
import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import { useLocalStorage } from './useLocalStorage';
import { useToast } from './useToast';

export function useRules() {
  const api = useApi();
  const { showToast } = useToast();
  
  // Cache rules locally
  const [cachedRules, setCachedRules] = useLocalStorage('autosort_rules', []);
  
  const [rules, setRules] = useState(cachedRules);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch rules on mount
  useEffect(() => {
    refresh();
  }, []);

  // Sync to local cache when rules change
  useEffect(() => {
    if (rules.length > 0) {
      setCachedRules(rules);
    }
  }, [rules, setCachedRules]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get('/rules');
      setRules(data);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      setError(err.message || 'Failed to load rules');
      // Fall back to cached rules
      setRules(cachedRules);
    } finally {
      setIsLoading(false);
    }
  }, [api, cachedRules]);

  const createRule = useCallback(async (ruleData) => {
    try {
      const newRule = await api.post('/rules', ruleData);
      setRules(prev => [...prev, newRule]);
      showToast('success', 'Rule created');
      return newRule;
    } catch (err) {
      showToast('error', 'Failed to create rule');
      throw err;
    }
  }, [api, showToast]);

  const updateRule = useCallback(async (ruleId, updates) => {
    // Optimistic update
    const previousRules = rules;
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, ...updates } : r
    ));

    try {
      const updated = await api.put(`/rules/${ruleId}`, updates);
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r));
      showToast('success', 'Rule updated');
      return updated;
    } catch (err) {
      // Rollback on error
      setRules(previousRules);
      showToast('error', 'Failed to update rule');
      throw err;
    }
  }, [api, rules, showToast]);

  const deleteRule = useCallback(async (ruleId) => {
    // Optimistic update
    const previousRules = rules;
    setRules(prev => prev.filter(r => r.id !== ruleId));

    try {
      await api.delete(`/rules/${ruleId}`);
      showToast('success', 'Rule deleted');
    } catch (err) {
      // Rollback on error
      setRules(previousRules);
      showToast('error', 'Failed to delete rule');
      throw err;
    }
  }, [api, rules, showToast]);

  return {
    rules,
    isLoading,
    error,
    refresh,
    createRule,
    updateRule,
    deleteRule,
  };
}
```

### 4.12 API Hook

```javascript
// src/hooks/useApi.js
import { useCallback } from 'react';
import { useAuth } from './useAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useApi() {
  const { getAccessToken, signOut } = useAuth();

  const request = useCallback(async (endpoint, options = {}) => {
    const token = await getAccessToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `${API_BASE_URL}/api/v1${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, sign out
      await signOut();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API error: ${response.status}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }, [getAccessToken, signOut]);

  const get = useCallback((endpoint) => {
    return request(endpoint, { method: 'GET' });
  }, [request]);

  const post = useCallback((endpoint, data) => {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [request]);

  const put = useCallback((endpoint, data) => {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }, [request]);

  const del = useCallback((endpoint) => {
    return request(endpoint, { method: 'DELETE' });
  }, [request]);

  return { get, post, put, delete: del, request };
}
```

### 4.13 Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "AutoSort",
  "version": "1.0.0",
  "identifier": "com.autosort.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "AutoSort",
        "width": 900,
        "height": 600,
        "minWidth": 700,
        "minHeight": 500,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  },
  "plugins": {
    "fs": {
      "scope": ["$APPDATA/*", "$HOME/.autosort/*"]
    },
    "shell": {
      "open": true
    }
  }
}
```

### 4.14 Tauri Rust Backend

```toml
# src-tauri/Cargo.toml
[package]
name = "autosort"
version = "1.0.0"
description = "Email sorting automation"
authors = ["You"]
edition = "2021"

[lib]
name = "autosort_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-log = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
keyring = "3"
tokio = { version = "1", features = ["full"] }
tiny_http = "0.12"
url = "2"
```

```rust
// src-tauri/src/lib.rs
use keyring::Entry;
use std::sync::mpsc;
use std::thread;
use tiny_http::{Server, Response};
use url::Url;

const SERVICE_NAME: &str = "autosort";

// ============ KEYCHAIN COMMANDS ============

#[tauri::command]
fn store_token(token: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "access_token")
        .map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stored_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, "access_token")
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "access_token")
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn store_refresh_token(token: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "refresh_token")
        .map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stored_refresh_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, "refresh_token")
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_refresh_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "refresh_token")
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ============ OAUTH CALLBACK SERVER ============

#[tauri::command]
async fn start_oauth_callback_server() -> Result<String, String> {
    let (tx, rx) = mpsc::channel();
    
    // Start server in a separate thread
    thread::spawn(move || {
        let server = Server::http("127.0.0.1:9876").unwrap();
        
        // Wait for a single request
        if let Some(request) = server.incoming_requests().next() {
            let url_str = format!("http://localhost{}", request.url());
            
            if let Ok(url) = Url::parse(&url_str) {
                // Extract the authorization code
                if let Some(code) = url.query_pairs()
                    .find(|(key, _)| key == "code")
                    .map(|(_, value)| value.to_string())
                {
                    // Send success response to browser
                    let response = Response::from_string(
                        "<html><body><h1>Success!</h1><p>You can close this window and return to AutoSort.</p><script>window.close();</script></body></html>"
                    ).with_header(
                        tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap()
                    );
                    let _ = request.respond(response);
                    
                    // Send the code back to the main thread
                    let _ = tx.send(Ok(code));
                    return;
                }
            }
            
            // Send error response
            let response = Response::from_string(
                "<html><body><h1>Error</h1><p>Authentication failed. Please try again.</p></body></html>"
            );
            let _ = request.respond(response);
            let _ = tx.send(Err("No authorization code received".to_string()));
        }
    });
    
    // Wait for the result (with timeout)
    rx.recv_timeout(std::time::Duration::from_secs(300))
        .map_err(|_| "OAuth timeout".to_string())?
}

// ============ APP SETUP ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            store_token,
            get_stored_token,
            delete_token,
            store_refresh_token,
            get_stored_refresh_token,
            delete_refresh_token,
            start_oauth_callback_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    autosort_lib::run()
}
```

### 4.15 GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
            name: macOS-ARM64
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
            name: macOS-x64
          - platform: ubuntu-22.04
            args: ''
            name: Linux
          - platform: windows-latest
            args: ''
            name: Windows

    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust stable
        uses: dtolnay/rust-action@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev

      - name: Install frontend dependencies
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'AutoSort v__VERSION__'
          releaseBody: 'See the assets to download for your platform.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

---

## 5. Data Models

### 5.1 Backend Models (Pydantic)

```python
# app/rules/models.py
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Optional

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

class ProcessingStats(BaseModel):
    emails_processed: int = 0
    rules_count: int = 0
    last_processed_at: Optional[datetime] = None
```

### 5.2 Firestore Schema

```
/users/{userEmail}
├── email: string
├── credentials: {
│     token: string
│     refresh_token: string
│     token_uri: string
│     client_id: string
│     client_secret: string
│     scopes: string[]
│   }
├── last_history_id: string
├── history_updated_at: timestamp
├── emails_processed: number
├── last_processed_at: timestamp
│
├── /rules/{ruleId}
│   ├── email_pattern: string
│   ├── match_type: string ("exact" | "domain" | "contains")
│   ├── action: string ("move" | "block_delete")
│   ├── destination_label_id: string | null
│   ├── destination_label_name: string | null
│   ├── created_at: timestamp
│   ├── enabled: boolean
│   └── times_applied: number
│
└── /magic_folders/{labelId}
    ├── label_id: string
    ├── label_name: string
    ├── destination_label_id: string | null
    ├── destination_label_name: string | null
    └── action: string
```

---

## 6. Authentication Flow

### 6.1 OAuth Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Desktop   │     │   Browser   │     │   Backend   │     │   Google    │
│     App     │     │             │     │             │     │   OAuth     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Click "Sign In"│                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │ 2. GET /auth/login│                   │                   │
       │───────────────────────────────────────►                   │
       │                   │                   │                   │
       │ 3. Return auth URL│                   │                   │
       │◄──────────────────────────────────────│                   │
       │                   │                   │                   │
       │ 4. Start callback server (port 9876)  │                   │
       │────────┐          │                   │                   │
       │        │          │                   │                   │
       │◄───────┘          │                   │                   │
       │                   │                   │                   │
       │ 5. Open browser   │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 6. Navigate to Google OAuth          │
       │                   │──────────────────────────────────────►│
       │                   │                   │                   │
       │                   │ 7. User consents  │                   │
       │                   │◄─────────────────────────────────────│
       │                   │                   │                   │
       │                   │ 8. Redirect to localhost:9876/callback?code=XXX
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │ 9. Capture code   │                   │                   │
       │◄──────────────────│                   │                   │
       │                   │                   │                   │
       │ 10. POST /auth/callback with code     │                   │
       │───────────────────────────────────────►                   │
       │                   │                   │                   │
       │                   │                   │ 11. Exchange code │
       │                   │                   │──────────────────►│
       │                   │                   │                   │
       │                   │                   │ 12. Return tokens │
       │                   │                   │◄──────────────────│
       │                   │                   │                   │
       │                   │                   │ 13. Store in      │
       │                   │                   │     Firestore     │
       │                   │                   │────────┐          │
       │                   │                   │        │          │
       │                   │                   │◄───────┘          │
       │                   │                   │                   │
       │ 14. Return tokens │                   │                   │
       │◄──────────────────────────────────────│                   │
       │                   │                   │                   │
       │ 15. Store in Keychain                 │                   │
       │────────┐          │                   │                   │
       │        │          │                   │                   │
       │◄───────┘          │                   │                   │
       │                   │                   │                   │
       │ 16. Authenticated!│                   │                   │
       │                   │                   │                   │
```

### 6.2 Token Refresh Flow

```
┌─────────────┐                              ┌─────────────┐
│   Desktop   │                              │   Backend   │
│     App     │                              │             │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │ 1. API call returns 401                    │
       │◄───────────────────────────────────────────│
       │                                            │
       │ 2. POST /auth/refresh with refresh_token   │
       │───────────────────────────────────────────►│
       │                                            │
       │ 3. Return new access_token                 │
       │◄───────────────────────────────────────────│
       │                                            │
       │ 4. Update Keychain                         │
       │────────┐                                   │
       │        │                                   │
       │◄───────┘                                   │
       │                                            │
       │ 5. Retry original request                  │
       │───────────────────────────────────────────►│
       │                                            │
```

---

## 7. Setup & Deployment Guide

### 7.1 Prerequisites

**Required Software:**
- Node.js 18+
- Rust (latest stable)
- gcloud CLI
- Git

**Google Cloud Setup:**
1. Create a Google Cloud project or use existing
2. Enable billing
3. Create OAuth 2.0 credentials in Cloud Console
4. Download `client_secret.json`

### 7.2 Google Cloud Infrastructure Setup

```bash
# 1. Authenticate with gcloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs
gcloud services enable \
    run.googleapis.com \
    pubsub.googleapis.com \
    firestore.googleapis.com \
    gmail.googleapis.com \
    secretmanager.googleapis.com

# 3. Create Pub/Sub topic for Gmail notifications
gcloud pubsub topics create gmail-notifications

# 4. Grant Gmail permission to publish to topic
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
    --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
    --role="roles/pubsub.publisher"

# 5. Create Firestore database
gcloud firestore databases create --region=us-central1

# 6. Store OAuth secrets
echo -n "YOUR_CLIENT_ID" | gcloud secrets create oauth-client-id --data-file=-
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets create oauth-client-secret --data-file=-

# 7. Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding oauth-client-id \
    --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding oauth-client-secret \
    --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 7.3 Backend Deployment

```bash
# Navigate to backend directory
cd autosort-backend

# Deploy to Cloud Run
gcloud run deploy autosort-backend \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID" \
    --set-secrets="GOOGLE_CLIENT_ID=oauth-client-id:latest,GOOGLE_CLIENT_SECRET=oauth-client-secret:latest"

# Get the service URL
gcloud run services describe autosort-backend --region us-central1 --format='value(status.url)'

# Create Pub/Sub subscription to push to Cloud Run
gcloud pubsub subscriptions create gmail-push-sub \
    --topic=gmail-notifications \
    --push-endpoint=https://autosort-backend-XXXXX.run.app/webhooks/gmail \
    --ack-deadline=60
```

### 7.4 Frontend Development

```bash
# Navigate to frontend directory
cd autosort

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=https://autosort-backend-XXXXX.run.app" > .env

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

### 7.5 OAuth Consent Screen Configuration

In Google Cloud Console:
1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** user type
3. Fill in app information:
   - App name: AutoSort
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (your email)
6. Submit for verification when ready for production

---

## 8. Claude Code Session Prompts

### Session 1: Google Cloud Infrastructure

```
I want to set up a Google Cloud backend for an email sorting app called AutoSort.

Prerequisites I've completed:
- gcloud CLI installed and authenticated
- Project "autosort-prod" created with billing enabled
- OAuth credentials created (I have the client ID and secret)

Please:
1. Enable required APIs (Cloud Run, Pub/Sub, Firestore, Gmail, Secret Manager)
2. Create Pub/Sub topic "gmail-notifications" for Gmail push notifications
3. Grant Gmail API permission to publish to the topic
4. Create Firestore database in us-central1
5. Store my OAuth credentials in Secret Manager (I'll paste the values when prompted)

After infrastructure is ready, we'll write the backend code.
```

### Session 2: Backend - Core Structure

```
Create the Python FastAPI backend for AutoSort.

Use this structure:
- FastAPI with async/await
- Firestore for data storage  
- Deploy to Cloud Run

Create these files:
1. main.py - FastAPI app with CORS, health check, route includes
2. app/config.py - Settings from environment variables
3. app/rules/models.py - Pydantic models for Rule, MagicFolder, MatchType, ActionType
4. requirements.txt - fastapi, uvicorn, google-cloud-firestore, google-api-python-client, google-auth-oauthlib, pydantic, pydantic-settings
5. Dockerfile - Python 3.11 slim image with uvicorn

Don't implement the routes yet - just the structure.
```

### Session 3: Backend - Gmail Client

```
Add the Gmail API client to AutoSort backend.

Create app/gmail/client.py with a GmailClient class that has these methods:
- start_watch() - Subscribe to push notifications, return historyId and expiration
- stop_watch() - Unsubscribe from notifications
- get_history(start_history_id, history_types) - Get mailbox changes since a history ID
- get_message_metadata(message_id, headers) - Get message metadata (From, Subject, etc.)
- modify_labels(message_id, add_labels, remove_labels) - Add/remove labels from message
- trash_message(message_id) - Move message to trash
- list_labels() - Get all user labels
- create_label(name) - Create a new label
- delete_label(label_id) - Delete a label

Also create a helper function extract_email_address(message) to parse the From header.

Use the google-api-python-client library.
```

### Session 4: Backend - Rule Engine

```
Add the rule engine to AutoSort backend.

Create app/rules/engine.py with a RuleEngine class that:
- Uses Firestore for storage
- Has a constructor taking user_id (email)

Implement these methods:
- find_matching_rule(sender_email) - Find first enabled rule matching sender
- _matches_pattern(sender, pattern, match_type) - Pattern matching for exact/domain/contains
- create_rule(...) - Create a new rule
- list_rules() - Get all rules for user
- get_rule(rule_id) - Get single rule
- update_rule(rule_id, updates) - Update rule fields
- delete_rule(rule_id) - Delete rule
- increment_rule_counter(rule_id) - Increment times_applied
- increment_emails_processed() - Update user stats
- get_magic_folders() - List magic folders
- get_magic_folder_ids() - Set of magic folder label IDs
- register_magic_folder(...) - Create magic folder mapping
- delete_magic_folder(label_id) - Remove magic folder
- get_stats() - Get processing statistics

Create app/rules/store.py if you want to separate Firestore operations.
```

### Session 5: Backend - Push Notification Handler

```
Add the Gmail push notification handler to AutoSort backend.

Create app/gmail/push.py with:
1. A FastAPI router for POST /webhooks/gmail
2. handle_gmail_push() endpoint that:
   - Decodes the Pub/Sub message (base64 JSON)
   - Extracts emailAddress and historyId
   - Queues background processing

3. process_gmail_notification(user_email, history_id) background task:
   - Gets user credentials from Firestore
   - Creates GmailClient and RuleEngine
   - Fetches history with messageAdded and labelsAdded types
   - For each messageAdded: calls process_new_email()
   - For each labelsAdded: calls process_label_change()
   - Updates stored historyId

4. process_new_email(gmail, rule_engine, message_id):
   - Gets message metadata (From header)
   - Skips if not in INBOX
   - Finds matching rule
   - Applies move or block_delete action
   - Updates stats

5. process_label_change(gmail, rule_engine, message_id, added_labels):
   - Checks if any added label is a magic folder
   - Gets sender from message
   - Creates rule (if not exists)
   - Moves email to actual destination

Also create app/auth/tokens.py with:
- store_user_credentials(user_email, credentials)
- get_user_credentials(user_email)
- get_user_credentials_by_token(access_token)
- update_history_id(user_email, history_id)
- get_last_history_id(user_email)
```

### Session 6: Backend - REST API

```
Add the REST API endpoints to AutoSort backend.

Create app/api/routes.py with these endpoints:

Rules:
- GET /api/v1/rules - List all rules
- POST /api/v1/rules - Create rule manually
- GET /api/v1/rules/{rule_id} - Get single rule
- PUT /api/v1/rules/{rule_id} - Update rule
- DELETE /api/v1/rules/{rule_id} - Delete rule

Labels:
- GET /api/v1/labels - List Gmail labels
- GET /api/v1/magic-folders - List magic folders
- POST /api/v1/magic-folders/setup - Create magic folders for each user label

Stats:
- GET /api/v1/stats - Processing statistics

Watch:
- POST /api/v1/watch/start - Start Gmail watch
- POST /api/v1/watch/stop - Stop Gmail watch
- POST /api/v1/watch/renew - Renew watch before expiration

Create app/api/dependencies.py with:
- User model (id, credentials)
- get_current_user() dependency that validates Bearer token

Create app/api/auth_routes.py with:
- GET /auth/login - Generate OAuth authorization URL
- POST /auth/callback - Exchange code for tokens
- POST /auth/refresh - Refresh access token
```

### Session 7: Backend - Deploy and Test

```
Deploy the AutoSort backend to Cloud Run and test it.

1. Create cloudbuild.yaml for CI/CD
2. Create .gcloudignore to exclude unnecessary files
3. Deploy using: gcloud run deploy autosort-backend --source .

After deployment:
4. Create the Pub/Sub subscription pointing to the Cloud Run URL
5. Test the health endpoint: curl https://YOUR_URL/health
6. Test the OAuth flow manually

Provide me with:
- The deployment commands
- How to test each endpoint
- How to check the logs: gcloud run logs read autosort-backend
```

### Session 8: Frontend - Tauri Setup

```
Create a Tauri 2 + React app for AutoSort, following the same patterns as the Chops music practice app.

Use:
- Tauri 2 with tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell, tauri-plugin-log
- React 19 with Vite 6
- Tailwind CSS 4
- Lucide React for icons

Create the project structure with:
1. package.json with all dependencies
2. vite.config.js configured for Tauri
3. tailwind.config.js
4. src/main.jsx - entry point with providers
5. src/App.jsx - main app with authentication check
6. src/index.css - Tailwind imports

7. src-tauri/Cargo.toml with:
   - tauri 2
   - tauri-plugin-fs, dialog, shell, log
   - keyring for secure storage
   - tiny_http for OAuth callback
   - serde, serde_json
   - tokio

8. src-tauri/tauri.conf.json configured for the app
9. src-tauri/src/lib.rs with Tauri commands (empty for now)
10. src-tauri/src/main.rs

Include the .github/workflows/build.yml from Chops for cross-platform builds.
```

### Session 9: Frontend - Auth Flow

```
Add OAuth authentication to the AutoSort Tauri app.

Rust side (src-tauri/src/lib.rs):
1. Keychain commands using the keyring crate:
   - store_token, get_stored_token, delete_token
   - store_refresh_token, get_stored_refresh_token, delete_refresh_token

2. OAuth callback server command:
   - start_oauth_callback_server() that:
     - Starts HTTP server on port 9876
     - Waits for callback with ?code=XXX
     - Returns the authorization code
     - Shows success HTML page to user

React side:
3. src/contexts/AuthContext.jsx - Auth state provider with:
   - isAuthenticated, isLoading state
   - AuthProvider component
   - useAuth hook export

4. src/hooks/useAuth.js:
   - Check for token on mount
   - signIn() - full OAuth flow
   - signOut() - clear tokens
   - getAccessToken() - get current token

5. src/components/OnboardingFlow.jsx:
   - Welcome screen
   - "Sign in with Google" button
   - Loading state during OAuth
   - Success state

Update App.jsx to show OnboardingFlow when not authenticated.

The backend URL should come from VITE_API_URL environment variable.
```

### Session 10: Frontend - Rules UI

```
Add the rules management UI to AutoSort.

Create:
1. src/hooks/useApi.js - API client with get/post/put/delete methods
2. src/hooks/useRules.js - Rules state with CRUD operations and local caching
3. src/hooks/useLocalStorage.js - Local storage hook (copy from Chops)
4. src/hooks/useToast.js - Toast notification hook
5. src/contexts/ToastContext.jsx - Toast provider

6. src/components/Navigation.jsx - Tab navigation (Rules, Stats, Settings)
7. src/components/RulesList.jsx - Main rules view with:
   - Search/filter
   - Refresh button
   - Add Rule button
   - Rules table

8. src/components/RuleRow.jsx - Individual rule with:
   - Enable/disable toggle
   - Email pattern
   - Match type badge
   - Destination folder
   - Times applied count
   - Actions menu (Edit, Delete)

9. src/components/RuleEditor.jsx - Modal for create/edit rule:
   - Email pattern input
   - Match type dropdown
   - Action dropdown (Move/Block)
   - Destination folder dropdown (fetched from API)
   - Save/Cancel buttons

10. src/components/EmptyState.jsx - Empty state placeholder
11. src/components/LoadingSpinner.jsx - Loading indicator
12. src/components/Toast.jsx - Toast notification component
13. src/components/ConfirmDialog.jsx - Confirmation modal

Use optimistic updates for better UX.
```

### Session 11: Frontend - Stats and Settings

```
Add the Stats and Settings views to AutoSort.

Create:
1. src/components/StatsView.jsx:
   - Total emails processed
   - Total rules count
   - Rules triggered (sum of times_applied)
   - Last processed timestamp
   - Refresh button

2. src/components/SettingsView.jsx:
   - Account section showing signed-in email
   - Sign Out button
   - Magic Folders section:
     - List current magic folders
     - "Setup Magic Folders" button (calls POST /magic-folders/setup)
   - Gmail Watch section:
     - Watch status
     - Start/Stop/Renew buttons
   - Theme toggle (dark/light mode)
   - About section with version

3. src/components/MagicFolderSetup.jsx:
   - Explains what magic folders are
   - Shows which folders will be created
   - Confirm button to create them

4. src/contexts/ThemeContext.jsx - Theme state (copy from Chops)
5. src/constants/themes.js - Theme definitions (copy from Chops)

Update App.jsx to include ThemeContext.
```

### Session 12: Frontend - Polish and Build

```
Polish the AutoSort app and prepare for release.

1. Add keyboard shortcuts:
   - src/hooks/useKeyboardShortcuts.js
   - Cmd/Ctrl+R to refresh
   - Cmd/Ctrl+N to create new rule
   - Escape to close modals

2. Add error boundaries and better error handling

3. Create app icons:
   - src-tauri/icons/ with all required sizes
   - Use a mail/sort themed icon

4. Update src-tauri/tauri.conf.json:
   - Set proper app identifier
   - Configure window size and title
   - Set minimum macOS version

5. Create README.md with:
   - App description
   - Screenshots
   - Installation instructions
   - Development setup
   - How magic folders work

6. Test the build:
   - npm run tauri:build
   - Test on macOS
   - Verify OAuth flow works in production build

7. Create first release:
   - Tag version v1.0.0
   - Push to trigger GitHub Actions build
```

---

## Appendix: Quick Reference

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /auth/login | Get OAuth URL |
| POST | /auth/callback | Exchange code for tokens |
| POST | /auth/refresh | Refresh access token |
| GET | /api/v1/rules | List rules |
| POST | /api/v1/rules | Create rule |
| GET | /api/v1/rules/{id} | Get rule |
| PUT | /api/v1/rules/{id} | Update rule |
| DELETE | /api/v1/rules/{id} | Delete rule |
| GET | /api/v1/labels | List Gmail labels |
| GET | /api/v1/magic-folders | List magic folders |
| POST | /api/v1/magic-folders/setup | Create magic folders |
| GET | /api/v1/stats | Get statistics |
| POST | /api/v1/watch/start | Start Gmail watch |
| POST | /api/v1/watch/stop | Stop Gmail watch |
| POST | /api/v1/watch/renew | Renew Gmail watch |
| POST | /webhooks/gmail | Gmail push notifications |

### Environment Variables

**Backend:**
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `OAUTH_REDIRECT_URI` - OAuth callback URL (default: http://localhost:9876/callback)

**Frontend:**
- `VITE_API_URL` - Backend API URL

### Useful Commands

```bash
# Backend
gcloud run logs read autosort-backend --region=us-central1
gcloud run services describe autosort-backend --region=us-central1

# Frontend
npm run tauri:dev      # Development
npm run tauri:build    # Production build

# Gmail watch (must renew every 7 days)
curl -X POST https://YOUR_BACKEND/api/v1/watch/renew -H "Authorization: Bearer TOKEN"
```
