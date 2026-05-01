"""
Face enrollment endpoint.

Accepts a member_id and a base64-encoded face image, extracts the 512-dim
embedding, soft-deletes any prior embeddings for that member, stores the
new one, and refreshes the in-memory gallery cache.

Edge-case codes (see ``app/services/edge_cases.py``) flow through to the
response as a structured ``{"error": CODE, "hint": "..."}`` payload.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import EnrollRequest, EnrollResponse
from app.services import database, face, gallery_cache
from app.services.edge_cases import EdgeCaseCode, EdgeCaseResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/enroll", response_model=EnrollResponse)
async def enroll_face(req: EnrollRequest) -> EnrollResponse:
    """
    Enroll a member's face.

    1. Guard: model must be loaded (503 if not).
    2. Detect + edge-case assess the image.
    3. Soft-delete existing embeddings for the member.
    4. Insert the new embedding.
    5. Refresh the gallery cache so /match sees the new row immediately.
    """
    if not face.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="Face recognition model is not loaded yet. Try again shortly.",
        )

    # --- Detection + quality gates ---------------------------------------
    try:
        result = face.analyze_image(req.image_base64)
    except ValueError as exc:
        logger.warning("Enroll failed — invalid image for %s: %s", req.member_id, exc)
        return EnrollResponse(
            success=False,
            error=EdgeCaseCode.INVALID_IMAGE.value,
            hint=str(exc),
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Enroll failed — unexpected error for %s: %s",
            req.member_id, exc, exc_info=True,
        )
        return EnrollResponse(
            success=False,
            error="INTERNAL_ERROR",
            hint="Internal error during face detection.",
        )

    if isinstance(result, EdgeCaseResult):
        return EnrollResponse(
            success=False,
            error=result.code.value if result.code else "UNKNOWN",
            hint=result.hint,
        )

    embedding, _ = result

    # --- Persist ---------------------------------------------------------
    try:
        deleted = database.soft_delete_member_embeddings(req.member_id)
        if deleted > 0:
            logger.info(
                "Soft-deleted %d prior embedding(s) for member %s",
                deleted, req.member_id,
            )

        embedding_id = database.insert_embedding(
            member_id=req.member_id,
            embedding=embedding,
            model_version=face.get_model_name(),
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Enroll failed — database error for %s: %s",
            req.member_id, exc, exc_info=True,
        )
        return EnrollResponse(
            success=False,
            error="DATABASE_ERROR",
            hint="Database error during enrollment.",
        )

    # --- Refresh cache ---------------------------------------------------
    try:
        gallery_cache.refresh_from_database()
    except Exception as exc:  # noqa: BLE001
        # Not fatal — match will fall back to the previous snapshot
        # (or re-load on next enroll). Log loudly.
        logger.error(
            "Enroll: cache refresh failed after inserting %s: %s",
            embedding_id, exc, exc_info=True,
        )

    logger.info("Enrolled embedding %s for member %s", embedding_id, req.member_id)
    return EnrollResponse(success=True, embedding_id=embedding_id)
