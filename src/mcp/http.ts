import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MacroFactorClient } from '../lib/api/index.js';
import { createServer as createMcpServer } from './server.js';

const MCP_PATH = '/mcp';

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID');
}

function sendJsonError(res: ServerResponse, statusCode: number, message: string): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message,
      },
      id: null,
    })
  );
}

function isAuthorized(req: IncomingMessage, authToken?: string): boolean {
  if (!authToken) {
    return true;
  }

  const authHeader = req.headers.authorization;
  return authHeader === `Bearer ${authToken}`;
}

function isInitializeRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }

  return 'method' in body && body.method === 'initialize';
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return undefined;
  }

  return JSON.parse(rawBody);
}

async function main() {
  const username = process.env.MACROFACTOR_USERNAME;
  const password = process.env.MACROFACTOR_PASSWORD;
  const authToken = process.env.MCP_AUTH_TOKEN;
  const port = Number(process.env.PORT ?? '3001');

  if (!username || !password) {
    console.error('Missing credentials. Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD environment variables.');
    process.exit(1);
  }

  if (!authToken) {
    console.warn('Warning: MCP_AUTH_TOKEN is not set. HTTP MCP endpoint is running without authentication.');
  }

  const client = await MacroFactorClient.login(username, password);
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    setCorsHeaders(res);

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== MCP_PATH) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET,POST,OPTIONS');
      res.end('Method Not Allowed');
      return;
    }

    if (!isAuthorized(req, authToken)) {
      sendJsonError(res, 401, 'Unauthorized');
      return;
    }

    const sessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;

    try {
      if (req.method === 'GET') {
        if (!sessionId) {
          sendJsonError(res, 400, 'Bad Request: Mcp-Session-Id header is required');
          return;
        }

        const existingTransport = transports.get(sessionId);
        if (!existingTransport) {
          sendJsonError(res, 404, 'Session not found');
          return;
        }

        await existingTransport.handleRequest(req, res);
        return;
      }

      const parsedBody = await readJsonBody(req);

      if (sessionId) {
        const existingTransport = transports.get(sessionId);
        if (!existingTransport) {
          sendJsonError(res, 404, 'Session not found');
          return;
        }

        await existingTransport.handleRequest(req, res, parsedBody);
        return;
      }

      if (!isInitializeRequest(parsedBody)) {
        sendJsonError(res, 400, 'Bad Request: No valid session ID provided');
        return;
      }

      let newTransport: StreamableHTTPServerTransport;
      newTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          transports.set(initializedSessionId, newTransport);
        },
      });

      newTransport.onclose = () => {
        const sid = newTransport.sessionId;
        if (sid) {
          transports.delete(sid);
        }
      };

      const mcpServer = createMcpServer(client);
      await mcpServer.connect(newTransport);
      await newTransport.handleRequest(req, res, parsedBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('JSON')) {
        sendJsonError(res, 400, 'Invalid JSON body');
        return;
      }

      if (!res.headersSent) {
        sendJsonError(res, 500, 'Internal server error');
      }

      console.error('Error handling /mcp request:', message);
    }
  });

  httpServer.listen(port, () => {
    console.log(`MCP HTTP server listening on http://localhost:${port}${MCP_PATH}`);
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Fatal:', message);
  process.exit(1);
});
