import { Chapter, Novel } from '../models'

interface FindOwnedNovelOptions {
  includeDeleted?: boolean
}

export const findOwnedNovel = async (
  novelId: number | string,
  userId: number,
  { includeDeleted = false }: FindOwnedNovelOptions = {}
): Promise<Novel | null> => {
  const where: { id: number; userId: number; isDeleted?: boolean } = {
    id: parseInt(String(novelId), 10),
    userId
  }
  if (!includeDeleted) {
    where.isDeleted = false
  }
  return Novel.findOne({ where })
}

export const findOwnedChapter = async (
  chapterId: number | string,
  userId: number
): Promise<Chapter | null> => {
  return Chapter.findOne({
    include: [{ model: Novel, where: { userId } }],
    where: { id: parseInt(String(chapterId), 10) }
  })
}
