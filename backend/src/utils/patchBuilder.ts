export const buildPatch = <T extends Record<string, unknown>, K extends keyof T>(
  body: Partial<T> | null | undefined,
  allowedFields: readonly K[]
): Partial<Pick<T, K>> => {
  return allowedFields.reduce<Partial<Pick<T, K>>>((patch, field) => {
    if (body && typeof body[field] !== 'undefined') {
      patch[field] = body[field] as T[K]
    }
    return patch
  }, {})
}
