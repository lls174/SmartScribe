import { DataTypes, type QueryInterface } from 'sequelize'
import sequelize from '../src/config/db'
import { AppSetting } from '../src/models'

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

/** 补充用户自备密钥开关，以及站点默认平台/模型。 */
const migrate = async (): Promise<void> => {
  try {
    console.log('开始迁移 AI 密钥偏好与站点默认...')
    await sequelize.authenticate()
    const queryInterface = sequelize.getQueryInterface()

    await addColumnIfMissing(queryInterface, 'users', 'useOwnAiKey', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    })

    await sequelize.query(`
      UPDATE users
      SET useOwnAiKey = 1
      WHERE id IN (SELECT DISTINCT userId FROM ai_credentials)
        AND useOwnAiKey = 0
    `)
    console.log('已为已保存密钥的用户打开自备密钥开关')

    await AppSetting.sync()
    console.log('AI 密钥偏好与站点默认迁移完成')
  } catch (error) {
    console.error('AI 密钥偏好与站点默认迁移失败:', error)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

void migrate()
