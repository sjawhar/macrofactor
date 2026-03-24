#!/usr/bin/env node
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  JSONRPCMessageSchema,
  MacroFactorClient,
  SUPPORTED_PROTOCOL_VERSIONS,
  createServer,
  isInitializeRequest,
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
} from '../chunk-NLUJUCYA.js';

// src/mcp/http.ts
import { randomUUID } from 'crypto';
import { createServer as createServer2 } from 'http';

// node_modules/.pnpm/@hono+node-server@1.19.11_hono@4.12.8/node_modules/@hono/node-server/dist/index.mjs
import { Http2ServerRequest as Http2ServerRequest2 } from 'http2';
import { Http2ServerRequest } from 'http2';
import { Readable } from 'stream';
import crypto2 from 'crypto';
var RequestError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'RequestError';
  }
};
var toRequestError = (e) => {
  if (e instanceof RequestError) {
    return e;
  }
  return new RequestError(e.message, { cause: e });
};
var GlobalRequest = global.Request;
var Request = class extends GlobalRequest {
  constructor(input, options) {
    if (typeof input === 'object' && getRequestCache in input) {
      input = input[getRequestCache]();
    }
    if (typeof options?.body?.getReader !== 'undefined') {
      options.duplex ??= 'half';
    }
    super(input, options);
  }
};
var newHeadersFromIncoming = (incoming) => {
  const headerRecord = [];
  const rawHeaders = incoming.rawHeaders;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const { [i]: key, [i + 1]: value } = rawHeaders;
    if (key.charCodeAt(0) /*:*/ !== 58) {
      headerRecord.push([key, value]);
    }
  }
  return new Headers(headerRecord);
};
var wrapBodyStream = /* @__PURE__ */ Symbol('wrapBodyStream');
var newRequestFromIncoming = (method, url, headers, incoming, abortController) => {
  const init = {
    method,
    headers,
    signal: abortController.signal,
  };
  if (method === 'TRACE') {
    init.method = 'GET';
    const req = new Request(url, init);
    Object.defineProperty(req, 'method', {
      get() {
        return 'TRACE';
      },
    });
    return req;
  }
  if (!(method === 'GET' || method === 'HEAD')) {
    if ('rawBody' in incoming && incoming.rawBody instanceof Buffer) {
      init.body = new ReadableStream({
        start(controller) {
          controller.enqueue(incoming.rawBody);
          controller.close();
        },
      });
    } else if (incoming[wrapBodyStream]) {
      let reader;
      init.body = new ReadableStream({
        async pull(controller) {
          try {
            reader ||= Readable.toWeb(incoming).getReader();
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        },
      });
    } else {
      init.body = Readable.toWeb(incoming);
    }
  }
  return new Request(url, init);
};
var getRequestCache = /* @__PURE__ */ Symbol('getRequestCache');
var requestCache = /* @__PURE__ */ Symbol('requestCache');
var incomingKey = /* @__PURE__ */ Symbol('incomingKey');
var urlKey = /* @__PURE__ */ Symbol('urlKey');
var headersKey = /* @__PURE__ */ Symbol('headersKey');
var abortControllerKey = /* @__PURE__ */ Symbol('abortControllerKey');
var getAbortController = /* @__PURE__ */ Symbol('getAbortController');
var requestPrototype = {
  get method() {
    return this[incomingKey].method || 'GET';
  },
  get url() {
    return this[urlKey];
  },
  get headers() {
    return (this[headersKey] ||= newHeadersFromIncoming(this[incomingKey]));
  },
  [getAbortController]() {
    this[getRequestCache]();
    return this[abortControllerKey];
  },
  [getRequestCache]() {
    this[abortControllerKey] ||= new AbortController();
    return (this[requestCache] ||= newRequestFromIncoming(
      this.method,
      this[urlKey],
      this.headers,
      this[incomingKey],
      this[abortControllerKey]
    ));
  },
};
[
  'body',
  'bodyUsed',
  'cache',
  'credentials',
  'destination',
  'integrity',
  'mode',
  'redirect',
  'referrer',
  'referrerPolicy',
  'signal',
  'keepalive',
].forEach((k) => {
  Object.defineProperty(requestPrototype, k, {
    get() {
      return this[getRequestCache]()[k];
    },
  });
});
['arrayBuffer', 'blob', 'clone', 'formData', 'json', 'text'].forEach((k) => {
  Object.defineProperty(requestPrototype, k, {
    value: function () {
      return this[getRequestCache]()[k]();
    },
  });
});
Object.setPrototypeOf(requestPrototype, Request.prototype);
var newRequest = (incoming, defaultHostname) => {
  const req = Object.create(requestPrototype);
  req[incomingKey] = incoming;
  const incomingUrl = incoming.url || '';
  if (
    incomingUrl[0] !== '/' && // short-circuit for performance. most requests are relative URL.
    (incomingUrl.startsWith('http://') || incomingUrl.startsWith('https://'))
  ) {
    if (incoming instanceof Http2ServerRequest) {
      throw new RequestError('Absolute URL for :path is not allowed in HTTP/2');
    }
    try {
      const url2 = new URL(incomingUrl);
      req[urlKey] = url2.href;
    } catch (e) {
      throw new RequestError('Invalid absolute URL', { cause: e });
    }
    return req;
  }
  const host = (incoming instanceof Http2ServerRequest ? incoming.authority : incoming.headers.host) || defaultHostname;
  if (!host) {
    throw new RequestError('Missing host header');
  }
  let scheme;
  if (incoming instanceof Http2ServerRequest) {
    scheme = incoming.scheme;
    if (!(scheme === 'http' || scheme === 'https')) {
      throw new RequestError('Unsupported scheme');
    }
  } else {
    scheme = incoming.socket && incoming.socket.encrypted ? 'https' : 'http';
  }
  const url = new URL(`${scheme}://${host}${incomingUrl}`);
  if (url.hostname.length !== host.length && url.hostname !== host.replace(/:\d+$/, '')) {
    throw new RequestError('Invalid host header');
  }
  req[urlKey] = url.href;
  return req;
};
var responseCache = /* @__PURE__ */ Symbol('responseCache');
var getResponseCache = /* @__PURE__ */ Symbol('getResponseCache');
var cacheKey = /* @__PURE__ */ Symbol('cache');
var GlobalResponse = global.Response;
var Response2 = class _Response {
  #body;
  #init;
  [getResponseCache]() {
    delete this[cacheKey];
    return (this[responseCache] ||= new GlobalResponse(this.#body, this.#init));
  }
  constructor(body, init) {
    let headers;
    this.#body = body;
    if (init instanceof _Response) {
      const cachedGlobalResponse = init[responseCache];
      if (cachedGlobalResponse) {
        this.#init = cachedGlobalResponse;
        this[getResponseCache]();
        return;
      } else {
        this.#init = init.#init;
        headers = new Headers(init.#init.headers);
      }
    } else {
      this.#init = init;
    }
    if (
      typeof body === 'string' ||
      typeof body?.getReader !== 'undefined' ||
      body instanceof Blob ||
      body instanceof Uint8Array
    ) {
      this[cacheKey] = [init?.status || 200, body, headers || init?.headers];
    }
  }
  get headers() {
    const cache = this[cacheKey];
    if (cache) {
      if (!(cache[2] instanceof Headers)) {
        cache[2] = new Headers(cache[2] || { 'content-type': 'text/plain; charset=UTF-8' });
      }
      return cache[2];
    }
    return this[getResponseCache]().headers;
  }
  get status() {
    return this[cacheKey]?.[0] ?? this[getResponseCache]().status;
  }
  get ok() {
    const status = this.status;
    return status >= 200 && status < 300;
  }
};
['body', 'bodyUsed', 'redirected', 'statusText', 'trailers', 'type', 'url'].forEach((k) => {
  Object.defineProperty(Response2.prototype, k, {
    get() {
      return this[getResponseCache]()[k];
    },
  });
});
['arrayBuffer', 'blob', 'clone', 'formData', 'json', 'text'].forEach((k) => {
  Object.defineProperty(Response2.prototype, k, {
    value: function () {
      return this[getResponseCache]()[k]();
    },
  });
});
Object.setPrototypeOf(Response2, GlobalResponse);
Object.setPrototypeOf(Response2.prototype, GlobalResponse.prototype);
async function readWithoutBlocking(readPromise) {
  return Promise.race([readPromise, Promise.resolve().then(() => Promise.resolve(void 0))]);
}
function writeFromReadableStreamDefaultReader(reader, writable, currentReadPromise) {
  const cancel = (error) => {
    reader.cancel(error).catch(() => {});
  };
  writable.on('close', cancel);
  writable.on('error', cancel);
  (currentReadPromise ?? reader.read()).then(flow, handleStreamError);
  return reader.closed.finally(() => {
    writable.off('close', cancel);
    writable.off('error', cancel);
  });
  function handleStreamError(error) {
    if (error) {
      writable.destroy(error);
    }
  }
  function onDrain() {
    reader.read().then(flow, handleStreamError);
  }
  function flow({ done, value }) {
    try {
      if (done) {
        writable.end();
      } else if (!writable.write(value)) {
        writable.once('drain', onDrain);
      } else {
        return reader.read().then(flow, handleStreamError);
      }
    } catch (e) {
      handleStreamError(e);
    }
  }
}
function writeFromReadableStream(stream, writable) {
  if (stream.locked) {
    throw new TypeError('ReadableStream is locked.');
  } else if (writable.destroyed) {
    return;
  }
  return writeFromReadableStreamDefaultReader(stream.getReader(), writable);
}
var buildOutgoingHttpHeaders = (headers) => {
  const res = {};
  if (!(headers instanceof Headers)) {
    headers = new Headers(headers ?? void 0);
  }
  const cookies = [];
  for (const [k, v] of headers) {
    if (k === 'set-cookie') {
      cookies.push(v);
    } else {
      res[k] = v;
    }
  }
  if (cookies.length > 0) {
    res['set-cookie'] = cookies;
  }
  res['content-type'] ??= 'text/plain; charset=UTF-8';
  return res;
};
var X_ALREADY_SENT = 'x-hono-already-sent';
if (typeof global.crypto === 'undefined') {
  global.crypto = crypto2;
}
var outgoingEnded = /* @__PURE__ */ Symbol('outgoingEnded');
var handleRequestError = () =>
  new Response(null, {
    status: 400,
  });
var handleFetchError = (e) =>
  new Response(null, {
    status: e instanceof Error && (e.name === 'TimeoutError' || e.constructor.name === 'TimeoutError') ? 504 : 500,
  });
var handleResponseError = (e, outgoing) => {
  const err = e instanceof Error ? e : new Error('unknown error', { cause: e });
  if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
    console.info('The user aborted a request.');
  } else {
    console.error(e);
    if (!outgoing.headersSent) {
      outgoing.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    outgoing.end(`Error: ${err.message}`);
    outgoing.destroy(err);
  }
};
var flushHeaders = (outgoing) => {
  if ('flushHeaders' in outgoing && outgoing.writable) {
    outgoing.flushHeaders();
  }
};
var responseViaCache = async (res, outgoing) => {
  let [status, body, header] = res[cacheKey];
  let hasContentLength = false;
  if (!header) {
    header = { 'content-type': 'text/plain; charset=UTF-8' };
  } else if (header instanceof Headers) {
    hasContentLength = header.has('content-length');
    header = buildOutgoingHttpHeaders(header);
  } else if (Array.isArray(header)) {
    const headerObj = new Headers(header);
    hasContentLength = headerObj.has('content-length');
    header = buildOutgoingHttpHeaders(headerObj);
  } else {
    for (const key in header) {
      if (key.length === 14 && key.toLowerCase() === 'content-length') {
        hasContentLength = true;
        break;
      }
    }
  }
  if (!hasContentLength) {
    if (typeof body === 'string') {
      header['Content-Length'] = Buffer.byteLength(body);
    } else if (body instanceof Uint8Array) {
      header['Content-Length'] = body.byteLength;
    } else if (body instanceof Blob) {
      header['Content-Length'] = body.size;
    }
  }
  outgoing.writeHead(status, header);
  if (typeof body === 'string' || body instanceof Uint8Array) {
    outgoing.end(body);
  } else if (body instanceof Blob) {
    outgoing.end(new Uint8Array(await body.arrayBuffer()));
  } else {
    flushHeaders(outgoing);
    await writeFromReadableStream(body, outgoing)?.catch((e) => handleResponseError(e, outgoing));
  }
  outgoing[outgoingEnded]?.();
};
var isPromise = (res) => typeof res.then === 'function';
var responseViaResponseObject = async (res, outgoing, options = {}) => {
  if (isPromise(res)) {
    if (options.errorHandler) {
      try {
        res = await res;
      } catch (err) {
        const errRes = await options.errorHandler(err);
        if (!errRes) {
          return;
        }
        res = errRes;
      }
    } else {
      res = await res.catch(handleFetchError);
    }
  }
  if (cacheKey in res) {
    return responseViaCache(res, outgoing);
  }
  const resHeaderRecord = buildOutgoingHttpHeaders(res.headers);
  if (res.body) {
    const reader = res.body.getReader();
    const values = [];
    let done = false;
    let currentReadPromise = void 0;
    if (resHeaderRecord['transfer-encoding'] !== 'chunked') {
      let maxReadCount = 2;
      for (let i = 0; i < maxReadCount; i++) {
        currentReadPromise ||= reader.read();
        const chunk = await readWithoutBlocking(currentReadPromise).catch((e) => {
          console.error(e);
          done = true;
        });
        if (!chunk) {
          if (i === 1) {
            await new Promise((resolve) => setTimeout(resolve));
            maxReadCount = 3;
            continue;
          }
          break;
        }
        currentReadPromise = void 0;
        if (chunk.value) {
          values.push(chunk.value);
        }
        if (chunk.done) {
          done = true;
          break;
        }
      }
      if (done && !('content-length' in resHeaderRecord)) {
        resHeaderRecord['content-length'] = values.reduce((acc, value) => acc + value.length, 0);
      }
    }
    outgoing.writeHead(res.status, resHeaderRecord);
    values.forEach((value) => {
      outgoing.write(value);
    });
    if (done) {
      outgoing.end();
    } else {
      if (values.length === 0) {
        flushHeaders(outgoing);
      }
      await writeFromReadableStreamDefaultReader(reader, outgoing, currentReadPromise);
    }
  } else if (resHeaderRecord[X_ALREADY_SENT]) {
  } else {
    outgoing.writeHead(res.status, resHeaderRecord);
    outgoing.end();
  }
  outgoing[outgoingEnded]?.();
};
var getRequestListener = (fetchCallback, options = {}) => {
  const autoCleanupIncoming = options.autoCleanupIncoming ?? true;
  if (options.overrideGlobalObjects !== false && global.Request !== Request) {
    Object.defineProperty(global, 'Request', {
      value: Request,
    });
    Object.defineProperty(global, 'Response', {
      value: Response2,
    });
  }
  return async (incoming, outgoing) => {
    let res, req;
    try {
      req = newRequest(incoming, options.hostname);
      let incomingEnded = !autoCleanupIncoming || incoming.method === 'GET' || incoming.method === 'HEAD';
      if (!incomingEnded) {
        incoming[wrapBodyStream] = true;
        incoming.on('end', () => {
          incomingEnded = true;
        });
        if (incoming instanceof Http2ServerRequest2) {
          outgoing[outgoingEnded] = () => {
            if (!incomingEnded) {
              setTimeout(() => {
                if (!incomingEnded) {
                  setTimeout(() => {
                    incoming.destroy();
                    outgoing.destroy();
                  });
                }
              });
            }
          };
        }
      }
      outgoing.on('close', () => {
        const abortController = req[abortControllerKey];
        if (abortController) {
          if (incoming.errored) {
            req[abortControllerKey].abort(incoming.errored.toString());
          } else if (!outgoing.writableFinished) {
            req[abortControllerKey].abort('Client connection prematurely closed.');
          }
        }
        if (!incomingEnded) {
          setTimeout(() => {
            if (!incomingEnded) {
              setTimeout(() => {
                incoming.destroy();
              });
            }
          });
        }
      });
      res = fetchCallback(req, { incoming, outgoing });
      if (cacheKey in res) {
        return responseViaCache(res, outgoing);
      }
    } catch (e) {
      if (!res) {
        if (options.errorHandler) {
          res = await options.errorHandler(req ? e : toRequestError(e));
          if (!res) {
            return;
          }
        } else if (!req) {
          res = handleRequestError();
        } else {
          res = handleFetchError(e);
        }
      } else {
        return handleResponseError(e, outgoing);
      }
    }
    try {
      return await responseViaResponseObject(res, outgoing, options);
    } catch (e) {
      return handleResponseError(e, outgoing);
    }
  };
};

// node_modules/.pnpm/@modelcontextprotocol+sdk@1.27.1_zod@3.25.76/node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js
var WebStandardStreamableHTTPServerTransport = class {
  constructor(options = {}) {
    this._started = false;
    this._hasHandledRequest = false;
    this._streamMapping = /* @__PURE__ */ new Map();
    this._requestToStreamMapping = /* @__PURE__ */ new Map();
    this._requestResponseMap = /* @__PURE__ */ new Map();
    this._initialized = false;
    this._enableJsonResponse = false;
    this._standaloneSseStreamId = '_GET_stream';
    this.sessionIdGenerator = options.sessionIdGenerator;
    this._enableJsonResponse = options.enableJsonResponse ?? false;
    this._eventStore = options.eventStore;
    this._onsessioninitialized = options.onsessioninitialized;
    this._onsessionclosed = options.onsessionclosed;
    this._allowedHosts = options.allowedHosts;
    this._allowedOrigins = options.allowedOrigins;
    this._enableDnsRebindingProtection = options.enableDnsRebindingProtection ?? false;
    this._retryInterval = options.retryInterval;
  }
  /**
   * Starts the transport. This is required by the Transport interface but is a no-op
   * for the Streamable HTTP transport as connections are managed per-request.
   */
  async start() {
    if (this._started) {
      throw new Error('Transport already started');
    }
    this._started = true;
  }
  /**
   * Helper to create a JSON error response
   */
  createJsonErrorResponse(status, code, message, options) {
    const error = { code, message };
    if (options?.data !== void 0) {
      error.data = options.data;
    }
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error,
        id: null,
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }
    );
  }
  /**
   * Validates request headers for DNS rebinding protection.
   * @returns Error response if validation fails, undefined if validation passes.
   */
  validateRequestHeaders(req) {
    if (!this._enableDnsRebindingProtection) {
      return void 0;
    }
    if (this._allowedHosts && this._allowedHosts.length > 0) {
      const hostHeader = req.headers.get('host');
      if (!hostHeader || !this._allowedHosts.includes(hostHeader)) {
        const error = `Invalid Host header: ${hostHeader}`;
        this.onerror?.(new Error(error));
        return this.createJsonErrorResponse(403, -32e3, error);
      }
    }
    if (this._allowedOrigins && this._allowedOrigins.length > 0) {
      const originHeader = req.headers.get('origin');
      if (originHeader && !this._allowedOrigins.includes(originHeader)) {
        const error = `Invalid Origin header: ${originHeader}`;
        this.onerror?.(new Error(error));
        return this.createJsonErrorResponse(403, -32e3, error);
      }
    }
    return void 0;
  }
  /**
   * Handles an incoming HTTP request, whether GET, POST, or DELETE
   * Returns a Response object (Web Standard)
   */
  async handleRequest(req, options) {
    if (!this.sessionIdGenerator && this._hasHandledRequest) {
      throw new Error('Stateless transport cannot be reused across requests. Create a new transport per request.');
    }
    this._hasHandledRequest = true;
    const validationError = this.validateRequestHeaders(req);
    if (validationError) {
      return validationError;
    }
    switch (req.method) {
      case 'POST':
        return this.handlePostRequest(req, options);
      case 'GET':
        return this.handleGetRequest(req);
      case 'DELETE':
        return this.handleDeleteRequest(req);
      default:
        return this.handleUnsupportedRequest();
    }
  }
  /**
   * Writes a priming event to establish resumption capability.
   * Only sends if eventStore is configured (opt-in for resumability) and
   * the client's protocol version supports empty SSE data (>= 2025-11-25).
   */
  async writePrimingEvent(controller, encoder, streamId, protocolVersion) {
    if (!this._eventStore) {
      return;
    }
    if (protocolVersion < '2025-11-25') {
      return;
    }
    const primingEventId = await this._eventStore.storeEvent(streamId, {});
    let primingEvent = `id: ${primingEventId}
data: 

`;
    if (this._retryInterval !== void 0) {
      primingEvent = `id: ${primingEventId}
retry: ${this._retryInterval}
data: 

`;
    }
    controller.enqueue(encoder.encode(primingEvent));
  }
  /**
   * Handles GET requests for SSE stream
   */
  async handleGetRequest(req) {
    const acceptHeader = req.headers.get('accept');
    if (!acceptHeader?.includes('text/event-stream')) {
      this.onerror?.(new Error('Not Acceptable: Client must accept text/event-stream'));
      return this.createJsonErrorResponse(406, -32e3, 'Not Acceptable: Client must accept text/event-stream');
    }
    const sessionError = this.validateSession(req);
    if (sessionError) {
      return sessionError;
    }
    const protocolError = this.validateProtocolVersion(req);
    if (protocolError) {
      return protocolError;
    }
    if (this._eventStore) {
      const lastEventId = req.headers.get('last-event-id');
      if (lastEventId) {
        return this.replayEvents(lastEventId);
      }
    }
    if (this._streamMapping.get(this._standaloneSseStreamId) !== void 0) {
      this.onerror?.(new Error('Conflict: Only one SSE stream is allowed per session'));
      return this.createJsonErrorResponse(409, -32e3, 'Conflict: Only one SSE stream is allowed per session');
    }
    const encoder = new TextEncoder();
    let streamController;
    const readable = new ReadableStream({
      start: (controller) => {
        streamController = controller;
      },
      cancel: () => {
        this._streamMapping.delete(this._standaloneSseStreamId);
      },
    });
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    };
    if (this.sessionId !== void 0) {
      headers['mcp-session-id'] = this.sessionId;
    }
    this._streamMapping.set(this._standaloneSseStreamId, {
      controller: streamController,
      encoder,
      cleanup: () => {
        this._streamMapping.delete(this._standaloneSseStreamId);
        try {
          streamController.close();
        } catch {}
      },
    });
    return new Response(readable, { headers });
  }
  /**
   * Replays events that would have been sent after the specified event ID
   * Only used when resumability is enabled
   */
  async replayEvents(lastEventId) {
    if (!this._eventStore) {
      this.onerror?.(new Error('Event store not configured'));
      return this.createJsonErrorResponse(400, -32e3, 'Event store not configured');
    }
    try {
      let streamId;
      if (this._eventStore.getStreamIdForEventId) {
        streamId = await this._eventStore.getStreamIdForEventId(lastEventId);
        if (!streamId) {
          this.onerror?.(new Error('Invalid event ID format'));
          return this.createJsonErrorResponse(400, -32e3, 'Invalid event ID format');
        }
        if (this._streamMapping.get(streamId) !== void 0) {
          this.onerror?.(new Error('Conflict: Stream already has an active connection'));
          return this.createJsonErrorResponse(409, -32e3, 'Conflict: Stream already has an active connection');
        }
      }
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      };
      if (this.sessionId !== void 0) {
        headers['mcp-session-id'] = this.sessionId;
      }
      const encoder = new TextEncoder();
      let streamController;
      const readable = new ReadableStream({
        start: (controller) => {
          streamController = controller;
        },
        cancel: () => {},
      });
      const replayedStreamId = await this._eventStore.replayEventsAfter(lastEventId, {
        send: async (eventId, message) => {
          const success = this.writeSSEEvent(streamController, encoder, message, eventId);
          if (!success) {
            this.onerror?.(new Error('Failed replay events'));
            try {
              streamController.close();
            } catch {}
          }
        },
      });
      this._streamMapping.set(replayedStreamId, {
        controller: streamController,
        encoder,
        cleanup: () => {
          this._streamMapping.delete(replayedStreamId);
          try {
            streamController.close();
          } catch {}
        },
      });
      return new Response(readable, { headers });
    } catch (error) {
      this.onerror?.(error);
      return this.createJsonErrorResponse(500, -32e3, 'Error replaying events');
    }
  }
  /**
   * Writes an event to an SSE stream via controller with proper formatting
   */
  writeSSEEvent(controller, encoder, message, eventId) {
    try {
      let eventData = `event: message
`;
      if (eventId) {
        eventData += `id: ${eventId}
`;
      }
      eventData += `data: ${JSON.stringify(message)}

`;
      controller.enqueue(encoder.encode(eventData));
      return true;
    } catch (error) {
      this.onerror?.(error);
      return false;
    }
  }
  /**
   * Handles unsupported requests (PUT, PATCH, etc.)
   */
  handleUnsupportedRequest() {
    this.onerror?.(new Error('Method not allowed.'));
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32e3,
          message: 'Method not allowed.',
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          Allow: 'GET, POST, DELETE',
          'Content-Type': 'application/json',
        },
      }
    );
  }
  /**
   * Handles POST requests containing JSON-RPC messages
   */
  async handlePostRequest(req, options) {
    try {
      const acceptHeader = req.headers.get('accept');
      if (!acceptHeader?.includes('application/json') || !acceptHeader.includes('text/event-stream')) {
        this.onerror?.(new Error('Not Acceptable: Client must accept both application/json and text/event-stream'));
        return this.createJsonErrorResponse(
          406,
          -32e3,
          'Not Acceptable: Client must accept both application/json and text/event-stream'
        );
      }
      const ct = req.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        this.onerror?.(new Error('Unsupported Media Type: Content-Type must be application/json'));
        return this.createJsonErrorResponse(
          415,
          -32e3,
          'Unsupported Media Type: Content-Type must be application/json'
        );
      }
      const requestInfo = {
        headers: Object.fromEntries(req.headers.entries()),
        url: new URL(req.url),
      };
      let rawMessage;
      if (options?.parsedBody !== void 0) {
        rawMessage = options.parsedBody;
      } else {
        try {
          rawMessage = await req.json();
        } catch {
          this.onerror?.(new Error('Parse error: Invalid JSON'));
          return this.createJsonErrorResponse(400, -32700, 'Parse error: Invalid JSON');
        }
      }
      let messages;
      try {
        if (Array.isArray(rawMessage)) {
          messages = rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg));
        } else {
          messages = [JSONRPCMessageSchema.parse(rawMessage)];
        }
      } catch {
        this.onerror?.(new Error('Parse error: Invalid JSON-RPC message'));
        return this.createJsonErrorResponse(400, -32700, 'Parse error: Invalid JSON-RPC message');
      }
      const isInitializationRequest = messages.some(isInitializeRequest);
      if (isInitializationRequest) {
        if (this._initialized && this.sessionId !== void 0) {
          this.onerror?.(new Error('Invalid Request: Server already initialized'));
          return this.createJsonErrorResponse(400, -32600, 'Invalid Request: Server already initialized');
        }
        if (messages.length > 1) {
          this.onerror?.(new Error('Invalid Request: Only one initialization request is allowed'));
          return this.createJsonErrorResponse(
            400,
            -32600,
            'Invalid Request: Only one initialization request is allowed'
          );
        }
        this.sessionId = this.sessionIdGenerator?.();
        this._initialized = true;
        if (this.sessionId && this._onsessioninitialized) {
          await Promise.resolve(this._onsessioninitialized(this.sessionId));
        }
      }
      if (!isInitializationRequest) {
        const sessionError = this.validateSession(req);
        if (sessionError) {
          return sessionError;
        }
        const protocolError = this.validateProtocolVersion(req);
        if (protocolError) {
          return protocolError;
        }
      }
      const hasRequests = messages.some(isJSONRPCRequest);
      if (!hasRequests) {
        for (const message of messages) {
          this.onmessage?.(message, { authInfo: options?.authInfo, requestInfo });
        }
        return new Response(null, { status: 202 });
      }
      const streamId = crypto.randomUUID();
      const initRequest = messages.find((m) => isInitializeRequest(m));
      const clientProtocolVersion = initRequest
        ? initRequest.params.protocolVersion
        : (req.headers.get('mcp-protocol-version') ?? DEFAULT_NEGOTIATED_PROTOCOL_VERSION);
      if (this._enableJsonResponse) {
        return new Promise((resolve) => {
          this._streamMapping.set(streamId, {
            resolveJson: resolve,
            cleanup: () => {
              this._streamMapping.delete(streamId);
            },
          });
          for (const message of messages) {
            if (isJSONRPCRequest(message)) {
              this._requestToStreamMapping.set(message.id, streamId);
            }
          }
          for (const message of messages) {
            this.onmessage?.(message, { authInfo: options?.authInfo, requestInfo });
          }
        });
      }
      const encoder = new TextEncoder();
      let streamController;
      const readable = new ReadableStream({
        start: (controller) => {
          streamController = controller;
        },
        cancel: () => {
          this._streamMapping.delete(streamId);
        },
      });
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      };
      if (this.sessionId !== void 0) {
        headers['mcp-session-id'] = this.sessionId;
      }
      for (const message of messages) {
        if (isJSONRPCRequest(message)) {
          this._streamMapping.set(streamId, {
            controller: streamController,
            encoder,
            cleanup: () => {
              this._streamMapping.delete(streamId);
              try {
                streamController.close();
              } catch {}
            },
          });
          this._requestToStreamMapping.set(message.id, streamId);
        }
      }
      await this.writePrimingEvent(streamController, encoder, streamId, clientProtocolVersion);
      for (const message of messages) {
        let closeSSEStream;
        let closeStandaloneSSEStream;
        if (isJSONRPCRequest(message) && this._eventStore && clientProtocolVersion >= '2025-11-25') {
          closeSSEStream = () => {
            this.closeSSEStream(message.id);
          };
          closeStandaloneSSEStream = () => {
            this.closeStandaloneSSEStream();
          };
        }
        this.onmessage?.(message, {
          authInfo: options?.authInfo,
          requestInfo,
          closeSSEStream,
          closeStandaloneSSEStream,
        });
      }
      return new Response(readable, { status: 200, headers });
    } catch (error) {
      this.onerror?.(error);
      return this.createJsonErrorResponse(400, -32700, 'Parse error', { data: String(error) });
    }
  }
  /**
   * Handles DELETE requests to terminate sessions
   */
  async handleDeleteRequest(req) {
    const sessionError = this.validateSession(req);
    if (sessionError) {
      return sessionError;
    }
    const protocolError = this.validateProtocolVersion(req);
    if (protocolError) {
      return protocolError;
    }
    await Promise.resolve(this._onsessionclosed?.(this.sessionId));
    await this.close();
    return new Response(null, { status: 200 });
  }
  /**
   * Validates session ID for non-initialization requests.
   * Returns Response error if invalid, undefined otherwise
   */
  validateSession(req) {
    if (this.sessionIdGenerator === void 0) {
      return void 0;
    }
    if (!this._initialized) {
      this.onerror?.(new Error('Bad Request: Server not initialized'));
      return this.createJsonErrorResponse(400, -32e3, 'Bad Request: Server not initialized');
    }
    const sessionId = req.headers.get('mcp-session-id');
    if (!sessionId) {
      this.onerror?.(new Error('Bad Request: Mcp-Session-Id header is required'));
      return this.createJsonErrorResponse(400, -32e3, 'Bad Request: Mcp-Session-Id header is required');
    }
    if (sessionId !== this.sessionId) {
      this.onerror?.(new Error('Session not found'));
      return this.createJsonErrorResponse(404, -32001, 'Session not found');
    }
    return void 0;
  }
  /**
   * Validates the MCP-Protocol-Version header on incoming requests.
   *
   * For initialization: Version negotiation handles unknown versions gracefully
   * (server responds with its supported version).
   *
   * For subsequent requests with MCP-Protocol-Version header:
   * - Accept if in supported list
   * - 400 if unsupported
   *
   * For HTTP requests without the MCP-Protocol-Version header:
   * - Accept and default to the version negotiated at initialization
   */
  validateProtocolVersion(req) {
    const protocolVersion = req.headers.get('mcp-protocol-version');
    if (protocolVersion !== null && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
      this.onerror?.(
        new Error(
          `Bad Request: Unsupported protocol version: ${protocolVersion} (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`
        )
      );
      return this.createJsonErrorResponse(
        400,
        -32e3,
        `Bad Request: Unsupported protocol version: ${protocolVersion} (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`
      );
    }
    return void 0;
  }
  async close() {
    this._streamMapping.forEach(({ cleanup }) => {
      cleanup();
    });
    this._streamMapping.clear();
    this._requestResponseMap.clear();
    this.onclose?.();
  }
  /**
   * Close an SSE stream for a specific request, triggering client reconnection.
   * Use this to implement polling behavior during long-running operations -
   * client will reconnect after the retry interval specified in the priming event.
   */
  closeSSEStream(requestId) {
    const streamId = this._requestToStreamMapping.get(requestId);
    if (!streamId) return;
    const stream = this._streamMapping.get(streamId);
    if (stream) {
      stream.cleanup();
    }
  }
  /**
   * Close the standalone GET SSE stream, triggering client reconnection.
   * Use this to implement polling behavior for server-initiated notifications.
   */
  closeStandaloneSSEStream() {
    const stream = this._streamMapping.get(this._standaloneSseStreamId);
    if (stream) {
      stream.cleanup();
    }
  }
  async send(message, options) {
    let requestId = options?.relatedRequestId;
    if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
      requestId = message.id;
    }
    if (requestId === void 0) {
      if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
        throw new Error('Cannot send a response on a standalone SSE stream unless resuming a previous client request');
      }
      let eventId;
      if (this._eventStore) {
        eventId = await this._eventStore.storeEvent(this._standaloneSseStreamId, message);
      }
      const standaloneSse = this._streamMapping.get(this._standaloneSseStreamId);
      if (standaloneSse === void 0) {
        return;
      }
      if (standaloneSse.controller && standaloneSse.encoder) {
        this.writeSSEEvent(standaloneSse.controller, standaloneSse.encoder, message, eventId);
      }
      return;
    }
    const streamId = this._requestToStreamMapping.get(requestId);
    if (!streamId) {
      throw new Error(`No connection established for request ID: ${String(requestId)}`);
    }
    const stream = this._streamMapping.get(streamId);
    if (!this._enableJsonResponse && stream?.controller && stream?.encoder) {
      let eventId;
      if (this._eventStore) {
        eventId = await this._eventStore.storeEvent(streamId, message);
      }
      this.writeSSEEvent(stream.controller, stream.encoder, message, eventId);
    }
    if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
      this._requestResponseMap.set(requestId, message);
      const relatedIds = Array.from(this._requestToStreamMapping.entries())
        .filter(([_, sid]) => sid === streamId)
        .map(([id]) => id);
      const allResponsesReady = relatedIds.every((id) => this._requestResponseMap.has(id));
      if (allResponsesReady) {
        if (!stream) {
          throw new Error(`No connection established for request ID: ${String(requestId)}`);
        }
        if (this._enableJsonResponse && stream.resolveJson) {
          const headers = {
            'Content-Type': 'application/json',
          };
          if (this.sessionId !== void 0) {
            headers['mcp-session-id'] = this.sessionId;
          }
          const responses = relatedIds.map((id) => this._requestResponseMap.get(id));
          if (responses.length === 1) {
            stream.resolveJson(new Response(JSON.stringify(responses[0]), { status: 200, headers }));
          } else {
            stream.resolveJson(new Response(JSON.stringify(responses), { status: 200, headers }));
          }
        } else {
          stream.cleanup();
        }
        for (const id of relatedIds) {
          this._requestResponseMap.delete(id);
          this._requestToStreamMapping.delete(id);
        }
      }
    }
  }
};

// node_modules/.pnpm/@modelcontextprotocol+sdk@1.27.1_zod@3.25.76/node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js
var StreamableHTTPServerTransport = class {
  constructor(options = {}) {
    this._requestContext = /* @__PURE__ */ new WeakMap();
    this._webStandardTransport = new WebStandardStreamableHTTPServerTransport(options);
    this._requestListener = getRequestListener(
      async (webRequest) => {
        const context = this._requestContext.get(webRequest);
        return this._webStandardTransport.handleRequest(webRequest, {
          authInfo: context?.authInfo,
          parsedBody: context?.parsedBody,
        });
      },
      { overrideGlobalObjects: false }
    );
  }
  /**
   * Gets the session ID for this transport instance.
   */
  get sessionId() {
    return this._webStandardTransport.sessionId;
  }
  /**
   * Sets callback for when the transport is closed.
   */
  set onclose(handler) {
    this._webStandardTransport.onclose = handler;
  }
  get onclose() {
    return this._webStandardTransport.onclose;
  }
  /**
   * Sets callback for transport errors.
   */
  set onerror(handler) {
    this._webStandardTransport.onerror = handler;
  }
  get onerror() {
    return this._webStandardTransport.onerror;
  }
  /**
   * Sets callback for incoming messages.
   */
  set onmessage(handler) {
    this._webStandardTransport.onmessage = handler;
  }
  get onmessage() {
    return this._webStandardTransport.onmessage;
  }
  /**
   * Starts the transport. This is required by the Transport interface but is a no-op
   * for the Streamable HTTP transport as connections are managed per-request.
   */
  async start() {
    return this._webStandardTransport.start();
  }
  /**
   * Closes the transport and all active connections.
   */
  async close() {
    return this._webStandardTransport.close();
  }
  /**
   * Sends a JSON-RPC message through the transport.
   */
  async send(message, options) {
    return this._webStandardTransport.send(message, options);
  }
  /**
   * Handles an incoming HTTP request, whether GET or POST.
   *
   * This method converts Node.js HTTP objects to Web Standard Request/Response
   * and delegates to the underlying WebStandardStreamableHTTPServerTransport.
   *
   * @param req - Node.js IncomingMessage, optionally with auth property from middleware
   * @param res - Node.js ServerResponse
   * @param parsedBody - Optional pre-parsed body from body-parser middleware
   */
  async handleRequest(req, res, parsedBody) {
    const authInfo = req.auth;
    const handler = getRequestListener(
      async (webRequest) => {
        return this._webStandardTransport.handleRequest(webRequest, {
          authInfo,
          parsedBody,
        });
      },
      { overrideGlobalObjects: false }
    );
    await handler(req, res);
  }
  /**
   * Close an SSE stream for a specific request, triggering client reconnection.
   * Use this to implement polling behavior during long-running operations -
   * client will reconnect after the retry interval specified in the priming event.
   */
  closeSSEStream(requestId) {
    this._webStandardTransport.closeSSEStream(requestId);
  }
  /**
   * Close the standalone GET SSE stream, triggering client reconnection.
   * Use this to implement polling behavior for server-initiated notifications.
   */
  closeStandaloneSSEStream() {
    this._webStandardTransport.closeStandaloneSSEStream();
  }
};

// src/mcp/http.ts
var MCP_PATH = '/mcp';
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID');
}
function sendJsonError(res, statusCode, message) {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32e3,
        message,
      },
      id: null,
    })
  );
}
function isAuthorized(req, authToken) {
  if (!authToken) {
    return true;
  }
  const authHeader = req.headers.authorization;
  return authHeader === `Bearer ${authToken}`;
}
function isInitializeRequest2(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }
  return 'method' in body && body.method === 'initialize';
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return void 0;
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
  const transports = /* @__PURE__ */ new Map();
  const httpServer = createServer2(async (req, res) => {
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
    const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : void 0;
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
      if (!isInitializeRequest2(parsedBody)) {
        sendJsonError(res, 400, 'Bad Request: No valid session ID provided');
        return;
      }
      let newTransport;
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
      const mcpServer = createServer(client);
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
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Fatal:', message);
  process.exit(1);
});
//# sourceMappingURL=http.js.map
