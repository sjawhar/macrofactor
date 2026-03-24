#!/usr/bin/env node
import { JSONRPCMessageSchema, MacroFactorClient, createServer } from '../chunk-NLUJUCYA.js';

// node_modules/.pnpm/@modelcontextprotocol+sdk@1.27.1_zod@3.25.76/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
import process2 from 'process';

// node_modules/.pnpm/@modelcontextprotocol+sdk@1.27.1_zod@3.25.76/node_modules/@modelcontextprotocol/sdk/dist/esm/shared/stdio.js
var ReadBuffer = class {
  append(chunk) {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
  }
  readMessage() {
    if (!this._buffer) {
      return null;
    }
    const index = this._buffer.indexOf('\n');
    if (index === -1) {
      return null;
    }
    const line = this._buffer.toString('utf8', 0, index).replace(/\r$/, '');
    this._buffer = this._buffer.subarray(index + 1);
    return deserializeMessage(line);
  }
  clear() {
    this._buffer = void 0;
  }
};
function deserializeMessage(line) {
  return JSONRPCMessageSchema.parse(JSON.parse(line));
}
function serializeMessage(message) {
  return JSON.stringify(message) + '\n';
}

// node_modules/.pnpm/@modelcontextprotocol+sdk@1.27.1_zod@3.25.76/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
var StdioServerTransport = class {
  constructor(_stdin = process2.stdin, _stdout = process2.stdout) {
    this._stdin = _stdin;
    this._stdout = _stdout;
    this._readBuffer = new ReadBuffer();
    this._started = false;
    this._ondata = (chunk) => {
      this._readBuffer.append(chunk);
      this.processReadBuffer();
    };
    this._onerror = (error) => {
      this.onerror?.(error);
    };
  }
  /**
   * Starts listening for messages on stdin.
   */
  async start() {
    if (this._started) {
      throw new Error(
        'StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.'
      );
    }
    this._started = true;
    this._stdin.on('data', this._ondata);
    this._stdin.on('error', this._onerror);
  }
  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }
  async close() {
    this._stdin.off('data', this._ondata);
    this._stdin.off('error', this._onerror);
    const remainingDataListeners = this._stdin.listenerCount('data');
    if (remainingDataListeners === 0) {
      this._stdin.pause();
    }
    this._readBuffer.clear();
    this.onclose?.();
  }
  send(message) {
    return new Promise((resolve) => {
      const json = serializeMessage(message);
      if (this._stdout.write(json)) {
        resolve();
      } else {
        this._stdout.once('drain', resolve);
      }
    });
  }
};

// src/mcp/stdio.ts
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
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Fatal:', message);
  process.exit(1);
});
//# sourceMappingURL=stdio.js.map
