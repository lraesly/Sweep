import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Google Cloud
    project_id: str = os.getenv("GOOGLE_CLOUD_PROJECT", "autosort-prod")

    @property
    def pubsub_topic(self) -> str:
        return f"projects/{self.project_id}/topics/gmail-notifications"

    # OAuth
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    oauth_redirect_uri: str = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:9876/callback")

    # Gmail API scopes
    gmail_scopes: list[str] = [
        "openid",  # Required - Google adds this automatically
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    # Magic folder prefix
    magic_folder_prefix: str = "@AutoSort"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
