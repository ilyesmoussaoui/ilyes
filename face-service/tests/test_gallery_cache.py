"""
Unit tests for the in-memory gallery cache used by ``/match``.

These tests skip the DB entirely and drive the cache directly with
synthetic row lists. They verify:

  * empty cache returns None
  * best match is picked above threshold
  * below-threshold matches return None
  * refresh replaces the snapshot atomically
  * the cache normalizes rows (so unnormalized inputs still match)
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services import gallery_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    gallery_cache.clear()
    yield
    gallery_cache.clear()


def _rand_unit(seed: int, dim: int = 512) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.normal(size=dim).astype(np.float32)
    v /= np.linalg.norm(v)
    return v


def _rows(n: int, dim: int = 512):
    return [
        (f"emb-{i:04d}", f"mem-{i:04d}", _rand_unit(i, dim))
        for i in range(n)
    ]


class TestCacheLifecycle:
    def test_empty_cache_returns_none(self):
        snapshot = gallery_cache.get_snapshot()
        assert snapshot.size == 0
        assert gallery_cache.match(_rand_unit(0), threshold=0.1) is None

    def test_refresh_populates_cache(self):
        rows = _rows(10)
        snapshot = gallery_cache.refresh_from_rows(rows)
        assert snapshot.size == 10
        assert snapshot.matrix.shape == (10, 512)

    def test_refresh_normalizes(self):
        # Supply a non-unit vector; cache should still produce a usable
        # normalized matrix.
        huge = _rand_unit(0) * 100.0
        rows = [("e0", "m0", huge)]
        snapshot = gallery_cache.refresh_from_rows(rows)
        row_norm = float(np.linalg.norm(snapshot.matrix[0]))
        assert row_norm == pytest.approx(1.0, rel=1e-4)


class TestCacheMatching:
    def test_exact_match_above_threshold(self):
        rows = _rows(50)
        gallery_cache.refresh_from_rows(rows)

        # Pick an existing embedding as the probe (score should be 1.0).
        target_idx = 7
        probe = rows[target_idx][2]
        hit = gallery_cache.match(probe, threshold=0.9)
        assert hit is not None
        assert hit.member_id == rows[target_idx][1]
        assert hit.score == pytest.approx(1.0, abs=1e-5)

    def test_random_probe_below_threshold(self):
        rows = _rows(50)
        gallery_cache.refresh_from_rows(rows)

        probe = _rand_unit(9999)  # unrelated to any enrolled vector
        hit = gallery_cache.match(probe, threshold=0.9)
        assert hit is None

    def test_zero_vector_probe_returns_none(self):
        rows = _rows(5)
        gallery_cache.refresh_from_rows(rows)
        probe = np.zeros(512, dtype=np.float32)
        assert gallery_cache.match(probe, threshold=0.1) is None


class TestRefreshReplacesAtomically:
    def test_refresh_replaces_previous_snapshot(self):
        gallery_cache.refresh_from_rows(_rows(5))
        snapshot1 = gallery_cache.get_snapshot()

        gallery_cache.refresh_from_rows(_rows(100))
        snapshot2 = gallery_cache.get_snapshot()

        assert snapshot1.size == 5
        assert snapshot2.size == 100
        # Old snapshot object is untouched — safe for any thread holding it.
        assert snapshot1.matrix.shape == (5, 512)
