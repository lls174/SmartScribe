import { DataTypes, type QueryInterface } from 'sequelize'
import sequelize from '../src/config/db'
import { AiRequestLog } from '../src/models'

type ColumnDefinition = Parameters<QueryInterface['addColumn']>[3]

/** 仅在字段缺失时追加，保证迁移脚本可以安全重复执行。 */
const addColumnIfMissing = async (
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
  definition: ColumnDefinition
): Promise<void> => {
  const table = await queryInterface.describeTable(tableName)
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition)
    console.log(`已添加字段 ${tableName}.${columnName}`)
  }
}

/** 为旧数据库补齐 RBAC 字段及 AI 用量日志表。 */
const migrate = async (): Promise<void> => {
  try {
    console.log('开始迁移 RBAC 与 AI 用量日志表...')
    await sequelize.authenticate()
    const queryInterface = sequelize.getQueryInterface()

    await addColumnIfMissing(queryInterface, 'users', 'role', {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user'
    })
    await addColumnIfMissing(queryInterface, 'users', 'status', {
      type: DataTypes.ENUM('active', 'banned'),
      allowNull: false,
      defaultValue: 'active'
    })
    await addColumnIfMissing(queryInterface, 'users', 'bannedAt', {
      type: DataTypes.DATE,
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'users', 'banReason', {
      type: DataTypes.STRING,
      allowNull: true
    })

    await AiRequestLog.sync()
    console.log('RBAC 与 AI 用量日志迁移完成')
  } catch (error) {
    console.error('RBAC 与 AI 用量日志迁移失败:', error)
    process.exitCode = 1
  } finally {
    // 主动关闭连接池，避免脚本结束后残留数据库句柄。
    await sequelize.close()
  }
}

void migrate()
