const sequelize = require('../config/db')
const User = require('./User')
const Novel = require('./Novel')
const Chapter = require('./Chapter')
const Feedback = require('./Feedback')

// 关联关系
User.hasMany(Novel, { foreignKey: 'userId' })
Novel.belongsTo(User, { foreignKey: 'userId' })

Novel.hasMany(Chapter, { foreignKey: 'novelId' })
Chapter.belongsTo(Novel, { foreignKey: 'novelId' })

User.hasMany(Feedback, { foreignKey: 'userId' })
Feedback.belongsTo(User, { foreignKey: 'userId' })

// 同步数据库
const syncDatabase = async () => {
  try {
    // 禁用自动同步，避免修改表结构
    // await sequelize.sync({ alter: true })
    console.log('数据库同步已禁用')
  } catch (error) {
    console.error('数据库同步失败:', error)
  }
}

syncDatabase()

module.exports = {
  User,
  Novel,
  Chapter,
  Feedback
}