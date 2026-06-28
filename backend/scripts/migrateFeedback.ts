import sequelize from '../src/config/db'
import { Feedback } from '../src/models'

const migrateFeedback = async (): Promise<void> => {
  try {
    await sequelize.authenticate()
    console.log('数据库连接成功')
    await Feedback.sync()
    console.log('feedback 表迁移完成')
    process.exit(0)
  } catch (error) {
    console.error('feedback 表迁移失败:', error)
    process.exit(1)
  }
}

void migrateFeedback()
