/**
 * Highway key — one middleware for every HTTP entry point (main.ts and the legacy http-server.ts).
 *
 * Every surface that lists or runs tools (/tools, /tools/call, /execute, /mcp, /sse, /apps…) needs the
 * `x-highway-key` header matching HIGHWAY_API_KEY. Open without a key: GET /health, GET / (endpoint
 * index + counts), HEAD and OPTIONS (protocol discovery, CORS preflight).
 * Fail closed: with no HIGHWAY_API_KEY configured, guarded paths answer 503, never pass.
 */
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

export const HIGHWAY_KEY_HEADER = 'x-highway-key';
const OPEN_GET_PATHS = new Set(['/health', '/']);

export function highwayKeyGuard(apiKey: string = process.env.HIGHWAY_API_KEY || '') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'HEAD' || req.method === 'OPTIONS' || (req.method === 'GET' && OPEN_GET_PATHS.has(req.path))) {
      next();
      return;
    }
    if (!apiKey) {
      res.status(503).json({ error: 'HIGHWAY_API_KEY is not configured on the server' });
      return;
    }
    const header = req.headers[HIGHWAY_KEY_HEADER];
    const given = Buffer.from(Array.isArray(header) ? header[0] || '' : header || '', 'utf8');
    const expected = Buffer.from(apiKey, 'utf8');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      res.status(401).json({ error: `missing or wrong ${HIGHWAY_KEY_HEADER}` });
      return;
    }
    next();
  };
}
