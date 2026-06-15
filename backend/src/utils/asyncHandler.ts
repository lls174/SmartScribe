import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { sendServerError } from './httpResponse'

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export const asyncHandler = (
  handler: AsyncRequestHandler,
  errorMessage = '服务器内部错误'
): RequestHandler => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (error) {
      if (res.headersSent) {
        return next(error)
      }
      sendServerError(res, error, errorMessage)
    }
  }
}
