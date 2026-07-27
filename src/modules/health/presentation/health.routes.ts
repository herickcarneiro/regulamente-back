import { Elysia } from 'elysia';
import { getHealth } from '../application/get-health';
import { healthResponseSchema } from './health.schema';

export function createHealthRoutes() {
  return new Elysia({ name: 'health' }).get(
    '/health',
    () => {
      const result = getHealth();

      if (result.ok) {
        return result.value;
      }

      throw new Error('Health check cannot fail');
    },
    {
      response: healthResponseSchema,
    },
  );
}
