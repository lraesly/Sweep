import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials

from app.auth.tokens import store_user_credentials
from app.config import get_settings

logger = logging.getLogger(__name__)
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
    logger.info(f"Login request - redirect_uri: {settings.oauth_redirect_uri}")
    logger.info(f"Scopes: {settings.gmail_scopes}")

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

    logger.info(f"Generated auth URL, state: {state}")

    return {
        "authorization_url": authorization_url,
        "state": state
    }


@router.post("/callback", response_model=TokenResponse)
async def oauth_callback(request: TokenExchangeRequest):
    """Exchange authorization code for tokens."""
    logger.info(f"Callback request - redirect_uri: {request.redirect_uri}")
    logger.info(f"Code received: {request.code[:20]}..." if request.code else "No code")

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
        logger.info("Fetching token from Google...")
        flow.fetch_token(code=request.code)
        logger.info("Token fetched successfully")
    except Exception as e:
        logger.error(f"Token exchange failed: {e}")
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {e}")

    credentials = flow.credentials
    logger.info(f"Got credentials, has refresh_token: {bool(credentials.refresh_token)}")

    # Get user info to get user ID
    try:
        from googleapiclient.discovery import build
        service = build("oauth2", "v2", credentials=credentials)
        user_info = service.userinfo().get().execute()
        user_email = user_info["email"]
        logger.info(f"Got user email: {user_email}")
    except Exception as e:
        logger.error(f"Failed to get user info: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to get user info: {e}")

    # Store credentials in Firestore
    try:
        await store_user_credentials(
            user_email=user_email,
            credentials=credentials
        )
        logger.info("Credentials stored in Firestore")
    except Exception as e:
        logger.error(f"Failed to store credentials: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to store credentials: {e}")

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
