export interface LabeledOption {
  value: string
  label: string
}

/** 创意类型 */
export const CREATIVE_TYPES: LabeledOption[] = [
  { value: 'trend', label: '流行趋势' },
  { value: 'theme', label: '热门题材' },
  { value: 'element', label: '创意元素' }
]

/** 小说题材（不含「全题材」） */
export const NOVEL_GENRES: LabeledOption[] = [
  { value: 'xuanhuan', label: '玄幻' },
  { value: 'xianxia', label: '仙侠' },
  { value: 'dushi', label: '都市' },
  { value: 'lishi', label: '历史' },
  { value: 'kehuan', label: '科幻' },
  { value: 'yanqing', label: '言情' }
]

/** 「全题材」选项 */
export const GENRE_ALL: LabeledOption = { value: 'all', label: '全题材' }

/** 含「全题材」的题材列表（用于筛选场景） */
export const GENRES_WITH_ALL: LabeledOption[] = [GENRE_ALL, ...NOVEL_GENRES]

const findLabel = (options: LabeledOption[], value?: string): string | undefined =>
  options.find((option) => option.value === value)?.label

/** 获取创意类型对应的中文标签 */
export const getCreativeTypeLabel = (value?: string): string | undefined =>
  findLabel(CREATIVE_TYPES, value)

/** 获取题材对应的中文标签（含「全题材」） */
export const getGenreLabel = (value?: string): string | undefined =>
  findLabel(GENRES_WITH_ALL, value)
