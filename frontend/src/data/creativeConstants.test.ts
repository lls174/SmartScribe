import { describe, test, expect } from 'vitest'
import {
  CREATIVE_TYPES,
  NOVEL_GENRES,
  GENRES_WITH_ALL,
  getCreativeTypeLabel,
  getGenreLabel
} from './creativeConstants'

describe('creativeConstants', () => {
  test('GENRES_WITH_ALL 以「全题材」开头并包含全部题材', () => {
    expect(GENRES_WITH_ALL[0].value).toBe('all')
    expect(GENRES_WITH_ALL.length).toBe(NOVEL_GENRES.length + 1)
  })

  test('getCreativeTypeLabel 返回对应标签', () => {
    expect(getCreativeTypeLabel('trend')).toBe('流行趋势')
    expect(getCreativeTypeLabel(CREATIVE_TYPES[2].value)).toBe('创意元素')
    expect(getCreativeTypeLabel('unknown')).toBeUndefined()
    expect(getCreativeTypeLabel(undefined)).toBeUndefined()
  })

  test('getGenreLabel 支持全题材与普通题材', () => {
    expect(getGenreLabel('all')).toBe('全题材')
    expect(getGenreLabel('xuanhuan')).toBe('玄幻')
    expect(getGenreLabel('unknown')).toBeUndefined()
  })
})
