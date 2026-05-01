# Face Recognition Service

Internal FastAPI microservice that exposes face enrollment, matching, and
embedding management for the gym SaaS backend. Runs on port `8001` inside
the Docker compose stack and is never exposed to the public internet.

## Architecture

- **FastAPI** app with lifespan startup (`app/main.py`):
  1. Initializes the Postgres connection pool (psycopg2 `ThreadedConnectionPool`).
  2. Loads the InsightFace `buffalo_l` model into CPU memory.
  3. Warms the in-memory gallery cache from `face_embeddings`.
- **Detection + embedding** (`app/services/face.py`) sits behind the model
  singleton. `analyze_image()` returns either `(embedding, chosen_face)`
  for a usable capture or an `EdgeCaseResult` (with a structured error
  code) when the capture is unusable.
- **Edge-case logic** (`app/services/edge_cases.py`) is pure-numpy and
  fully unit-tested. It classifies lighting, face count, and landmark
  coverage so the API can return actionable hints.
- **Gallery cache** (`app/services/gallery_cache.py`) holds all active
  embeddings as a pre-normalized `(N, 512)` float32 matrix. Each match
  is one matmul + one argmax. The cache is refreshed atomically on
  enroll/delete. See `benchmarks/results.md` for numbers.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/health` | Liveness + model/gallery state. |
| `POST` | `/enroll` | Register a member's face embedding. |
| `POST` | `/match`  | 1:N cosine match against the cached gallery. |
| `DELETE` | `/embeddings/{member_id}` | Soft-delete a member's embeddings. |

### Request / Response contracts

```jsonc
// POST /enroll
{
  "member_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_base64": "…"
}

// 200 OK — success
{ "success": true, "embedding_id": "…" }

// 200 OK — edge case (see EdgeCaseCode below)
{ "success": false, "error": "MULTIPLE_FACES", "hint": "Please step forward so only one face is in frame." }
```

```jsonc
// POST /match
{
  "image_base64": "…",
  "threshold": 0.45
}

// 200 OK — match found
{ "success": true, "match": { "member_id": "…", "confidence": 0.87, "embedding_id": "…" } }

// 200 OK — no match
{ "success": true, "match": null }

// 200 OK — edge case
{ "success": false, "error": "POOR_LIGHTING", "hint": "The lighting is too dark or too bright…" }
```

### `EdgeCaseCode` enum

All quality-related errors come back as a structured code + hint pair.
The codes are stable strings and safe to switch on in the frontend.

| Code | When | Hint (user-facing) |
| --- | --- | --- |
| `NO_FACE` | No face detected in frame. | "We could not find a face. Please look directly at the camera." |
| `MULTIPLE_FACES` | Second-largest bbox is within 10% of the largest. | "Please step forward so only one face is in frame." |
| `POOR_LIGHTING` | Luminance mean <40 or >220, std <10, or >85% of pixels clipped to one end. | "The lighting is too dark or too bright. Please move to a well-lit area and try again." |
| `FACE_PARTIAL` | <5 landmarks detected or detection confidence <0.55. | "Your face is partially out of frame or obscured. Please look straight at the camera and remove any obstructions." |
| `POSSIBLE_SPOOF` | Optional burst-liveness: frame-to-frame embedding variance below 1e-4. | "Liveness check failed. Please look at the camera directly instead of presenting a photo." |
| `INVALID_IMAGE` | The base64 payload could not be decoded. | Decoder's error message. |

> **Integration note for the main backend / frontend:** the `hint`
> field is new and optional — it is `null` on success and on the
> `NO_MATCH` (non-edge) path. Clients that already handle the legacy
> `{ success: false, error: "string" }` shape continue to work
> unchanged; the only substantive change is that `error` is now a
> stable enum code rather than a free-form string, and all quality
> feedback is co-located with an end-user hint. Frontend can switch on
> `error` to render specific recovery UIs.

## Running locally

```sh
cd face-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

`DATABASE_URL` is the only required env var; other settings are
documented in `app/config.py`.

## Tests

```sh
cd face-service
./.venv/bin/python -m pytest tests/ -v
```

46 unit tests cover:

- `tests/test_edge_cases.py` — every `EdgeCaseCode` has a dedicated
  test for its trigger condition, plus lighting math parity with
  NumPy, and the optional burst-based liveness heuristic.
- `tests/test_face_service.py` — `analyze_image` with a fake
  InsightFace model: happy path, NO_FACE, MULTIPLE_FACES, FACE_PARTIAL
  (landmark + confidence), POOR_LIGHTING, INVALID_IMAGE, model-not-loaded.
- `tests/test_gallery_cache.py` — cache lifecycle, normalization,
  matching above/below threshold, atomic snapshot replacement.

The tests do **not** download the InsightFace model; they inject a
fake detector via `face._set_model_for_test()`. This keeps the test
suite at ~1 second wall-clock.

## Benchmarks

See `benchmarks/results.md` for the full write-up. Headline numbers:

- **Match math p95**: 0.09 ms (down from 6.49 ms with in-DB fetch).
- **End-to-end /match p95**: 185 ms including 180 ms simulated CPU
  inference — **~10x under the 2 s target** with 500 members.

Run them:

```sh
./.venv/bin/python benchmarks/bench_match.py
./.venv/bin/python benchmarks/bench_end_to_end.py
```

Both scripts exit non-zero if `cached.p95 >= 2000 ms` so they can be
wired into CI as a regression gate.

## Scaling notes

The in-memory cache is process-local. This service is currently
single-replica inside the Docker compose stack; if we ever need to run
multiple replicas we have two paths:

1. **Thread-safe in-memory cache + listen/notify.** Every replica keeps
   the full matrix in memory and subscribes to a Postgres `LISTEN`
   channel fired by the app on enroll/delete. Works well up to ~50k
   members.
2. **pgvector HNSW.** At ~100k members the full-scan matmul stops being
   faster than an HNSW index in Postgres. Migration path: add the
   pgvector extension, create a `vector(512)` column with a
   `vector_cosine_ops` HNSW index, swap `gallery_cache.match()` for an
   SQL `ORDER BY embedding <=> $probe LIMIT 1`.

Both paths are additive; the API contract above does not change.

## Out-of-scope security caveats

- **Replay attacks** (video recordings held up to the camera) are not
  detected. This requires either eye-blink detection or IR / depth
  sensing, neither of which is available on a commodity webcam.
- **3D masks** fall into the same bucket as replay — out of scope for
  a software-only service.
- The burst-based liveness heuristic (`POSSIBLE_SPOOF`) only fires
  when the frontend sends an explicit burst of embeddings; it is
  deliberately conservative to avoid false positives on users who
  hold still during capture.
