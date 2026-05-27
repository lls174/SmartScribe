const sequelize = require('../config/db')
const CharacterCard = require('../models/CharacterCard')
const NovelSetting = require('../models/NovelSetting')

const migrate = async () => {
  try {
    console.log('开始迁移小说人物卡与内容设定表...')
    await sequelize.authenticate()

    await CharacterCard.sync()
    await NovelSetting.sync()

    console.log('小说人物卡与内容设定迁移完成')
    process.exit(0)
  } catch (error) {
    console.error('小说人物卡与内容设定迁移失败:', error)
    process.exit(1)
  }
}

migrate()
