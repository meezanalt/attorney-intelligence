import type { NextApiResponse } from 'next';

type FlushableResponse = NextApiResponse & {
  flushHeaders?: () => void;
  flush?: () => void;
};

/** Open SSE response headers. Call once before writing any events. */
export function initSse(res: NextApiResponse): void {
  const r = res as FlushableResponse;
  r.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof r.flushHeaders === 'function') r.flushHeaders();
}

/** Write one SSE `data:` event and flush if possible. */
export function sendSse(res: NextApiResponse, payload: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  const r = res as FlushableResponse;
  r.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof r.flush === 'function') r.flush();
}

export function endSse(res: NextApiResponse): void {
  if (!res.writableEnded) res.end();
}
