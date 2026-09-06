import { DataTypes, QueryTypes, type QueryInterface } from 'sequelize'
import sequelize from '../src/config/db'

type TableDescription = Record<string, unknown>

/** 字段不存在时添加，保证迁移可重复执行。 */
const addColumnIfMissing = async (
  queryInterface: QueryInterface,
  table: string,
  column: string,
  definition: Parameters<QueryInterface['addColumn']>[2]
): Promise<void> => {
  const description = await queryInterface.describeTable(table) as TableDescription
  if (!description[column]) {
    await queryInterface.addColumn(table, column, definition)
    console.log(`已添加 ${table}.${column}`)
  }
}

/** 创建 Phase 1-3 人机协作所需字段及提案日志表。 */
export const migrateHumanCollaboration = async (): Promise<void> => {
  await sequelize.authenticate()
  const queryInterface = sequelize.getQueryInterface()
  const originalNovelColumns = await queryInterface.describeTable('novels') as TableDescription
  const originalSettingColumns = await queryInterface.describeTable('novel_settings') as TableDescription
  const originalCharacterColumns = await queryInterface.describeTable('character_cards') as TableDescription
  const needsStageBackfill = !originalNovelColumns.creationStage

  await addColumnIfMissing(queryInterface, 'novels', 'creationStage', {
    type: DataTypes.ENUM('inspiration', 'worldview', 'characters', 'outline', 'writing'),
    allowNull: false,
    defaultValue: 'inspiration'
  })
  await addColumnIfMissing(queryInterface, 'novels', 'stageProgress', { type: DataTypes.JSON, allowNull: true })
  await addColumnIfMissing(queryInterface, 'novels', 'completeness', { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 })

  await addColumnIfMissing(queryInterface, 'novel_settings', 'reviewStatus', {
    type: DataTypes.ENUM('empty', 'ai_proposed', 'confirmed'),
    allowNull: false,
    defaultValue: 'empty'
  })
  await addColumnIfMissing(queryInterface, 'novel_settings', 'overallOutline', { type: DataTypes.TEXT, allowNull: true })
  await addColumnIfMissing(queryInterface, 'novel_settings', 'confirmedAt', { type: DataTypes.DATE, allowNull: true })
  await addColumnIfMissing(queryInterface, 'novel_settings', 'stale', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })

  await addColumnIfMissing(queryInterface, 'character_cards', 'reviewStatus', {
    type: DataTypes.ENUM('empty', 'ai_proposed', 'confirmed'),
    allowNull: false,
    defaultValue: 'empty'
  })
  await addColumnIfMissing(queryInterface, 'character_cards', 'confirmedAt', { type: DataTypes.DATE, allowNull: true })
  await addColumnIfMissing(queryInterface, 'character_cards', 'aiProposalHistory', { type: DataTypes.JSON, allowNull: true })
  await addColumnIfMissing(queryInterface, 'character_cards', 'stale', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })

  await addColumnIfMissing(queryInterface, 'chapters', 'stale', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
  await addColumnIfMissing(queryInterface, 'chapters', 'stalePlot', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
  await addColumnIfMissing(queryInterface, 'chapters', 'outline', { type: DataTypes.TEXT, allowNull: true })

  // 迁移前已由用户保存的内容视为已确认，避免升级后旧写作上下文突然消失。
  if (!originalSettingColumns.reviewStatus) {
    await sequelize.query(`UPDATE novel_settings SET reviewStatus = 'confirmed', confirmedAt = COALESCE(confirmedAt, updatedAt)
      WHERE reviewStatus = 'empty' AND (
        TRIM(COALESCE(worldview, '')) <> '' OR TRIM(COALESCE(genreStyle, '')) <> ''
        OR TRIM(COALESCE(overallOutline, '')) <> '' OR TRIM(COALESCE(notes, '')) <> ''
      )`)
  }
  if (!originalCharacterColumns.reviewStatus) {
    await sequelize.query(`UPDATE character_cards SET reviewStatus = 'confirmed', confirmedAt = COALESCE(confirmedAt, updatedAt)
      WHERE reviewStatus = 'empty'`)
  }

  const tableNames = (await queryInterface.showAllTables()).map((table) => String(table).toLowerCase())
  if (!tableNames.includes('ai_proposal_logs')) {
    await queryInterface.createTable('ai_proposal_logs', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      novelId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'novels', key: 'id' }, onDelete: 'CASCADE' },
      userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      agent: { type: DataTypes.ENUM('inspiration', 'writer', 'reviewer'), allowNull: false },
      proposalType: { type: DataTypes.STRING, allowNull: false },
      inputContext: { type: DataTypes.JSON, allowNull: false },
      output: { type: DataTypes.JSON, allowNull: false },
      userAction: { type: DataTypes.ENUM('pending', 'adopted', 'rejected', 'edited'), allowNull: false, defaultValue: 'pending' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    })
    await queryInterface.addIndex('ai_proposal_logs', ['novelId', 'createdAt'])
    await queryInterface.addIndex('ai_proposal_logs', ['userId', 'agent', 'proposalType'])
  }

  if (needsStageBackfill) {
    // 老小说只在首次迁移时回填，重复执行不能覆盖用户主动选择的阶段。
    const novels = await sequelize.query<{ id: number }>('SELECT id FROM novels', { type: QueryTypes.SELECT })
    for (const novel of novels) {
      const [hasContent, hasOutline, hasCharacters, hasWorldview] = await Promise.all([
        sequelize.query('SELECT 1 FROM chapters WHERE novelId = :id AND isDeleted = 0 AND TRIM(content) <> \'\' LIMIT 1', { replacements: { id: novel.id }, type: QueryTypes.SELECT }),
        sequelize.query('SELECT 1 FROM novel_settings WHERE novelId = :id AND TRIM(COALESCE(overallOutline, \'\')) <> \'\' LIMIT 1', { replacements: { id: novel.id }, type: QueryTypes.SELECT }),
        sequelize.query('SELECT 1 FROM character_cards WHERE novelId = :id LIMIT 1', { replacements: { id: novel.id }, type: QueryTypes.SELECT }),
        sequelize.query('SELECT 1 FROM novel_settings WHERE novelId = :id AND TRIM(COALESCE(worldview, \'\')) <> \'\' LIMIT 1', { replacements: { id: novel.id }, type: QueryTypes.SELECT })
      ])
      const stage = hasContent.length ? 'writing' : hasOutline.length ? 'outline' : hasCharacters.length ? 'characters' : hasWorldview.length ? 'worldview' : 'inspiration'
      await sequelize.query('UPDATE novels SET creationStage = :stage WHERE id = :id', { replacements: { stage, id: novel.id } })
    }
  }
}

if (require.main === module) {
  migrateHumanCollaboration()
    .then(() => {
      console.log('人机协作 Phase 1-3 迁移完成')
      return sequelize.close()
    })
    .catch((error: unknown) => {
      console.error('人机协作迁移失败:', error)
      process.exitCode = 1
    })
}
