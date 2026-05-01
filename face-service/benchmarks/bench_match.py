"""
Benchmark harness for ``/match`` end-to-end latency.

What it measures
----------------
Simulates a gallery of 500 enrolled members and 100 random probes and
compares two pipelines end-to-end:

  * ``naive`` — the original pipeline: per-request DB fetch, normalize,
    matrix-build, matmul, argmax. This mirrors the pre-optimization
    path in ``app/routes/match.py`` before the cache landed.
  * ``cached`` — the production pipeline: pre-normalized matrix held in
    memory, refreshed only on enroll/delete, reduces each match to a
    single matrix-vector multiply.

Both pipelines exercise the exact same similarity math so the gap is
purely the cost we removed.

The simulated DB reproduces psycopg2's fetch behaviour: rows come back
as ``(id, member_id, buffer(float32_bytes))`` and we reconstruct numpy
arrays from them on every request. We also add a small, realistic
round-trip sleep (default 3 ms) per DB call; override it with
``--db-latency-ms`` to model different network profiles.

Usage
-----
::

    # Default: 500 gallery, 100 probes, runs both variants.
    python benchmarks/bench_match.py

    # Larger test.
    python benchmarks/bench_match.py --gallery 500 --probes 100 --db-latency-ms 5

    # Machine-readable JSON output (for CI).
    python benchmarks/bench_match.py --json
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, List, Tuple

import numpy as np

# Make ``app`` importable when running via ``python benchmarks/...``.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services import gallery_cache  # noqa: E402


# ────────────────────────────────────────────
# Data generation
# ────────────────────────────────────────────

def generate_gallery(n: int, dim: int = 512, seed: int = 17) -> List[Tuple[str, str, np.ndarray]]:
    """
    Generate a synthetic gallery of ``n`` L2-normalized embeddings.

    Returns a list of ``(embedding_id, member_id, vec)`` tuples, matching
    the shape of ``database.load_all_active_embeddings()``.
    """
    rng = np.random.default_rng(seed)
    rows: List[Tuple[str, str, np.ndarray]] = []
    for i in range(n):
        v = rng.normal(size=dim).astype(np.float32)
        v /= np.linalg.norm(v)
        rows.append((f"emb-{i:06d}", f"mem-{i:06d}", v))
    return rows


def generate_probes(
    gallery: List[Tuple[str, str, np.ndarray]],
    n_probes: int,
    noise: float = 0.05,
    seed: int = 31,
) -> List[np.ndarray]:
    """
    Build probe embeddings by sampling random gallery entries and adding
    small Gaussian noise. Mirrors the "same person, slightly different
    capture" case while keeping enough variation so most probes still
    match the source row.
    """
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(gallery), size=n_probes)
    probes: List[np.ndarray] = []
    for i in idx:
        base = gallery[int(i)][2].copy()
        base += rng.normal(0, noise, size=base.shape).astype(np.float32)
        base /= np.linalg.norm(base)
        probes.append(base)
    return probes


# ────────────────────────────────────────────
# DB round-trip simulation
# ────────────────────────────────────────────

class SimulatedDatabase:
    """
    A stand-in for the real ``database.load_all_active_embeddings()``.

    Reproduces the two dominant costs of the original pipeline:

      1. A fixed per-call latency (``latency_ms``) to simulate the
         network hop / TCP round-trip to Postgres.
      2. A full re-materialization of float32 arrays from raw bytes on
         every call (psycopg2 returns ``memoryview`` objects; our code
         rebuilds numpy arrays from them).
    """

    def __init__(
        self,
        rows: List[Tuple[str, str, np.ndarray]],
        latency_ms: float,
    ) -> None:
        # Keep the rows as raw bytes so the per-call cost is realistic.
        self._raw = [
            (eid, mid, vec.astype(np.float32).tobytes())
            for eid, mid, vec in rows
        ]
        self._latency_s = latency_ms / 1000.0

    def load_all_active_embeddings(self) -> List[Tuple[str, str, np.ndarray]]:
        # Simulate the round-trip cost once per request.
        if self._latency_s > 0:
            time.sleep(self._latency_s)
        # Reconstruct numpy arrays (what psycopg2 + our code does today).
        return [
            (eid, mid, np.frombuffer(raw, dtype=np.float32))
            for eid, mid, raw in self._raw
        ]


# ────────────────────────────────────────────
# Pipelines under test
# ────────────────────────────────────────────

def naive_match(
    db: SimulatedDatabase,
    probe: np.ndarray,
    threshold: float,
) -> Tuple[str, float] | None:
    """
    Reproduction of the pre-optimization ``/match`` code path.

    Fetches the full gallery from the DB, stacks it into a matrix,
    normalizes both sides, then runs the matmul + argmax.
    """
    gallery = db.load_all_active_embeddings()
    if not gallery:
        return None

    ids = [(eid, mid) for eid, mid, _ in gallery]
    gallery_matrix = np.stack([vec for _, _, vec in gallery])

    probe_norm = probe / (np.linalg.norm(probe) + 1e-10)
    gallery_norms = gallery_matrix / (
        np.linalg.norm(gallery_matrix, axis=1, keepdims=True) + 1e-10
    )
    similarities = gallery_norms @ probe_norm

    best_idx = int(np.argmax(similarities))
    best_score = float(similarities[best_idx])
    if best_score < threshold:
        return None
    return ids[best_idx][1], best_score


def cached_match(
    probe: np.ndarray,
    threshold: float,
) -> Tuple[str, float] | None:
    """
    Production pipeline: single matmul against the pre-normalized cache.
    """
    hit = gallery_cache.match(probe, threshold)
    if hit is None:
        return None
    return hit.member_id, hit.score


# ────────────────────────────────────────────
# Timing
# ────────────────────────────────────────────

@dataclass
class BenchStats:
    pipeline: str
    gallery_size: int
    probes: int
    p50_ms: float
    p95_ms: float
    p99_ms: float
    min_ms: float
    max_ms: float
    mean_ms: float
    match_rate: float


def time_pipeline(
    name: str,
    runner: Callable[[np.ndarray], Tuple[str, float] | None],
    probes: List[np.ndarray],
    gallery_size: int,
) -> BenchStats:
    # Warm the JIT / caches — a handful of throwaway calls so the first
    # real probe isn't penalized by cold-path effects.
    for p in probes[: min(5, len(probes))]:
        runner(p)

    latencies: List[float] = []
    hits = 0
    for probe in probes:
        t0 = time.perf_counter()
        result = runner(probe)
        latencies.append((time.perf_counter() - t0) * 1000.0)
        if result is not None:
            hits += 1

    return BenchStats(
        pipeline=name,
        gallery_size=gallery_size,
        probes=len(probes),
        p50_ms=statistics.median(latencies),
        p95_ms=percentile(latencies, 95),
        p99_ms=percentile(latencies, 99),
        min_ms=min(latencies),
        max_ms=max(latencies),
        mean_ms=statistics.fmean(latencies),
        match_rate=hits / len(probes),
    )


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    k = (len(sorted_values) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_values) - 1)
    if f == c:
        return sorted_values[f]
    d = k - f
    return sorted_values[f] + (sorted_values[c] - sorted_values[f]) * d


# ────────────────────────────────────────────
# CLI entrypoint
# ────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Face-match benchmark harness")
    parser.add_argument("--gallery", type=int, default=500,
                         help="Number of simulated member embeddings (default 500)")
    parser.add_argument("--probes", type=int, default=100,
                         help="Number of probe embeddings (default 100)")
    parser.add_argument("--threshold", type=float, default=0.45,
                         help="Match threshold (default 0.45)")
    parser.add_argument("--db-latency-ms", type=float, default=3.0,
                         help="Simulated DB round-trip latency per request "
                              "for the naive pipeline (default 3 ms)")
    parser.add_argument("--noise", type=float, default=0.05,
                         help="Gaussian noise added to probes (default 0.05)")
    parser.add_argument("--json", action="store_true",
                         help="Emit machine-readable JSON")
    args = parser.parse_args()

    # --- Setup -----------------------------------------------------------
    gallery = generate_gallery(args.gallery)
    probes = generate_probes(gallery, args.probes, noise=args.noise)
    db = SimulatedDatabase(gallery, latency_ms=args.db_latency_ms)

    # Warm the cache once — the cache is designed to be built on startup
    # and refreshed only on enroll/delete, so this cost is out-of-band.
    gallery_cache.clear()
    gallery_cache.refresh_from_rows(gallery)

    # --- Run benchmarks --------------------------------------------------
    naive = time_pipeline(
        "naive",
        lambda p: naive_match(db, p, args.threshold),
        probes,
        gallery_size=args.gallery,
    )
    cached = time_pipeline(
        "cached",
        lambda p: cached_match(p, args.threshold),
        probes,
        gallery_size=args.gallery,
    )

    # --- Report ----------------------------------------------------------
    if args.json:
        print(json.dumps(
            {
                "naive": asdict(naive),
                "cached": asdict(cached),
                "config": vars(args),
            },
            indent=2,
        ))
    else:
        print(f"Gallery: {args.gallery}    Probes: {args.probes}    "
              f"Threshold: {args.threshold}    DB latency: {args.db_latency_ms} ms")
        print()
        print(f"{'Pipeline':<10}{'p50 (ms)':>12}{'p95 (ms)':>12}"
              f"{'p99 (ms)':>12}{'mean':>10}{'hit-rate':>12}")
        for s in (naive, cached):
            print(f"{s.pipeline:<10}"
                  f"{s.p50_ms:>12.2f}{s.p95_ms:>12.2f}{s.p99_ms:>12.2f}"
                  f"{s.mean_ms:>10.2f}{s.match_rate:>12.2%}")
        print()
        speedup_p95 = naive.p95_ms / cached.p95_ms if cached.p95_ms else float("inf")
        print(f"p95 speed-up: {speedup_p95:.1f}x")
        target = 2000.0
        print(f"Target p95 < {target:.0f} ms: "
              f"{'PASS' if cached.p95_ms < target else 'FAIL'} "
              f"(cached p95 = {cached.p95_ms:.2f} ms)")

    # --- Exit code -------------------------------------------------------
    return 0 if cached.p95_ms < 2000.0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
