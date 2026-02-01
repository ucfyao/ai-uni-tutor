
import type { NextConfig } from "next";

// Read from env or default to 5MB
const maxFileSizeMB = process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5';

const nextConfig: NextConfig = {
    /* config options here */
    reactStrictMode: true,
    experimental: {
        serverActions: {
            bodySizeLimit: `${maxFileSizeMB}mb`, // Sync with NEXT_PUBLIC_MAX_FILE_SIZE_MB
        },
    },
};

export default nextConfig;
