import type { NextFunction, Request, Response } from "express";

export function ok(res: Response, data: unknown) {
  return res.json({ ok: true, data });
}

export function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ ok: false, error: { message } });
}

export function asyncRoute<TReq extends Request = Request>(
  handler: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: TReq, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

