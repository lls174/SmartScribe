import sequelize from '../src/config/db'
import { NovelVersion } from '../src/models'

const migrateNovelVersion = async (): Promise<void> => {
  try {
    await sequelize.authenticate()
    console.log('数据库连接成功')
    await NovelVersion.sync()
    console.log('novel_versions 表迁移完成')
    process.exit(0)
  } catch (error) {
    console.error('novel_versions 表迁移失败:', error)
    process.exit(1)
  }
}

void migrateNovelVersion()
