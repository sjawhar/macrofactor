import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../../lib/api/index.js';

export function registerProfileTools(server: McpServer, client: MacroFactorClient): void {
  server.tool(
    'get_profile',
    `Retrieve the user's MacroFactor profile and account preferences. Use this to understand the user's settings (units, timezone, etc.) before performing other operations. Returns profile data as JSON. See also: get_goals for macro targets.`,
    {},
    async () => {
      const profile = await client.getProfile();
      return { content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }] };
    }
  );
}
