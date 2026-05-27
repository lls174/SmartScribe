const sequelize = require('../config/db')
const User = require('./User')
const Novel = require('./Novel')
const Chapter = require('./Chapter')
const Feedback = require('./Feedback')
const Creative = require('./Creative')
const NovelVersion = require('./NovelVersion')
const GenerationHistory = require('./GenerationHistory')
const AiRequestLog = require('./AiRequestLog')
const CharacterCard = require('./CharacterCard')
const NovelSetting = require('./NovelSetting')

// 关联关系
User.hasMany(Novel, { foreignKey: 'userId' })
Novel.belongsTo(User, { foreignKey: 'userId' })

Novel.hasMany(Chapter, { foreignKey: 'novelId' })
Chapter.belongsTo(Novel, { foreignKey: 'novelId' })

User.hasMany(Feedback, { foreignKey: 'userId' })
Feedback.belongsTo(User, { foreignKey: 'userId' })

User.hasMany(Creative, { foreignKey: 'userId' })
Creative.belongsTo(User, { foreignKey: 'userId' })

User.hasMany(NovelVersion, { foreignKey: 'userId' })
NovelVersion.belongsTo(User, { foreignKey: 'userId' })
Novel.hasMany(NovelVersion, { foreignKey: 'novelId' })
NovelVersion.belongsTo(Novel, { foreignKey: 'novelId' })

User.hasMany(GenerationHistory, { foreignKey: 'userId' })
GenerationHistory.belongsTo(User, { foreignKey: 'userId' })
Novel.hasMany(GenerationHistory, { foreignKey: 'novelId' })
GenerationHistory.belongsTo(Novel, { foreignKey: 'novelId' })
Chapter.hasMany(GenerationHistory, { foreignKey: 'chapterId' })
GenerationHistory.belongsTo(Chapter, { foreignKey: 'chapterId' })

User.hasMany(AiRequestLog, { foreignKey: 'userId' })
AiRequestLog.belongsTo(User, { foreignKey: 'userId' })
Novel.hasMany(AiRequestLog, { foreignKey: 'novelId' })
AiRequestLog.belongsTo(Novel, { foreignKey: 'novelId' })
Chapter.hasMany(AiRequestLog, { foreignKey: 'chapterId' })
AiRequestLog.belongsTo(Chapter, { foreignKey: 'chapterId' })

Novel.hasMany(CharacterCard, { foreignKey: 'novelId' })
CharacterCard.belongsTo(Novel, { foreignKey: 'novelId' })
Novel.hasOne(NovelSetting, { foreignKey: 'novelId' })
NovelSetting.belongsTo(Novel, { foreignKey: 'novelId' })

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
  Feedback,
  Creative,
  NovelVersion,
  GenerationHistory,
  AiRequestLog,
  CharacterCard,
  NovelSetting
}