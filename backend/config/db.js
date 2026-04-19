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

const databaseState = {
  connected: false,
  lastCheckedAt: null,
  lastError: null
}

const setDatabaseState = (connected, error = null) => {
  databaseState.connected = connected
  databaseState.lastCheckedAt = new Date().toISOString()
  databaseState.lastError = error ? error.message : null
}

const connectDatabase = async ({ logSuccess = true, logFailure = true } = {}) => {
  try {
    await sequelize.authenticate()
    setDatabaseState(true)
    if (logSuccess) {
      console.log('数据库连接成功')
    }
    return true
  } catch (error) {
    setDatabaseState(false, error)
    if (logFailure) {
      console.error('数据库连接失败:', error)
    }
    return false
  }
}

const getDatabaseStatus = () => ({ ...databaseState })

module.exports = sequelize
module.exports.connectDatabase = connectDatabase
module.exports.getDatabaseStatus = getDatabaseStatus
