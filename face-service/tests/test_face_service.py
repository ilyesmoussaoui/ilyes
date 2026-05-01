"""
Integration-style tests for ``app.services.face.analyze_image``.

These tests inject a fake InsightFace model into the ``face`` module so
we can exercise the detection-to-edge-case glue without downloading the
300 MB model pack. They verify:

  * valid base64 → happy path returns (embedding, face)
  * multiple faces → MULTIPLE_FACES code
  * no face → NO_FACE code
  * partial face → FACE_PARTIAL code
  * black image → POOR_LIGHTING code (before the model even runs)
  * invalid base64 → ValueError → route-level INVALID_IMAGE
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import List

import cv2
import numpy as np
import pytest

from app.services import face
from app.services.edge_cases import EdgeCaseCode, EdgeCaseResult


# ────────────────────────────────────────────
# Fake InsightFace face + model
# ────────────────────────────────────────────

@dataclass
class FakeFace:
    bbox: np.ndarray
    det_score: float
    kps: np.ndarray
    normed_embedding: np.ndarray


class FakeModel:
    """Returns a pre-programmed list of FakeFace objects from .get()."""

    def __init__(self, faces: List[FakeFace]) -> None:
        self.faces = faces
        self.calls = 0

    def get(self, _img: np.ndarray) -> List[FakeFace]:
        self.calls += 1
        return self.faces


def _make_face(
    bbox=(10.0, 10.0, 200.0, 200.0),
    det_score: float = 0.95,
    num_kps: int = 5,
) -> FakeFace:
    rng = np.random.default_rng(seed=0)
    emb = rng.normal(size=512).astype(np.float32)
    emb /= np.linalg.norm(emb)
    return FakeFace(
        bbox=np.array(bbox, dtype=np.float32),
        det_score=det_score,
        kps=np.zeros((num_kps, 2), dtype=np.float32),
        normed_embedding=emb,
    )


def _jpg_b64(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return base64.b64encode(buf.tobytes()).decode("ascii")


# ────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_model():
    face._reset_model_for_test()
    yield
    face._reset_model_for_test()


@pytest.fixture
def good_image_b64() -> str:
    """A textured, well-lit JPEG."""
    rng = np.random.default_rng(7)
    img = np.clip(128 + rng.normal(0, 40, (480, 640, 3)), 0, 255).astype(np.uint8)
    return _jpg_b64(img)


@pytest.fixture
def dark_image_b64() -> str:
    return _jpg_b64(np.full((480, 640, 3), 5, dtype=np.uint8))


# ────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────

class TestAnalyzeImage:
    def test_happy_path_returns_embedding(self, good_image_b64):
        face._set_model_for_test(FakeModel([_make_face()]))
        result = face.analyze_image(good_image_b64)
        assert not isinstance(result, EdgeCaseResult)
        embedding, chosen = result
        assert embedding.shape == (512,)
        assert embedding.dtype == np.float32
        assert chosen.det_score > 0.5

    def test_no_face(self, good_image_b64):
        face._set_model_for_test(FakeModel([]))
        result = face.analyze_image(good_image_b64)
        assert isinstance(result, EdgeCaseResult)
        assert result.code == EdgeCaseCode.NO_FACE

    def test_multiple_faces(self, good_image_b64):
        # Two faces within 10% of each other → MULTIPLE_FACES.
        faces = [
            _make_face(bbox=(0.0, 0.0, 200.0, 200.0)),
            _make_face(bbox=(300.0, 0.0, 495.0, 200.0)),
        ]
        face._set_model_for_test(FakeModel(faces))
        result = face.analyze_image(good_image_b64)
        assert isinstance(result, EdgeCaseResult)
        assert result.code == EdgeCaseCode.MULTIPLE_FACES

    def test_partial_face_low_landmarks(self, good_image_b64):
        face._set_model_for_test(FakeModel([_make_face(num_kps=2)]))
        result = face.analyze_image(good_image_b64)
        assert isinstance(result, EdgeCaseResult)
        assert result.code == EdgeCaseCode.FACE_PARTIAL

    def test_partial_face_low_confidence(self, good_image_b64):
        face._set_model_for_test(FakeModel([_make_face(det_score=0.3)]))
        result = face.analyze_image(good_image_b64)
        assert isinstance(result, EdgeCaseResult)
        assert result.code == EdgeCaseCode.FACE_PARTIAL

    def test_poor_lighting_short_circuits(self, dark_image_b64):
        # Even with a "face" reported, lighting runs first.
        face._set_model_for_test(FakeModel([_make_face()]))
        result = face.analyze_image(dark_image_b64)
        assert isinstance(result, EdgeCaseResult)
        assert result.code == EdgeCaseCode.POOR_LIGHTING

    def test_invalid_base64_raises_valueerror(self):
        face._set_model_for_test(FakeModel([]))
        with pytest.raises(ValueError):
            face.analyze_image("!!!not-base64!!!")

    def test_non_image_bytes_raises_valueerror(self):
        face._set_model_for_test(FakeModel([]))
        garbage = base64.b64encode(b"this is not an image").decode("ascii")
        with pytest.raises(ValueError):
            face.analyze_image(garbage)

    def test_model_not_loaded_raises_runtimeerror(self, good_image_b64):
        face._reset_model_for_test()
        with pytest.raises(RuntimeError):
            face.analyze_image(good_image_b64)

    def test_largest_face_wins_when_no_tie(self, good_image_b64):
        large = _make_face(bbox=(0.0, 0.0, 400.0, 400.0))
        small = _make_face(bbox=(410.0, 0.0, 450.0, 40.0))
        # Give them different embeddings so we can tell which was chosen.
        small.normed_embedding = np.ones(512, dtype=np.float32) / np.sqrt(512)
        face._set_model_for_test(FakeModel([small, large]))
        result = face.analyze_image(good_image_b64)
        embedding, chosen = result  # type: ignore[misc]
        # Chosen should be the large one — i.e. not the "all ones" vector.
        assert not np.allclose(embedding, small.normed_embedding)


class TestExtractEmbeddingLegacy:
    """Ensure the legacy helper still returns None on edge cases."""

    def test_no_face_returns_none(self, good_image_b64):
        face._set_model_for_test(FakeModel([]))
        assert face.extract_embedding(good_image_b64) is None

    def test_multiple_faces_returns_none(self, good_image_b64):
        faces = [
            _make_face(bbox=(0.0, 0.0, 200.0, 200.0)),
            _make_face(bbox=(300.0, 0.0, 495.0, 200.0)),
        ]
        face._set_model_for_test(FakeModel(faces))
        assert face.extract_embedding(good_image_b64) is None

    def test_valid_face_returns_array(self, good_image_b64):
        face._set_model_for_test(FakeModel([_make_face()]))
        emb = face.extract_embedding(good_image_b64)
        assert emb is not None
        assert emb.shape == (512,)
