import { DataTypes, type QueryInterface } from 'sequelize'
import sequelize from '../src/config/db'
import { AiModelAlias, AiModelCatalog, AiModelPrice } from '../src/models'
import { seedCatalogIfEmpty } from '../src/services/aiCatalogService'

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

/** 补齐用量拆账、花费快照，并创建模型目录/单价表。 */
const migrate = async (): Promise<void> => {
  try {
    console.log('开始迁移 AI 用量与后台计价...')
    await sequelize.authenticate()
    const queryInterface = sequelize.getQueryInterface()

    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'keySource', {
      type: DataTypes.ENUM('env', 'user'),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'tokenSource', {
      type: DataTypes.ENUM('api', 'tokenizer', 'heuristic'),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'cachedPromptTokens', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'uncachedPromptTokens', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'costAmount', {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'costCurrency', {
      type: DataTypes.STRING(8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'costAmountCny', {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'fxRateUsed', {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'fxRateSource', {
      type: DataTypes.STRING(64),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'inputPrice', {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'cachedInputPrice', {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'outputPrice', {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true
    })
    await addColumnIfMissing(queryInterface, 'ai_request_logs', 'costFlag', {
      type: DataTypes.STRING(128),
      allowNull: true
    })

    await AiModelCatalog.sync()
    await AiModelAlias.sync()
    await AiModelPrice.sync()
    await seedCatalogIfEmpty()
    console.log('AI 用量与后台计价迁移完成')
  } catch (error) {
    console.error('AI 用量与后台计价迁移失败:', error)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

void migrate()
