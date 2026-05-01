"""
In-memory gallery cache for fast face matching.

Problem
-------
The naive ``/match`` path loads every active embedding from Postgres on
every request. For 500 members that is ~500 rows × 2 KB = ~1 MB pulled
through psycopg2 plus a numpy copy per row. At p95 the DB round-trip
swamps the actual similarity computation (a 500×512 matmul is well
under 1 ms on a modern laptop).

Solution
--------
Load the gallery once, keep it as a single contiguous, pre-normalized
``(N, 512)`` float32 matrix in memory, and refresh it only when
enrollments or deletions happen. Thread-safe via an RLock.

This keeps p95 in the low tens of milliseconds for 500 members on
commodity hardware while remaining a drop-in replacement for the
previous ``database.load_all_active_embeddings()`` call.

The cache is deliberately process-local. For horizontal scaling the
service should move to pgvector (HNSW) — see ``benchmarks/results.md``.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────
# Snapshot container
# ────────────────────────────────────────────

@dataclass(frozen=True)
class GallerySnapshot:
    """
    Immutable snapshot of the gallery. Every refresh replaces the
    previous snapshot atomically so readers are never torn.
    """

    matrix: np.ndarray               # (N, 512) float32, L2-normalized
    embedding_ids: Tuple[str, ...]
    member_ids: Tuple[str, ...]
    loaded_at_ms: float              # wall-clock ms when built
    build_duration_ms: float         # how long the load+normalize took

    @property
    def size(self) -> int:
        return int(self.matrix.shape[0]) if self.matrix.size else 0


_EMPTY = GallerySnapshot(
    matrix=np.zeros((0, 512), dtype=np.float32),
    embedding_ids=(),
    member_ids=(),
    loaded_at_ms=0.0,
    build_duration_ms=0.0,
)


# ────────────────────────────────────────────
# Cache singleton
# ────────────────────────────────────────────

_snapshot: GallerySnapshot = _EMPTY
_lock = threading.RLock()


def _build_snapshot(
    rows: List[Tuple[str, str, np.ndarray]],
    t0: float,
) -> GallerySnapshot:
    if not rows:
        return GallerySnapshot(
            matrix=np.zeros((0, 512), dtype=np.float32),
            embedding_ids=(),
            member_ids=(),
            loaded_at_ms=time.monotonic() * 1000,
            build_duration_ms=(time.monotonic() - t0) * 1000,
        )

    embedding_ids = tuple(eid for eid, _, _ in rows)
    member_ids = tuple(mid for _, mid, _ in rows)

    # Build the matrix in one allocation and L2-normalize once. This is
    # the main reason the matcher is fast: every match call now reduces
    # to a single ``matrix @ probe`` without per-row normalization.
    matrix = np.empty((len(rows), rows[0][2].shape[0]), dtype=np.float32)
    for i, (_, _, vec) in enumerate(rows):
        matrix[i] = vec.astype(np.float32, copy=False)

    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    # Avoid divide-by-zero; a zero vector will just be left at zero
    # so it never scores above threshold.
    norms[norms < 1e-10] = 1.0
    matrix /= norms

    return GallerySnapshot(
        matrix=matrix,
        embedding_ids=embedding_ids,
        member_ids=member_ids,
        loaded_at_ms=time.monotonic() * 1000,
        build_duration_ms=(time.monotonic() - t0) * 1000,
    )


def refresh_from_rows(rows: List[Tuple[str, str, np.ndarray]]) -> GallerySnapshot:
    """
    Replace the snapshot with a freshly built one from raw DB rows.

    Intended to be called from startup and after any enroll/delete.
    """
    global _snapshot
    t0 = time.monotonic()
    snapshot = _build_snapshot(rows, t0)
    with _lock:
        _snapshot = snapshot
    logger.info(
        "Gallery cache refreshed: %d embeddings in %.2f ms",
        snapshot.size, snapshot.build_duration_ms,
    )
    return snapshot


def refresh_from_database() -> GallerySnapshot:
    """
    Convenience wrapper that pulls rows from Postgres and rebuilds the
    cache. Kept out of the critical module path so unit tests can
    exercise :func:`refresh_from_rows` without a DB.
    """
    # Deferred import — breaks an otherwise circular app.services dep.
    from app.services import database
    rows = database.load_all_active_embeddings()
    return refresh_from_rows(rows)


def get_snapshot() -> GallerySnapshot:
    """Return the current snapshot (cheap — no copy)."""
    return _snapshot


def clear() -> None:
    """Reset the cache. Used by unit tests."""
    global _snapshot
    with _lock:
        _snapshot = _EMPTY


# ────────────────────────────────────────────
# Matching against the cached matrix
# ────────────────────────────────────────────

@dataclass(frozen=True)
class MatchHit:
    """Top-1 match result."""

    embedding_id: str
    member_id: str
    score: float


def match(probe: np.ndarray, threshold: float) -> Optional[MatchHit]:
    """
    Match a probe embedding against the cached gallery.

    Returns the best hit above ``threshold`` or ``None`` if the gallery
    is empty or no hit crosses the threshold. Always runs in
    constant-space: a single (N, 512) @ (512,) matmul plus an argmax.
    """
    snapshot = _snapshot
    if snapshot.size == 0:
        return None

    probe = probe.astype(np.float32, copy=False)
    norm = float(np.linalg.norm(probe))
    if norm < 1e-10:
        return None
    probe_unit = probe / norm

    similarities = snapshot.matrix @ probe_unit  # (N,)
    best_idx = int(np.argmax(similarities))
    best_score = float(similarities[best_idx])

    if best_score < threshold:
        return None

    return MatchHit(
        embedding_id=snapshot.embedding_ids[best_idx],
        member_id=snapshot.member_ids[best_idx],
        score=best_score,
    )
