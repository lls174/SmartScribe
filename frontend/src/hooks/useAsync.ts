import { useState, useEffect, useCallback, useRef } from 'react'

interface UseAsyncOptions {
  /** 是否在挂载/依赖变化时自动执行，默认 true */
  immediate?: boolean
  /** 出错回调（用于 message 提示等） */
  onError?: (error: unknown) => void
}

/**
 * 统一的异步数据请求 hook，封装 loading / error / data 状态与 try/catch/finally 样板。
 *
 * @param asyncFn 异步函数
 * @param deps 依赖数组（变化时重新执行）
 * @param options 配置项
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions = {}
) {
  const { immediate = true, onError } = options
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(immediate)
  const [error, setError] = useState<unknown>(null)

  // 用 ref 保存最新回调，避免把它们放进依赖造成额外执行
  const asyncFnRef = useRef(asyncFn)
  asyncFnRef.current = asyncFn
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFnRef.current()
      setData(result)
      return result
    } catch (err) {
      setError(err)
      onErrorRef.current?.(err)
      return undefined
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (immediate) {
      run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, run, setData }
}
