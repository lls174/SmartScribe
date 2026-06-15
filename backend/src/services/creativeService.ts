import { Creative } from '../models'

export interface CreateCreativeInput {
  userId: number
  title: string
  type: string
  genre?: string | null
  content: string
}

class CreativeService {
  async createCreative(userId: number, title: string, type: string, genre: string | null | undefined, content: string): Promise<Creative> {
    return Creative.create({ userId, title, type, genre: genre ?? null, content })
  }

  async getCreativesByUserId(userId: number, page = 1, limit = 10): Promise<{
    creatives: Creative[]
    total: number
    page: number
    limit: number
  }> {
    const offset = (page - 1) * limit
    const where = { userId, isDeleted: false }

    const [creatives, total] = await Promise.all([
      Creative.findAll({ where, order: [['createdAt', 'DESC']], limit, offset }),
      Creative.count({ where })
    ])

    return { creatives, total, page, limit }
  }

  async getCreativeById(id: number | string, userId: number): Promise<Creative | null> {
    return Creative.findOne({ where: { id, userId, isDeleted: false } })
  }

  async updateCreative(id: number | string, userId: number, data: Partial<Pick<Creative, 'title' | 'content' | 'genre'>>): Promise<boolean> {
    const [updated] = await Creative.update(data, { where: { id, userId, isDeleted: false } })
    return updated > 0
  }

  async deleteCreative(id: number | string, userId: number): Promise<boolean> {
    const [deleted] = await Creative.update(
      { isDeleted: true, deletedAt: new Date() },
      { where: { id, userId, isDeleted: false } }
    )
    return deleted > 0
  }
}

export default new CreativeService()
