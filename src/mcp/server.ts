import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../lib/api/index.js';
import { registerFoodTools } from './tools/food.js';
import { registerNutritionTools } from './tools/nutrition.js';
import { registerProfileTools } from './tools/profile.js';
import { registerWeightTools } from './tools/weight.js';
import { registerWorkoutTools } from './tools/workout.js';

export function createServer(client: MacroFactorClient): McpServer {
  const server = new McpServer({
    name: 'macrofactor',
    version: '1.0.0',
  });

  registerProfileTools(server, client);
  registerFoodTools(server, client);
  registerNutritionTools(server, client);
  registerWeightTools(server, client);
  registerWorkoutTools(server, client);

  return server;
}
