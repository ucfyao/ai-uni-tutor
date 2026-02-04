import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testRateLimit() {
  // Rate limit is applied in API routes (checkApiRateLimit). Use POST /api/chat/stream for IP-based test.
  const url = 'http://localhost:3000/api/chat/stream';
  const requestCount = 15; // Anonymous limit: 10 req/10s (RATE_LIMIT_PUBLIC_*), so 15 should trigger 429
  const interval = 50; // ms

  console.log(`Starting Rate Limit Test against ${url}...`);
  console.log(
    `API rate limit: anonymous = ratelimit (default 10/10s), logged-in = proRatelimit (100/10s).`,
  );
  console.log(`Sending ${requestCount} POST requests with ${interval}ms interval.\n`);

  let successCount = 0;
  let blockedCount = 0;

  for (let i = 0; i < requestCount; i++) {
    try {
      const start = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const duration = Date.now() - start;

      if (res.status === 429) {
        console.log(`Req ${i + 1}: 429 Too Many Requests (blocked) - ${duration}ms`);
        blockedCount++;
      } else {
        console.log(`Req ${i + 1}: ${res.status} - ${duration}ms`);
        if (res.ok) successCount++;
      }
    } catch (err: unknown) {
      console.error(`Req ${i + 1}: Error - ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  console.log('\n--- Test Results ---');
  console.log(`Allowed: ${successCount}, Blocked (429): ${blockedCount}`);

  if (blockedCount > 0) {
    console.log('✅ Rate limiting is working (API routes + Redis).');
  } else {
    console.log('❌ No 429s. Either limit not reached or API rate limit is disabled.');
    console.log(
      '   In development, set ENABLE_RATELIMIT=true (e.g. ENABLE_RATELIMIT=true npm run dev).',
    );
    console.log('   Production always has rate limit on.');
  }
}

testRateLimit();
