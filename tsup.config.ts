import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'mcp/stdio': 'src/mcp/stdio.ts',
    'mcp/http': 'src/mcp/http.ts',
  },
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  noExternal: [/(.*)/],
  external: ['node:*'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
