"""
Embedding management endpoint.

Provides soft-delete for a member's face embeddings and refreshes the
in-memory gallery cache so ``/match`` no longer sees the removed rows.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.models.schemas import DeleteResponse
from app.services import database, gallery_cache

logger = logging.getLogger(__name__)
router = APIRouter()


@router.delete("/embeddings/{member_id}", response_model=DeleteResponse)
async def delete_embeddings(member_id: str) -> DeleteResponse:
    """
    Soft-delete all face embeddings for a member, then refresh the
    gallery cache.
    """
    try:
        deleted_count = database.soft_delete_member_embeddings(member_id)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Failed to delete embeddings for member %s: %s",
            member_id, exc, exc_info=True,
        )
        return DeleteResponse(success=False, deleted_count=0)

    # Keep the cache honest. A stale hit against a deleted embedding
    # would be a security issue (deleted users could still check in).
    try:
        gallery_cache.refresh_from_database()
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Cache refresh failed after deleting embeddings for %s: %s",
            member_id, exc, exc_info=True,
        )

    logger.info(
        "Soft-deleted %d embedding(s) for member %s",
        deleted_count, member_id,
    )
    return DeleteResponse(success=True, deleted_count=deleted_count)
