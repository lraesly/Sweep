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
