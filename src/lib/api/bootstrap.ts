import { MacroFactorClient } from './client';

export async function createClientFromEnv(): Promise<MacroFactorClient> {
  const token = process.env.MACROFACTOR_AUTH_TOKEN;
  if (token) return MacroFactorClient.fromRefreshToken(token);

  const username = process.env.MACROFACTOR_USERNAME;
  const password = process.env.MACROFACTOR_PASSWORD;
  if (username && password) return MacroFactorClient.login(username, password);

  throw new Error(
    'Missing credentials. Set MACROFACTOR_AUTH_TOKEN, or MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD.'
  );
}
