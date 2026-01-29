import { describe, it, expect } from 'vitest';
import { checkLLMUsage, redis } from './redis';

describe('Redis Rate Limiting Integration', () => {
    it('should enforce daily limits correctly', async () => {
        const testUserId = `test-unit-${Date.now()}`;
        const limit = 3;

        // 1. First Request (1/3) -> Should Pass
        const r1 = await checkLLMUsage(testUserId, limit);
        expect(r1.success).toBe(true);
        expect(r1.count).toBe(1);
        expect(r1.remaining).toBe(2);

        // 2. Second Request (2/3) -> Should Pass
        const r2 = await checkLLMUsage(testUserId, limit);
        expect(r2.success).toBe(true);
        expect(r2.count).toBe(2);
        expect(r2.remaining).toBe(1);

        // 3. Third Request (3/3) -> Should Pass (At Limit)
        const r3 = await checkLLMUsage(testUserId, limit);
        expect(r3.success).toBe(true);
        expect(r3.count).toBe(3);
        expect(r3.remaining).toBe(0);

        // 4. Fourth Request (4/3) -> Should Fail (Over Limit)
        const r4 = await checkLLMUsage(testUserId, limit);
        expect(r4.success).toBe(false);
        expect(r4.count).toBe(4);
        expect(r4.remaining).toBe(0);

        // Cleanup (Optional, but good for keeping Redis clean)
        // await redis.del(`usage:llm:${testUserId}:${new Date().toISOString().split('T')[0]}`);
    });
});
