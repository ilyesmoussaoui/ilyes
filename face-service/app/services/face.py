"""
Face detection and embedding extraction service using InsightFace.

The model is loaded once during application startup and reused for all
requests. This avoids the ~2s model load penalty per request.

The module exposes both a legacy ``extract_embedding`` helper (preserved
for backwards compatibility) and an edge-case-aware ``analyze_image``
helper used by the matcher.
"""

from __future__ import annotations

import base64
import logging
from typing import Any, List, Optional, Tuple, Union

import cv2
import numpy as np

from app.services.edge_cases import (
    EdgeCaseCode,
    EdgeCaseResult,
    FaceCandidate,
    assess_frame,
)

logger = logging.getLogger(__name__)

# Module-level state — set during lifespan startup
_model = None
_model_name: Optional[str] = None


# ────────────────────────────────────────────
# Model lifecycle
# ────────────────────────────────────────────

def load_model(model_name: str) -> None:
    """
    Load the InsightFace recognition model.

    This downloads the model on first invocation (~300MB for buffalo_l)
    and caches it at INSIGHTFACE_HOME (default ~/.insightface/).

    Args:
        model_name: InsightFace model pack name (e.g. "buffalo_l").
    """
    global _model, _model_name

    # Deferred import so the module can be imported even if insightface
    # is missing (useful for unit tests with mocking).
    import insightface  # noqa: E402

    logger.info("Loading InsightFace model '%s' ...", model_name)
    _model = insightface.app.FaceAnalysis(
        name=model_name,
        providers=["CPUExecutionProvider"],
    )
    _model.prepare(ctx_id=0, det_size=(640, 640))
    _model_name = model_name
    logger.info("InsightFace model '%s' loaded successfully.", model_name)


def is_model_loaded() -> bool:
    """Return True if the model has been loaded and is ready."""
    return _model is not None


def get_model_name() -> Optional[str]:
    """Return the name of the currently loaded model, or None."""
    return _model_name


# Test-only hooks so unit tests can inject a fake detector without
# loading the 300 MB InsightFace model pack.

def _set_model_for_test(fake_model: Any, model_name: str = "test") -> None:
    """Install a fake model (used by unit tests only)."""
    global _model, _model_name
    _model = fake_model
    _model_name = model_name


def _reset_model_for_test() -> None:
    """Clear the installed model (used by unit tests only)."""
    global _model, _model_name
    _model = None
    _model_name = None


# ────────────────────────────────────────────
# Image decoding
# ────────────────────────────────────────────

def decode_base64_image(image_base64: str) -> np.ndarray:
    """
    Decode a base64 JPEG/PNG string into a BGR numpy array.

    Raises:
        ValueError: If the base64 payload cannot be decoded or the
            bytes do not form a valid image.
    """
    try:
        image_bytes = base64.b64decode(image_base64, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Invalid base64 data: {exc}") from exc

    np_buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image data — invalid or corrupt image")
    return img


# ────────────────────────────────────────────
# Detection adapter
# ────────────────────────────────────────────

def _to_candidates(raw_faces: List[Any]) -> List[FaceCandidate]:
    """
    Convert InsightFace ``Face`` objects into framework-agnostic
    :class:`FaceCandidate` instances so the edge-case logic can be
    tested without the real model.
    """
    candidates: List[FaceCandidate] = []
    for f in raw_faces:
        bbox = tuple(float(v) for v in f.bbox)  # type: ignore[attr-defined]
        det_score = float(getattr(f, "det_score", 0.0))
        landmarks = getattr(f, "landmark_2d_106", None)
        if landmarks is None:
            landmarks = getattr(f, "kps", None)
        landmark_count = 0 if landmarks is None else int(np.asarray(landmarks).shape[0])
        emb = getattr(f, "normed_embedding", None)
        if emb is None:
            emb = getattr(f, "embedding", None)
        embedding = None if emb is None else np.asarray(emb, dtype=np.float32)
        candidates.append(
            FaceCandidate(
                bbox=bbox,                     # type: ignore[arg-type]
                det_score=det_score,
                landmark_count=landmark_count,
                embedding=embedding,
            )
        )
    return candidates


def analyze_image(image_base64: str) -> Union[EdgeCaseResult, Tuple[np.ndarray, FaceCandidate]]:
    """
    Run the full detection + edge-case pipeline.

    Returns either:
      * An :class:`EdgeCaseResult` with a non-null ``code`` when the
        capture is unusable, or
      * A ``(embedding, chosen_face)`` tuple when a single usable face
        was found.

    Raises:
        RuntimeError: If the model has not been loaded yet.
        ValueError: If the base64/image payload is invalid
            (returned as INVALID_IMAGE by the route).
    """
    if _model is None:
        raise RuntimeError("Face model is not loaded")

    img = decode_base64_image(image_base64)
    raw_faces = _model.get(img)
    candidates = _to_candidates(raw_faces or [])

    verdict = assess_frame(img, candidates)
    if verdict.code is not None:
        return verdict

    chosen = verdict.chosen_face
    assert chosen is not None  # assess_frame guarantees this when code is None
    if chosen.embedding is None:
        # Model returned a face with no embedding — treat as partial.
        return EdgeCaseResult(
            code=EdgeCaseCode.FACE_PARTIAL,
            hint="Face detected but no embedding could be computed.",
        )

    return chosen.embedding.astype(np.float32, copy=False), chosen


# ────────────────────────────────────────────
# Legacy helper (kept for internal callers / existing tests)
# ────────────────────────────────────────────

def extract_embedding(image_base64: str) -> Optional[np.ndarray]:
    """
    Backwards-compatible helper.

    Returns the 512-dim embedding for the largest face, or ``None`` if
    any edge-case was hit (including NO_FACE). New code should prefer
    :func:`analyze_image`, which returns a structured reason.
    """
    result = analyze_image(image_base64)
    if isinstance(result, EdgeCaseResult):
        return None
    embedding, _ = result
    return embedding
