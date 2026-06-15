declare module 'csurf' {
  import type { RequestHandler } from 'express'

  interface CookieOptions {
    key?: string
    path?: string
    signed?: boolean
    secure?: boolean
    maxAge?: number
    httpOnly?: boolean
    sameSite?: boolean | 'lax' | 'strict' | 'none'
  }

  interface CsurfOptions {
    cookie?: boolean | CookieOptions
    ignoreMethods?: string[]
    sessionKey?: string
    value?: (req: unknown) => string
  }

  function csurf(options?: CsurfOptions): RequestHandler
  export = csurf
}
