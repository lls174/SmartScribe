const sequelize = require('../config/db')
const User = require('../models/User')
const Novel = require('../models/Novel')
const Chapter = require('../models/Chapter')
const Feedback = require('../models/Feedback')
const Creative = require('../models/Creative')

const initDatabase = async () => {
  try {
    console.log('开始初始化数据库...')
    
    await sequelize.authenticate()
    console.log('数据库连接成功')
    
    // 同步所有模型到数据库
    // force: false - 如果表已存在，不删除重建
    // alter: false - 不修改现有表结构（避免索引过多错误）
    await sequelize.sync({ force: false, alter: false })
    console.log('数据库表同步完成')
    
    console.log('数据库初始化成功！')
    console.log('提示：如果需要更新表结构，请手动删除对应表后重新运行此脚本')
    process.exit(0)
  } catch (error) {
    console.error('数据库初始化失败:', error)
    process.exit(1)
  }
}

initDatabase()
