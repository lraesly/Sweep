from datetime import datetime, timezone
from google.oauth2.credentials import Credentials
from google.cloud import firestore

from app.config import get_settings

settings = get_settings()
db = firestore.AsyncClient(project=settings.project_id)


async def store_user_credentials(
    user_email: str,
    credentials: Credentials
) -> None:
    """Store user credentials in Firestore."""
    doc_ref = db.collection("users").document(user_email)

    await doc_ref.set({
        "email": user_email,
        "access_token": credentials.token,  # Top-level for easier querying
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
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"Looking up user by token: {access_token[:20]}...")

    # Query users collection for matching token (using top-level field)
    query = db.collection("users").where("access_token", "==", access_token)

    async for doc in query.stream():
        data = doc.to_dict()
        logger.info(f"Found user: {data.get('email')}")
        credentials = await get_user_credentials(data["email"])
        if credentials:
            return {
                "email": data["email"],
                "credentials": credentials
            }

    logger.warning("No user found for token")
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
