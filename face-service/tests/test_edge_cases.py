"""
Unit tests for the edge-case detection pipeline.

These tests exercise the pure-logic functions in
``app.services.edge_cases`` with synthetic arrays so they can run
without the InsightFace model (which is ~300 MB and slow to load).
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.edge_cases import (
    EDGE_CASE_HINTS,
    EdgeCaseCode,
    FaceCandidate,
    assess_frame,
    check_liveness_burst,
    check_lighting,
    compute_luminance_stats,
    select_best_face,
)


# ────────────────────────────────────────────
# Test fixtures
# ────────────────────────────────────────────

def _mid_gray_image(h: int = 480, w: int = 640, value: int = 128) -> np.ndarray:
    """Uniform gray BGR image, safely inside the ``good lighting`` band."""
    img = np.full((h, w, 3), value, dtype=np.uint8)
    # Nudge one pixel so std > 10 (flat-image guard).
    img[0, 0] = (0, 0, 0)
    img[-1, -1] = (255, 255, 255)
    return img


def _textured_image(h: int = 480, w: int = 640, mean: int = 128) -> np.ndarray:
    """Image with real pixel variance (std ~ 40) for lighting checks."""
    rng = np.random.default_rng(seed=42)
    noise = rng.normal(loc=0.0, scale=40.0, size=(h, w, 3))
    img = np.clip(mean + noise, 0, 255).astype(np.uint8)
    return img


def _face(
    x1: float, y1: float, x2: float, y2: float,
    det_score: float = 0.9,
    landmark_count: int = 106,
    embedding: np.ndarray | None = None,
) -> FaceCandidate:
    if embedding is None:
        embedding = np.random.default_rng(0).normal(size=512).astype(np.float32)
        embedding /= np.linalg.norm(embedding)
    return FaceCandidate(
        bbox=(x1, y1, x2, y2),
        det_score=det_score,
        landmark_count=landmark_count,
        embedding=embedding,
    )


# ────────────────────────────────────────────
# Enum / hints
# ────────────────────────────────────────────

class TestEnum:
    def test_every_code_has_a_hint(self):
        for code in EdgeCaseCode:
            assert code in EDGE_CASE_HINTS
            assert EDGE_CASE_HINTS[code]

    def test_enum_values_are_stable_strings(self):
        # These strings are part of the public API contract.
        assert EdgeCaseCode.NO_FACE.value == "NO_FACE"
        assert EdgeCaseCode.MULTIPLE_FACES.value == "MULTIPLE_FACES"
        assert EdgeCaseCode.POOR_LIGHTING.value == "POOR_LIGHTING"
        assert EdgeCaseCode.FACE_PARTIAL.value == "FACE_PARTIAL"
        assert EdgeCaseCode.POSSIBLE_SPOOF.value == "POSSIBLE_SPOOF"
        assert EdgeCaseCode.INVALID_IMAGE.value == "INVALID_IMAGE"


# ────────────────────────────────────────────
# Luminance / lighting
# ────────────────────────────────────────────

class TestLighting:
    def test_good_lighting_passes(self):
        img = _textured_image(mean=128)
        assert check_lighting(img) is None

    def test_nearly_black_image_flagged(self):
        img = np.full((100, 100, 3), 5, dtype=np.uint8)
        result = check_lighting(img)
        assert result is not None
        assert result.code == EdgeCaseCode.POOR_LIGHTING

    def test_nearly_white_image_flagged(self):
        img = np.full((100, 100, 3), 250, dtype=np.uint8)
        result = check_lighting(img)
        assert result is not None
        assert result.code == EdgeCaseCode.POOR_LIGHTING

    def test_flat_image_flagged(self):
        # Perfectly uniform image => std=0, triggers the flat-image guard.
        img = np.full((100, 100, 3), 128, dtype=np.uint8)
        result = check_lighting(img)
        assert result is not None
        assert result.code == EdgeCaseCode.POOR_LIGHTING

    def test_histogram_clipped_dark_flagged(self):
        img = _textured_image(mean=128)
        # Force >85% of pixels into the dark bin.
        img[: int(img.shape[0] * 0.9)] = 0
        result = check_lighting(img)
        assert result is not None
        assert result.code == EdgeCaseCode.POOR_LIGHTING

    def test_luminance_stats_matches_numpy(self):
        img = _textured_image(mean=100)
        stats = compute_luminance_stats(img)
        # Our Y = 0.299R + 0.587G + 0.114B. Sanity check against the
        # grayscale projection we compute manually.
        r = img[..., 2].astype(np.float32)
        g = img[..., 1].astype(np.float32)
        b = img[..., 0].astype(np.float32)
        expected_mean = float((0.299 * r + 0.587 * g + 0.114 * b).mean())
        assert stats.mean == pytest.approx(expected_mean, rel=1e-5)

    def test_hint_is_user_facing(self):
        result = check_lighting(np.zeros((100, 100, 3), dtype=np.uint8))
        assert result is not None
        assert "light" in (result.hint or "").lower()


# ────────────────────────────────────────────
# Face selection
# ────────────────────────────────────────────

class TestSelectBestFace:
    def test_no_face_returns_no_face(self):
        result = select_best_face([])
        assert result.code == EdgeCaseCode.NO_FACE

    def test_single_clean_face_passes(self):
        face = _face(0, 0, 200, 200)
        result = select_best_face([face])
        assert result.code is None
        assert result.chosen_face is face

    def test_largest_face_is_picked(self):
        small = _face(0, 0, 50, 50)
        medium = _face(0, 0, 100, 100)
        large = _face(0, 0, 300, 300)
        result = select_best_face([small, medium, large])
        assert result.code is None
        assert result.chosen_face is large

    def test_tied_faces_return_multiple(self):
        # Two faces with nearly identical areas — within 10%.
        a = _face(0, 0, 200, 200)       # area 40_000
        b = _face(300, 0, 495, 200)     # area 39_000 (within 10%)
        result = select_best_face([a, b])
        assert result.code == EdgeCaseCode.MULTIPLE_FACES

    def test_clearly_dominant_face_does_not_tie(self):
        # Second face is < 80% of the largest — not a tie.
        primary = _face(0, 0, 300, 300)   # area 90_000
        tiny = _face(400, 0, 500, 100)    # area 10_000
        result = select_best_face([primary, tiny])
        assert result.code is None
        assert result.chosen_face is primary

    def test_low_landmark_count_flagged_partial(self):
        face = _face(0, 0, 200, 200, landmark_count=3)
        result = select_best_face([face])
        assert result.code == EdgeCaseCode.FACE_PARTIAL

    def test_low_confidence_flagged_partial(self):
        face = _face(0, 0, 200, 200, det_score=0.35)
        result = select_best_face([face])
        assert result.code == EdgeCaseCode.FACE_PARTIAL

    def test_tie_ratio_is_configurable(self):
        a = _face(0, 0, 200, 200)
        b = _face(0, 0, 180, 180)   # 81% of a's area
        # With default 10% tie window, not a tie.
        assert select_best_face([a, b]).code is None
        # With a 25% tie window, it IS a tie.
        result = select_best_face([a, b], tie_ratio=0.25)
        assert result.code == EdgeCaseCode.MULTIPLE_FACES

    def test_zero_area_face_treated_as_no_face(self):
        face = _face(10, 10, 10, 10)  # zero area
        result = select_best_face([face])
        assert result.code == EdgeCaseCode.NO_FACE


# ────────────────────────────────────────────
# Full assess_frame pipeline
# ────────────────────────────────────────────

class TestAssessFrame:
    def test_happy_path(self):
        img = _textured_image()
        face = _face(0, 0, 200, 200)
        result = assess_frame(img, [face])
        assert result.code is None
        assert result.chosen_face is face

    def test_lighting_short_circuits_face_check(self):
        # All-black image with a detected face — lighting runs first.
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        face = _face(0, 0, 50, 50)
        result = assess_frame(img, [face])
        assert result.code == EdgeCaseCode.POOR_LIGHTING

    def test_no_face_after_good_lighting(self):
        img = _textured_image()
        result = assess_frame(img, [])
        assert result.code == EdgeCaseCode.NO_FACE

    def test_multiple_faces_after_good_lighting(self):
        img = _textured_image()
        faces = [
            _face(0, 0, 200, 200),
            _face(300, 0, 495, 200),  # tied within 10%
        ]
        result = assess_frame(img, faces)
        assert result.code == EdgeCaseCode.MULTIPLE_FACES

    def test_partial_face_after_good_lighting(self):
        img = _textured_image()
        face = _face(0, 0, 200, 200, landmark_count=2)
        result = assess_frame(img, [face])
        assert result.code == EdgeCaseCode.FACE_PARTIAL


# ────────────────────────────────────────────
# Optional: burst-based liveness
# ────────────────────────────────────────────

class TestLiveness:
    def test_identical_embeddings_flag_spoof(self):
        # A still photo would produce near-identical embeddings across
        # frames of a short burst.
        rng = np.random.default_rng(1)
        base = rng.normal(size=512).astype(np.float32)
        base /= np.linalg.norm(base)
        burst = [base.copy() for _ in range(5)]
        result = check_liveness_burst(burst)
        assert result is not None
        assert result.code == EdgeCaseCode.POSSIBLE_SPOOF

    def test_varying_embeddings_pass(self):
        rng = np.random.default_rng(1)
        burst = []
        for _ in range(5):
            v = rng.normal(size=512).astype(np.float32)
            v /= np.linalg.norm(v)
            burst.append(v)
        assert check_liveness_burst(burst) is None

    def test_single_frame_does_not_block(self):
        # Can't decide with a single frame — treat as unknown, not spoof.
        rng = np.random.default_rng(1)
        v = rng.normal(size=512).astype(np.float32)
        assert check_liveness_burst([v]) is None
