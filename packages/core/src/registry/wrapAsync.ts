import type { RequestHandler } from "express";

/**
 * Express 4 does not forward a rejected promise from an async handler to
 * next() automatically — an unhandled rejection just hangs the request. Wrap
 * any async route/middleware handler with this so rejections reach the error
 * middleware like a synchronous throw would.
 */
export function wrapAsync(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
