import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../lib/api/index.js';
import { registerProfileTools } from './tools/profile.js';

export function createServer(client: MacroFactorClient): McpServer {
  const server = new McpServer({
    name: 'macrofactor',
    version: '1.0.0',
  });

  registerProfileTools(server, client);

  return server;
}
