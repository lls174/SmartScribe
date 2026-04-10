const Creative = require('../models/Creative')

class CreativeService {
  async createCreative(userId, title, type, genre, content) {
    try {
      const creative = await Creative.create({
        userId,
        title,
        type,
        genre,
        content
      })
      return creative
    } catch (error) {
      console.error('创建创意失败:', error)
      throw error
    }
  }

  async getCreativesByUserId(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit
      const creatives = await Creative.findAll({
        where: {
          userId,
          isDeleted: false
        },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      })
      
      const total = await Creative.count({
        where: {
          userId,
          isDeleted: false
        }
      })
      
      return {
        creatives,
        total,
        page,
        limit
      }
    } catch (error) {
      console.error('获取创意列表失败:', error)
      throw error
    }
  }

  async getCreativeById(id, userId) {
    try {
      const creative = await Creative.findOne({
        where: {
          id,
          userId,
          isDeleted: false
        }
      })
      return creative
    } catch (error) {
      console.error('获取创意详情失败:', error)
      throw error
    }
  }

  async updateCreative(id, userId, data) {
    try {
      const [updated] = await Creative.update(data, {
        where: {
          id,
          userId,
          isDeleted: false
        }
      })
      return updated > 0
    } catch (error) {
      console.error('更新创意失败:', error)
      throw error
    }
  }

  async deleteCreative(id, userId) {
    try {
      const [deleted] = await Creative.update(
        {
          isDeleted: true,
          deletedAt: new Date()
        },
        {
          where: {
            id,
            userId,
            isDeleted: false
          }
        }
      )
      return deleted > 0
    } catch (error) {
      console.error('删除创意失败:', error)
      throw error
    }
  }
}

module.exports = new CreativeService()
