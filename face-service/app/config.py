"""
Environment configuration for the face recognition service.

All settings are loaded from environment variables with sensible defaults.
DATABASE_URL is the only required variable.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://gymuser:gympass@localhost:5432/gym_saas",
    )
    FACE_MODEL_NAME: str = os.environ.get("FACE_MODEL_NAME", "buffalo_l")
    MATCH_THRESHOLD: float = float(os.environ.get("MATCH_THRESHOLD", "0.45"))
    PORT: int = int(os.environ.get("PORT", "8001"))
    HOST: str = os.environ.get("HOST", "0.0.0.0")

    # Connection pool sizing
    DB_POOL_MIN: int = int(os.environ.get("DB_POOL_MIN", "2"))
    DB_POOL_MAX: int = int(os.environ.get("DB_POOL_MAX", "10"))


settings = Settings()
