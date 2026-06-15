import sequelize from '../src/config/db'
import { AiCredential } from '../src/models'

const migrateAiCredential = async (): Promise<void> => {
  try {
    await sequelize.authenticate()
    await AiCredential.sync({ alter: true })
    console.log('ai_credentials 表迁移完成')
    process.exit(0)
  } catch (error) {
    console.error('ai_credentials 表迁移失败:', error)
    process.exit(1)
  }
}

void migrateAiCredential()
