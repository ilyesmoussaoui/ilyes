"""
Pydantic request/response models for the face recognition API.

These schemas enforce strict validation at the API boundary.

Error responses follow a consistent structured shape:

    {
        "success": false,
        "error": "MULTIPLE_FACES",
        "hint": "Please step forward so only one face is in frame."
    }

See ``app/services/edge_cases.EdgeCaseCode`` for the full enum of
``error`` values that may be returned.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ────────────────────────────────────────────
# Request schemas
# ────────────────────────────────────────────

class EnrollRequest(BaseModel):
    """Enroll a member's face embedding."""
    member_id: str = Field(
        ...,
        description="UUID of the member to enroll",
        min_length=36,
        max_length=36,
    )
    image_base64: str = Field(
        ...,
        description="Base64-encoded JPEG/PNG image containing a face",
        min_length=1,
    )


class MatchRequest(BaseModel):
    """Match a face against enrolled embeddings."""
    image_base64: str = Field(
        ...,
        description="Base64-encoded JPEG/PNG image containing a face",
        min_length=1,
    )
    threshold: float = Field(
        default=0.45,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity to consider a match",
    )


# ────────────────────────────────────────────
# Response schemas
# ────────────────────────────────────────────

class EnrollResponse(BaseModel):
    """Response for an enrollment attempt."""
    success: bool
    embedding_id: Optional[str] = None
    error: Optional[str] = Field(
        default=None,
        description="Structured error code (see EdgeCaseCode).",
    )
    hint: Optional[str] = Field(
        default=None,
        description="Human-readable hint for the end-user.",
    )


class MatchResult(BaseModel):
    """A single match result with confidence score."""
    member_id: str
    confidence: float
    embedding_id: str


class MatchResponse(BaseModel):
    """Response for a match attempt."""
    success: bool
    match: Optional[MatchResult] = None
    error: Optional[str] = Field(
        default=None,
        description="Structured error code (see EdgeCaseCode).",
    )
    hint: Optional[str] = Field(
        default=None,
        description="Human-readable hint for the end-user.",
    )


class DeleteResponse(BaseModel):
    """Response for embedding deletion."""
    success: bool
    deleted_count: int = 0


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    model_version: Optional[str] = None
    embeddings_count: int = 0
