import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['cli/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
