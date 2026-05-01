"""
Face matching endpoint.

Accepts a base64-encoded face image, extracts its embedding, and compares
it against all stored embeddings using a pre-normalized in-memory matrix.

Edge-case codes (see ``app/services/edge_cases.py``) are surfaced to the
client as a structured ``{"error": CODE, "hint": "..."}`` payload so the
UI can render actionable feedback.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException

from app.models.schemas import MatchRequest, MatchResponse, MatchResult
from app.services import face, gallery_cache
from app.services.edge_cases import EdgeCaseCode, EdgeCaseResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/match", response_model=MatchResponse)
async def match_face(req: MatchRequest) -> MatchResponse:
    """
    Match a face against all enrolled embeddings.

    Pipeline:
        1. Guard: model must be loaded.
        2. Detect + edge-case assess the probe image.
        3. Run cosine similarity against the cached gallery matrix.
        4. Return the best hit if it exceeds the threshold.

    Performance: p95 < 2 s with 500 members on commodity hardware.
    """
    if not face.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="Face recognition model is not loaded yet. Try again shortly.",
        )

    t0 = time.monotonic()

    # --- Detection + edge-case assessment --------------------------------
    try:
        result = face.analyze_image(req.image_base64)
    except ValueError as exc:
        logger.warning("Match failed — invalid image: %s", exc)
        return MatchResponse(
            success=False,
            error=EdgeCaseCode.INVALID_IMAGE.value,
            hint=str(exc),
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Match failed — unexpected error: %s", exc, exc_info=True)
        return MatchResponse(
            success=False,
            error="INTERNAL_ERROR",
            hint="Internal error during face detection.",
        )

    if isinstance(result, EdgeCaseResult):
        return MatchResponse(
            success=False,
            error=result.code.value if result.code else "UNKNOWN",
            hint=result.hint,
        )

    probe, chosen = result

    # --- Match against the cached gallery --------------------------------
    snapshot = gallery_cache.get_snapshot()
    if snapshot.size == 0:
        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info("Match attempted but gallery is empty (%.1f ms).", elapsed_ms)
        return MatchResponse(success=True, match=None)

    hit = gallery_cache.match(probe, req.threshold)
    elapsed_ms = (time.monotonic() - t0) * 1000

    if hit is None:
        logger.info(
            "Match: no hit above threshold %.2f in %.1f ms (gallery=%d, score=%s)",
            req.threshold, elapsed_ms, snapshot.size,
            f"{chosen.det_score:.2f}",
        )
        return MatchResponse(success=True, match=None)

    logger.info(
        "Match: member=%s score=%.4f in %.1f ms (gallery=%d)",
        hit.member_id, hit.score, elapsed_ms, snapshot.size,
    )
    return MatchResponse(
        success=True,
        match=MatchResult(
            member_id=hit.member_id,
            confidence=round(hit.score, 4),
            embedding_id=hit.embedding_id,
        ),
    )
