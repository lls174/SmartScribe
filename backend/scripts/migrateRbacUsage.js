const sequelize = require('../config/db')
const User = require('../models/User')
const AiRequestLog = require('../models/AiRequestLog')

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName)
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition)
    console.log(`已添加字段 ${tableName}.${columnName}`)
  }
}

const migrate = async () => {
  try {
    console.log('开始迁移 RBAC 与 AI 用量日志表...')
    await sequelize.authenticate()

    const queryInterface = sequelize.getQueryInterface()

    await addColumnIfMissing(queryInterface, 'users', 'role', {
      type: User.rawAttributes.role.type,
      allowNull: false,
      defaultValue: 'user'
    })
    await addColumnIfMissing(queryInterface, 'users', 'status', {
      type: User.rawAttributes.status.type,
      allowNull: false,
      defaultValue: 'active'
    })
    await addColumnIfMissing(queryInterface, 'users', 'bannedAt', {
      type: User.rawAttributes.bannedAt.type,
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'users', 'banReason', {
      type: User.rawAttributes.banReason.type,
      allowNull: true
    })

    await AiRequestLog.sync()
    console.log('RBAC 与 AI 用量日志迁移完成')
    process.exit(0)
  } catch (error) {
    console.error('RBAC 与 AI 用量日志迁移失败:', error)
    process.exit(1)
  }
}

migrate()
