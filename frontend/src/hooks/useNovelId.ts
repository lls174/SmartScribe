import { useParams } from 'react-router-dom'

/**
 * 统一解析路由中的小说 id 参数。
 * @returns id 原始字符串、novelId 数字、isValid 是否为有效数字
 */
export function useNovelId() {
  const { id } = useParams<{ id: string }>()
  const novelId = Number(id)
  return {
    id,
    novelId,
    isValid: Number.isFinite(novelId)
  }
}
