import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MacroFactorClient } from '../lib/api/index.js';
import { createServer } from './server.js';

async function main() {
  const username = process.env.MACROFACTOR_USERNAME;
  const password = process.env.MACROFACTOR_PASSWORD;

  if (!username || !password) {
    console.error('Missing credentials. Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD environment variables.');
    process.exit(1);
  }

  const client = await MacroFactorClient.login(username, password);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Fatal:', message);
  process.exit(1);
});
