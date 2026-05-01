import type { FastifyInstance } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { globalSearchQuerySchema, globalSearchResponseSchema, faceSearchResponseSchema } from './search.schema.js';
import { SearchError, globalSearch, faceSearch } from './search.service.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET / — Global text search ────────────────────────────────────────────
  app.get(
    '/',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = globalSearchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid query parameters',
              parsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId: request.user?.id, action: 'global_search', params: parsed.data },
        'Global search request',
      );

      const result = await globalSearch(parsed.data);

      const validated = globalSearchResponseSchema.safeParse(result);
      if (!validated.success) {
        request.log.error(
          { err: validated.error, userId: request.user?.id },
          'Global search response failed schema validation',
        );
        return reply.status(500).send(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
      }

      return reply.send(ok(validated.data));
    },
  );

  // ─── POST /face — Face image search ────────────────────────────────────────
  app.post(
    '/face',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // @fastify/multipart is registered globally; consume the single file part.
      let imageBuffer: Buffer;

      try {
        const data = await request.file();
        if (!data) {
          return reply
            .status(400)
            .send(fail('VALIDATION_ERROR', 'No image file provided'));
        }

        // Collect the stream into a buffer, enforcing the 5 MB cap.
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        for await (const chunk of data.file) {
          totalBytes += chunk.length;
          if (totalBytes > MAX_IMAGE_BYTES) {
            // Drain the stream to avoid keeping the connection open.
            data.file.resume();
            return reply
              .status(413)
              .send(fail('IMAGE_TOO_LARGE', 'Image must not exceed 5 MB'));
          }
          chunks.push(chunk);
        }

        imageBuffer = Buffer.concat(chunks);
      } catch (err) {
        // @fastify/multipart throws when the body is not multipart.
        request.log.warn({ err, userId: request.user?.id }, 'Multipart parse error');
        return reply
          .status(400)
          .send(fail('VALIDATION_ERROR', 'Request must be multipart/form-data with an "image" field'));
      }

      request.log.info(
        { userId: request.user?.id, action: 'face_search', bytes: imageBuffer.length },
        'Face search request',
      );

      try {
        const result = await faceSearch(imageBuffer);

        const validated = faceSearchResponseSchema.safeParse(result);
        if (!validated.success) {
          request.log.error(
            { err: validated.error, userId: request.user?.id },
            'Face search response failed schema validation',
          );
          return reply.status(500).send(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
        }

        return reply.send(ok(validated.data));
      } catch (err) {
        if (err instanceof SearchError) {
          return reply.status(err.statusCode).send(fail(err.code, err.message));
        }
        request.log.error({ err, userId: request.user?.id }, 'Unexpected error during face search');
        throw err;
      }
    },
  );
}
