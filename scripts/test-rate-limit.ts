import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testRateLimit() {
    const url = 'http://localhost:3000/api/chat'; // Assuming this endpoint is protected
    const requestCount = 15; // Limit is set to 7 in env, so 15 should definitely trigger 429
    const interval = 100; // ms

    console.log(`Starting Rate Limit Test against ${url}...`);
    console.log(`Sending ${requestCount} requests with ${interval}ms interval.`);

    let successCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < requestCount; i++) {
        try {
            const start = Date.now();
            // We need to mock a user session or just hit it public. 
            // Middleware checks for user, if not user uses IP based.
            // Let's assume testing IP based for simplicity first, or valid session if possible.
            // For now, let's just hit the endpoint. If middleware is global, it applies to all routes except public ones.

            const res = await fetch(url, {
                method: 'POST', // Or GET if testing a GET route, but chat is usually POST. 
                // If testing middleware simply, we can hit a dummy route or existing one.
                // Let's try hitting a known route.
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: 'test' })
            });

            const duration = Date.now() - start;

            if (res.status === 429) {
                console.log(`Req ${i + 1}: ${res.status} Too Many Requests (Blocked) - ${duration}ms`);
                blockedCount++;
            } else {
                console.log(`Req ${i + 1}: ${res.status} OK - ${duration}ms`);
                if (res.ok) successCount++;
                // Note: It might return 401 or 500 if not auth, but ratelimit happens BEFORE auth logic often or valid session check.
                // In our middleware:
                // 1. Get IP
                // 2. Check auth
                // 3. User ? key=user.id : key=ip
                // 4. Rate limit using key

                // So hitting without auth should trigger IP based limit (20 req / 10s?? No, found code said 10 req/10s for public)
                // Public ratelimit (IP based): 10 requests per 10 seconds (src/lib/redis.ts)
            }

        } catch (err: any) {
            console.error(`Req ${i + 1}: Error - ${err.message}`);
        }

        await new Promise(r => setTimeout(r, interval));
    }

    console.log('\n--- Test Results ---');
    console.log(`Successful/Allowed Requests: ${successCount}`);
    console.log(`Blocked (429) Requests: ${blockedCount}`);

    if (blockedCount > 0) {
        console.log('✅ Rate limiting is WORKING.');
    } else {
        console.log('❌ Rate limiting did NOT trigger.');
        console.log('⚠️  NOTE: Ensure your Next.js server is running with ENABLE_RATELIMIT=true');
        console.log('   Example: ENABLE_RATELIMIT=true npm run dev');
    }
}

testRateLimit();
