import { ok, type Result } from '../../base/core/result/result';

export type HealthPayload = {
  status: 'ok';
  service: 'regulamente-back';
};

export function getHealth(): Result<HealthPayload, never> {
  return ok({
    status: 'ok',
    service: 'regulamente-back',
  });
}
