import type { UserRole, UserStatus } from '../../../shared/types'

declare global {
  namespace Express {
    interface User {
      id: number
      username: string
      role: UserRole
      status: UserStatus
    }

    interface Request {
      userId?: number
      user?: User
      csrfToken?: () => string
    }
  }
}

export {}
