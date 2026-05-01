"""
Health check endpoint.

Returns model load status and active embedding count.
"""

import logging

from fastapi import APIRouter

from app.models.schemas import HealthResponse
from app.services import database, face

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Report service health: model status and embedding count.

    This endpoint never fails with a 5xx — it always returns a 200
    with the current status so load balancers can make informed decisions.
    """
    model_loaded = face.is_model_loaded()
    model_version = face.get_model_name() if model_loaded else None
    embeddings_count = 0

    try:
        embeddings_count = database.count_active_embeddings()
    except Exception as exc:
        logger.warning("Health check: failed to count embeddings: %s", exc)

    return HealthResponse(
        status="ok" if model_loaded else "degraded",
        model_loaded=model_loaded,
        model_version=model_version,
        embeddings_count=embeddings_count,
    )
