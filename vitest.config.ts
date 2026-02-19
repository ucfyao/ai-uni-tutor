import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/lib/**', 'src/app/actions/**', 'src/app/api/**', 'src/constants/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'src/lib/supabase/client.ts'],
      thresholds: {
        statements: 60,
        branches: 50,
      },
    },
  },
});
