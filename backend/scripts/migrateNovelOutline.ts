import sequelize from '../src/config/db'

const migrate = async () => {
  try {
    console.log('开始迁移小说大纲字段...')
    await sequelize.authenticate()

    const [settingCols] = await sequelize.query(
      "SHOW COLUMNS FROM novel_settings LIKE 'overallOutline'"
    ) as [Array<{ Field: string }>, unknown]
    if (settingCols.length === 0) {
      await sequelize.query(
        'ALTER TABLE novel_settings ADD COLUMN overallOutline TEXT NULL AFTER notes'
      )
      console.log('已添加 novel_settings.overallOutline')
    }

    const [chapterCols] = await sequelize.query(
      "SHOW COLUMNS FROM chapters LIKE 'outline'"
    ) as [Array<{ Field: string }>, unknown]
    if (chapterCols.length === 0) {
      await sequelize.query(
        'ALTER TABLE chapters ADD COLUMN outline TEXT NULL AFTER plot'
      )
      console.log('已添加 chapters.outline')
    }

    console.log('小说大纲字段迁移完成')
    process.exit(0)
  } catch (error) {
    console.error('小说大纲字段迁移失败:', error)
    process.exit(1)
  }
}

void migrate()
