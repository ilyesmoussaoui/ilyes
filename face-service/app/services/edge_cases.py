"""
Edge case detection for face input quality.

This module classifies a decoded image (and, optionally, the list of
detected faces returned by InsightFace) into one of several quality
buckets so that the API can return a structured, actionable error
to the client instead of a silent "no match".

Design notes
------------
* Pure-logic: every function here takes only numpy arrays / simple
  dataclasses so the tests can exercise the logic without loading
  the 300 MB InsightFace model.
* Thresholds are tuned conservatively to avoid false positives on
  well-lit, straightforward captures (the common case).
* All error codes live in the ``EdgeCaseCode`` enum and every code
  has a ready-to-display hint in ``EDGE_CASE_HINTS``.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, List, Optional, Sequence, Tuple

import numpy as np


# ────────────────────────────────────────────
# Public error codes
# ────────────────────────────────────────────

class EdgeCaseCode(str, Enum):
    """
    Structured error codes returned to clients when the capture is
    unusable. Each code has a matching hint in :data:`EDGE_CASE_HINTS`.
    """

    NO_FACE = "NO_FACE"
    MULTIPLE_FACES = "MULTIPLE_FACES"
    POOR_LIGHTING = "POOR_LIGHTING"
    FACE_PARTIAL = "FACE_PARTIAL"
    POSSIBLE_SPOOF = "POSSIBLE_SPOOF"
    INVALID_IMAGE = "INVALID_IMAGE"


EDGE_CASE_HINTS: dict[EdgeCaseCode, str] = {
    EdgeCaseCode.NO_FACE: (
        "We could not find a face. Please look directly at the camera."
    ),
    EdgeCaseCode.MULTIPLE_FACES: (
        "Please step forward so only one face is in frame."
    ),
    EdgeCaseCode.POOR_LIGHTING: (
        "The lighting is too dark or too bright. Please move to a "
        "well-lit area and try again."
    ),
    EdgeCaseCode.FACE_PARTIAL: (
        "Your face is partially out of frame or obscured. Please look "
        "straight at the camera and remove any obstructions."
    ),
    EdgeCaseCode.POSSIBLE_SPOOF: (
        "Liveness check failed. Please look at the camera directly "
        "instead of presenting a photo."
    ),
    EdgeCaseCode.INVALID_IMAGE: (
        "The image could not be read. Please try a different photo."
    ),
}


# ────────────────────────────────────────────
# Tunable thresholds
# ────────────────────────────────────────────

# Luminance (mean of grayscale 0-255) outside this band → POOR_LIGHTING.
LUMA_MIN: float = 40.0
LUMA_MAX: float = 220.0

# Histogram coverage — if >85% of pixels cluster in the bottom or top
# 10% of the intensity range, the image is effectively black / white.
HIST_CLIP_RATIO: float = 0.85
HIST_DARK_BIN_FRAC: float = 0.10
HIST_BRIGHT_BIN_FRAC: float = 0.90

# Tie window for multi-face disambiguation.
# If two faces have bbox areas within 10% of the largest → MULTIPLE_FACES.
MULTI_FACE_TIE_RATIO: float = 0.10

# InsightFace returns 5 or 106 landmarks. Below this → FACE_PARTIAL.
MIN_LANDMARKS: int = 5
MIN_DETECTION_CONFIDENCE: float = 0.55

# Burst-based liveness: if the L2 variance of aligned embeddings across
# a short burst is below this, treat as a still photo.
LIVENESS_MIN_EMBEDDING_VARIANCE: float = 1e-4


# ────────────────────────────────────────────
# Data containers
# ────────────────────────────────────────────

@dataclass(frozen=True)
class FaceCandidate:
    """
    A lightweight mirror of an InsightFace ``Face`` object with only
    the fields we care about. Using a dataclass lets tests construct
    candidates without needing insightface installed.
    """

    bbox: Tuple[float, float, float, float]   # (x1, y1, x2, y2)
    det_score: float
    landmark_count: int
    embedding: Optional[np.ndarray] = None

    @property
    def area(self) -> float:
        x1, y1, x2, y2 = self.bbox
        return max(0.0, (x2 - x1)) * max(0.0, (y2 - y1))


@dataclass(frozen=True)
class LuminanceStats:
    """Summary stats used by :func:`check_lighting`."""

    mean: float
    std: float
    dark_fraction: float    # fraction of pixels with value < 25
    bright_fraction: float  # fraction of pixels with value > 230


@dataclass(frozen=True)
class EdgeCaseResult:
    """
    Outcome of a quality check.

    ``code`` is ``None`` when the frame is usable; in that case
    ``chosen_face`` holds the selected :class:`FaceCandidate`.
    """

    code: Optional[EdgeCaseCode]
    hint: Optional[str] = None
    chosen_face: Optional[FaceCandidate] = None
    detail: Optional[dict[str, Any]] = None


# ────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────

def _as_result(code: EdgeCaseCode, detail: Optional[dict] = None) -> EdgeCaseResult:
    return EdgeCaseResult(
        code=code, hint=EDGE_CASE_HINTS[code], detail=detail,
    )


def compute_luminance_stats(image_bgr: np.ndarray) -> LuminanceStats:
    """
    Reduce a BGR image to a handful of luminance statistics.

    Uses the ITU-R BT.601 coefficients via OpenCV's standard Y channel
    approximation (0.299 R + 0.587 G + 0.114 B) applied directly on
    the numpy array to avoid an OpenCV dependency in the unit tests.
    """
    if image_bgr.ndim == 2:
        gray = image_bgr.astype(np.float32)
    else:
        b = image_bgr[..., 0].astype(np.float32)
        g = image_bgr[..., 1].astype(np.float32)
        r = image_bgr[..., 2].astype(np.float32)
        gray = 0.299 * r + 0.587 * g + 0.114 * b

    total = gray.size
    dark = float(np.count_nonzero(gray < 25)) / total
    bright = float(np.count_nonzero(gray > 230)) / total
    return LuminanceStats(
        mean=float(gray.mean()),
        std=float(gray.std()),
        dark_fraction=dark,
        bright_fraction=bright,
    )


def check_lighting(image_bgr: np.ndarray) -> Optional[EdgeCaseResult]:
    """
    Return a POOR_LIGHTING result if the image is too dark, too bright,
    too low-contrast, or clipped into extremes. Returns ``None`` if the
    lighting is acceptable.
    """
    stats = compute_luminance_stats(image_bgr)

    if stats.mean < LUMA_MIN or stats.mean > LUMA_MAX:
        return _as_result(
            EdgeCaseCode.POOR_LIGHTING,
            detail={"luminance_mean": stats.mean},
        )

    # Near-flat image (std near zero) — nothing the model can latch onto.
    if stats.std < 10.0:
        return _as_result(
            EdgeCaseCode.POOR_LIGHTING,
            detail={"luminance_std": stats.std},
        )

    # Histogram clipped into one extreme.
    if stats.dark_fraction > HIST_CLIP_RATIO or stats.bright_fraction > HIST_CLIP_RATIO:
        return _as_result(
            EdgeCaseCode.POOR_LIGHTING,
            detail={
                "dark_fraction": stats.dark_fraction,
                "bright_fraction": stats.bright_fraction,
            },
        )

    return None


def select_best_face(
    faces: Sequence[FaceCandidate],
    tie_ratio: float = MULTI_FACE_TIE_RATIO,
) -> EdgeCaseResult:
    """
    Pick the largest face by bbox area. If a second face has an area
    within ``tie_ratio`` of the largest, return MULTIPLE_FACES so the
    caller can ask the user to step forward.

    Also returns FACE_PARTIAL when the chosen face has fewer landmarks
    than :data:`MIN_LANDMARKS` or a detection confidence below
    :data:`MIN_DETECTION_CONFIDENCE`.
    """
    if not faces:
        return _as_result(EdgeCaseCode.NO_FACE)

    sorted_faces = sorted(faces, key=lambda f: f.area, reverse=True)
    largest = sorted_faces[0]

    if largest.area <= 0:
        return _as_result(EdgeCaseCode.NO_FACE)

    if len(sorted_faces) >= 2:
        second = sorted_faces[1]
        # "Within 10%" means the smaller is >= (1 - tie_ratio) of the larger.
        if second.area >= largest.area * (1.0 - tie_ratio):
            return _as_result(
                EdgeCaseCode.MULTIPLE_FACES,
                detail={
                    "face_count": len(faces),
                    "largest_area": largest.area,
                    "runner_up_area": second.area,
                },
            )

    if largest.landmark_count < MIN_LANDMARKS:
        return _as_result(
            EdgeCaseCode.FACE_PARTIAL,
            detail={"landmark_count": largest.landmark_count},
        )

    if largest.det_score < MIN_DETECTION_CONFIDENCE:
        return _as_result(
            EdgeCaseCode.FACE_PARTIAL,
            detail={"det_score": largest.det_score},
        )

    return EdgeCaseResult(code=None, chosen_face=largest)


def assess_frame(
    image_bgr: np.ndarray,
    faces: Sequence[FaceCandidate],
) -> EdgeCaseResult:
    """
    Run the full edge-case pipeline against a decoded frame.

    Order of checks:
      1. POOR_LIGHTING (before we trust the detector)
      2. NO_FACE / MULTIPLE_FACES / FACE_PARTIAL (detector-driven)

    Returns an :class:`EdgeCaseResult`; ``code`` is ``None`` when the
    frame is usable and ``chosen_face`` holds the selected face.
    """
    lighting = check_lighting(image_bgr)
    if lighting is not None:
        return lighting

    return select_best_face(faces)


# ────────────────────────────────────────────
# Optional: burst-based liveness
# ────────────────────────────────────────────

def check_liveness_burst(embeddings: List[np.ndarray]) -> Optional[EdgeCaseResult]:
    """
    Very cheap liveness heuristic for a short burst of N embeddings.

    A real, moving face produces tiny but measurable frame-to-frame
    variation in the embedding. A static photo held up to the camera
    produces near-zero variation.

    Returns POSSIBLE_SPOOF when variance is below the threshold.

    Out-of-scope cases (documented in README.md):
      - Video replay attacks (would need eye-blink detection).
      - 3D masks (would need IR / depth sensor).
    """
    if len(embeddings) < 2:
        # Can't decide — don't block.
        return None

    stacked = np.stack(embeddings, axis=0)   # (N, 512)
    # Mean-center and compute total variance.
    centered = stacked - stacked.mean(axis=0, keepdims=True)
    variance = float(np.mean(centered ** 2))

    if variance < LIVENESS_MIN_EMBEDDING_VARIANCE:
        return _as_result(
            EdgeCaseCode.POSSIBLE_SPOOF,
            detail={"embedding_variance": variance},
        )

    return None
