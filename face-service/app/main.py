"""
FastAPI application entry point for the face recognition microservice.

- Lifespan hook loads the InsightFace model and initializes the DB pool.
- CORS is wide open because this service is internal (not exposed externally).
- All routes are registered at the top level (no /api/v1 prefix — this is a
  single-purpose internal service).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import enroll, match, health, embeddings
from app.services import database, face, gallery_cache

# ────────────────────────────────────────────
# Logging
# ────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Startup: load InsightFace model + init DB pool.
    Shutdown: close DB pool.
    """
    # --- Startup ----------------------------------------------------------
    logger.info("Starting face recognition service ...")

    # Initialize database connection pool
    try:
        database.init_pool()
    except Exception as exc:
        logger.error("Failed to initialize database pool: %s", exc, exc_info=True)
        raise

    # Load face recognition model
    try:
        face.load_model(settings.FACE_MODEL_NAME)
    except Exception as exc:
        logger.error("Failed to load face model: %s", exc, exc_info=True)
        # We still start the service — /health will report model_loaded=false
        # and /enroll + /match will return 503.

    # Warm the in-memory gallery cache so the very first /match request
    # doesn't pay the DB round-trip. Not fatal if it fails — the cache
    # starts empty and /match will simply return no-match until the next
    # enrollment triggers a refresh.
    try:
        snapshot = gallery_cache.refresh_from_database()
        logger.info(
            "Gallery cache warmed with %d embeddings.", snapshot.size,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Initial gallery cache warm-up failed: %s", exc, exc_info=True)

    logger.info("Face recognition service is ready.")

    yield

    # --- Shutdown ---------------------------------------------------------
    logger.info("Shutting down face recognition service ...")
    database.close_pool()
    logger.info("Face recognition service stopped.")


# ────────────────────────────────────────────
# Application
# ────────────────────────────────────────────

app = FastAPI(
    title="Gym SaaS Face Recognition Service",
    description="Internal microservice for face embedding extraction and matching.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — wide open for internal service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health.router)
app.include_router(enroll.router)
app.include_router(match.router)
app.include_router(embeddings.router)


# ────────────────────────────────────────────
# Global exception handler
# ────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler — never leak stack traces or internal details to clients.
    """
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method, request.url.path, exc, exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )
