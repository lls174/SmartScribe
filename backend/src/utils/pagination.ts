import type { Request } from 'express'

export interface ParsedPagination {
  page: number
  limit: number
  offset: number
}

interface PaginationOptions {
  defaultLimit?: number
  maxLimit?: number
}

export const parsePagination = (
  req: Request,
  { defaultLimit = 10, maxLimit = 100 }: PaginationOptions = {}
): ParsedPagination => {
  const page = Math.max(parseInt(String(req.query.page ?? ''), 10) || 1, 1)
  const rawLimit = parseInt(String(req.query.limit ?? ''), 10) || defaultLimit
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit)
  return { page, limit, offset: (page - 1) * limit }
}
