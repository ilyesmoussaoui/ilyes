"""
PostgreSQL connection pool and embedding CRUD operations.

Uses psycopg2 with a ThreadedConnectionPool for thread-safe access
from uvicorn's thread pool.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import psycopg2
from psycopg2 import pool as pg_pool

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level connection pool — initialized during app lifespan.
_pool: Optional[pg_pool.ThreadedConnectionPool] = None


# ────────────────────────────────────────────
# Pool lifecycle
# ────────────────────────────────────────────

def init_pool() -> None:
    """Create the threaded connection pool. Called once at startup."""
    global _pool
    logger.info("Initializing PostgreSQL connection pool (min=%d, max=%d) ...",
                settings.DB_POOL_MIN, settings.DB_POOL_MAX)
    _pool = pg_pool.ThreadedConnectionPool(
        minconn=settings.DB_POOL_MIN,
        maxconn=settings.DB_POOL_MAX,
        dsn=settings.DATABASE_URL,
    )
    logger.info("PostgreSQL connection pool ready.")


def close_pool() -> None:
    """Close all connections in the pool. Called at shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
        logger.info("PostgreSQL connection pool closed.")


def _get_conn():
    """Borrow a connection from the pool."""
    if _pool is None:
        raise RuntimeError("Database connection pool is not initialized")
    return _pool.getconn()


def _put_conn(conn) -> None:
    """Return a connection to the pool."""
    if _pool is not None:
        _pool.putconn(conn)


# ────────────────────────────────────────────
# Embedding CRUD
# ────────────────────────────────────────────

def soft_delete_member_embeddings(member_id: str) -> int:
    """
    Soft-delete all active embeddings for a member.

    Returns the number of rows updated.
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE face_embeddings
                   SET deleted_at = %s,
                       updated_at = %s
                 WHERE member_id = %s
                   AND deleted_at IS NULL
                """,
                (
                    datetime.now(timezone.utc),
                    datetime.now(timezone.utc),
                    member_id,
                ),
            )
            count = cur.rowcount
        conn.commit()
        return count
    except Exception:
        conn.rollback()
        raise
    finally:
        _put_conn(conn)


def insert_embedding(
    member_id: str,
    embedding: np.ndarray,
    model_version: Optional[str],
) -> str:
    """
    Insert a new face embedding row.

    Returns the generated UUID of the new row.
    """
    embedding_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    embedding_bytes = embedding.astype(np.float32).tobytes()

    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO face_embeddings
                    (id, member_id, embedding_vector, model_version, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    embedding_id,
                    member_id,
                    psycopg2.Binary(embedding_bytes),
                    model_version,
                    now,
                    now,
                ),
            )
        conn.commit()
        return embedding_id
    except Exception:
        conn.rollback()
        raise
    finally:
        _put_conn(conn)


def load_all_active_embeddings() -> list[tuple[str, str, np.ndarray]]:
    """
    Load all non-deleted embeddings from the database.

    Returns a list of (embedding_id, member_id, embedding_vector) tuples
    where embedding_vector is a numpy float32 array of shape (512,).
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, member_id, embedding_vector
                  FROM face_embeddings
                 WHERE deleted_at IS NULL
                   AND model_version IS DISTINCT FROM 'placeholder-v0'
                """
            )
            rows = cur.fetchall()

        results: list[tuple[str, str, np.ndarray]] = []
        for row_id, row_member_id, raw_bytes in rows:
            vec = np.frombuffer(bytes(raw_bytes), dtype=np.float32)
            results.append((str(row_id), str(row_member_id), vec))

        return results
    finally:
        _put_conn(conn)


def count_active_embeddings() -> int:
    """Return the number of non-deleted embeddings."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM face_embeddings WHERE deleted_at IS NULL"
            )
            row = cur.fetchone()
            return row[0] if row else 0
    finally:
        _put_conn(conn)
