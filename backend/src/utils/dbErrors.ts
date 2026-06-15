interface SequelizeLikeError {
  original?: {
    code?: string
    sqlMessage?: string
  }
  parent?: {
    code?: string
  }
  message?: string
}

export const isMissingTableError = (error: unknown): boolean => {
  const err = error as SequelizeLikeError
  const code = err?.original?.code || err?.parent?.code
  const message = String(err?.original?.sqlMessage || err?.message || '')
  return (
    code === 'ER_NO_SUCH_TABLE' ||
    message.includes("doesn't exist") ||
    message.includes('no such table')
  )
}
