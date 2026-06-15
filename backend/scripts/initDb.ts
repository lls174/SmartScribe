import sequelize from '../src/config/db'
import {
  AiCredential,
  AiRequestLog,
  Chapter,
  CharacterCard,
  Creative,
  Feedback,
  GenerationHistory,
  Novel,
  NovelSetting,
  NovelVersion,
  User
} from '../src/models'

const initDatabase = async (): Promise<void> => {
  try {
    console.log('开始初始化数据库...')
    await sequelize.authenticate()
    console.log('数据库连接成功')

    // 确保所有模型已注册后再 sync
    void User
    void Novel
    void Chapter
    void Feedback
    void Creative
    void NovelVersion
    void GenerationHistory
    void AiRequestLog
    void CharacterCard
    void NovelSetting
    void AiCredential

    await sequelize.sync({ force: false, alter: false })
    console.log('数据库表同步完成')
    console.log('数据库初始化成功！')
    process.exit(0)
  } catch (error) {
    console.error('数据库初始化失败:', error)
    process.exit(1)
  }
}

void initDatabase()
