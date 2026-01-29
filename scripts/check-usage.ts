import dotenv from 'dotenv';
import { getLLMUsage } from '../src/lib/redis';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
    const args = process.argv.slice(2);
    const userId = args[0];

    if (!userId) {
        console.error("Please provide a userId.");
        console.error("Usage: npx tsx scripts/check-usage.ts <userId>");
        process.exit(1);
    }

    console.log(`Checking usage for User: ${userId}...`);

    try {
        const count = await getLLMUsage(userId);
        console.log(`\n📅 Today's Usage: ${count} requests`);
        console.log(`(Key: usage:llm:${userId}:${new Date().toISOString().split('T')[0]})`);
    } catch (e) {
        console.error("Error fetching usage:", e);
    }
}

main();
