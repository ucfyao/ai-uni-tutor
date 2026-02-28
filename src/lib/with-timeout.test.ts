import { describe, expect, it } from 'vitest';
import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves when promise settles within timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50, 'test op')).resolves.toBe('ok');
  });

  it('rejects with timeout error when promise does not settle in time', async () => {
    const pending = new Promise<string>(() => {
      // intentionally never resolves
    });
    await expect(withTimeout(pending, 10, 'slow op')).rejects.toThrow(
      'slow op timed out after 10ms',
    );
  });
});
