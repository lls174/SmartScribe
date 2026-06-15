import { useState, useMemo } from 'react'

export const PAGE_SIZE_OPTIONS = ['10', '20', '50']

/**
 * 分页状态 hook，统一 page/limit 状态与 Ant Design Table 的 pagination 配置生成。
 *
 * @param initialLimit 初始每页条数，默认 10
 */
export function usePagination(initialLimit = 10) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(initialLimit)

  /** 生成 Ant Design Table 的 pagination 配置 */
  const getTablePagination = useMemo(
    () => (total: number) => ({
      total,
      pageSize: limit,
      current: page,
      onChange: (nextPage: number) => setPage(nextPage),
      showSizeChanger: true,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      onShowSizeChange: (_: number, nextPageSize: number) => {
        setLimit(nextPageSize)
      }
    }),
    [page, limit]
  )

  return { page, limit, setPage, setLimit, getTablePagination }
}
