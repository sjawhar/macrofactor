import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClientFromEnv } from '../lib/api/index.js';
import { createServer } from './server.js';

async function main() {
  const client = await createClientFromEnv();
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Fatal:', message);
  process.exit(1);
});
