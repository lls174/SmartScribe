const { Sequelize } = require('sequelize')
require('dotenv').config()

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_scribe',
  logging: process.env.NODE_ENV === 'production' ? false : console.log
})

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate()
    console.log('数据库连接成功')
  } catch (error) {
    console.error('数据库连接失败:', error)
  }
}

testConnection()

module.exports = sequelize
