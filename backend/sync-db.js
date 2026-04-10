const sequelize = require('./config/db')
const Chapter = require('./models/Chapter')

async function syncDatabase() {
  try {
    // 同步数据库结构，添加新字段
    await sequelize.sync({ alter: true })
    console.log('数据库结构同步成功')
    
    // 为现有章节设置 order 字段
    const chapters = await Chapter.findAll()
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].order === 0 || chapters[i].order === undefined) {
        await chapters[i].update({ order: i })
      }
    }
    console.log('章节顺序初始化完成')
    
    process.exit(0)
  } catch (error) {
    console.error('数据库结构同步失败:', error)
    process.exit(1)
  }
}

syncDatabase()