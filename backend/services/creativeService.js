const Creative = require('../models/Creative')

class CreativeService {
  async createCreative(userId, title, type, genre, content) {
    return Creative.create({
      userId,
      title,
      type,
      genre,
      content
    })
  }

  async getCreativesByUserId(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit
    const where = { userId, isDeleted: false }

    const [creatives, total] = await Promise.all([
      Creative.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset
      }),
      Creative.count({ where })
    ])

    return { creatives, total, page, limit }
  }

  async getCreativeById(id, userId) {
    return Creative.findOne({
      where: { id, userId, isDeleted: false }
    })
  }

  async updateCreative(id, userId, data) {
    const [updated] = await Creative.update(data, {
      where: { id, userId, isDeleted: false }
    })
    return updated > 0
  }

  async deleteCreative(id, userId) {
    const [deleted] = await Creative.update(
      { isDeleted: true, deletedAt: new Date() },
      { where: { id, userId, isDeleted: false } }
    )
    return deleted > 0
  }
}

module.exports = new CreativeService()
