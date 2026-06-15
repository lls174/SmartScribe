import bcrypt from 'bcryptjs'
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  CreationOptional
} from 'sequelize'
import type { AiPlatform, AiRequestStatus, NovelSnapshot } from '../../../shared/types'
import sequelize from '../config/db'

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>
  declare username: string
  declare password: string
  declare email: string | null
  declare role: CreationOptional<'user' | 'admin'>
  declare status: CreationOptional<'active' | 'banned'>
  declare bannedAt: Date | null
  declare banReason: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  async setPassword(value: string): Promise<void> {
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(value, salt)
    this.setDataValue('password', hash)
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password)
  }
}

User.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true, unique: true, validate: { isEmail: true } },
  role: { type: DataTypes.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' },
  status: { type: DataTypes.ENUM('active', 'banned'), allowNull: false, defaultValue: 'active' },
  bannedAt: { type: DataTypes.DATE, allowNull: true },
  banReason: { type: DataTypes.STRING, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'User', tableName: 'users' })

export class AiCredential extends Model<InferAttributes<AiCredential>, InferCreationAttributes<AiCredential>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare platform: CreationOptional<AiPlatform>
  declare encryptedApiKey: string
  declare model: CreationOptional<string>
  declare customBaseURL: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

AiCredential.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  platform: { type: DataTypes.ENUM('aliyun', 'zhipu', 'deepseek', 'openai', 'custom'), allowNull: false, defaultValue: 'zhipu' },
  encryptedApiKey: { type: DataTypes.TEXT, allowNull: false },
  model: { type: DataTypes.STRING, allowNull: false, defaultValue: 'glm-5-turbo' },
  customBaseURL: { type: DataTypes.STRING, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName: 'AiCredential',
  tableName: 'ai_credentials',
  indexes: [{ unique: true, fields: ['userId', 'platform'] }]
})

export class Novel extends Model<InferAttributes<Novel>, InferCreationAttributes<Novel>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare name: string
  declare description: string | null
  declare isDeleted: CreationOptional<boolean>
  declare deletedAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

Novel.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'Novel', tableName: 'novels' })

export class Chapter extends Model<InferAttributes<Chapter>, InferCreationAttributes<Chapter>> {
  declare id: CreationOptional<number>
  declare novelId: number
  declare title: string | null
  declare content: string
  declare plot: string | null
  declare order: CreationOptional<number>
  declare isDeleted: CreationOptional<boolean>
  declare deletedAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

Chapter.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  novelId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'novels', key: 'id' } },
  title: { type: DataTypes.STRING, allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  plot: { type: DataTypes.TEXT, allowNull: true },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'Chapter', tableName: 'chapters' })

export class Feedback extends Model<InferAttributes<Feedback>, InferCreationAttributes<Feedback>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare type: string
  declare content: string
  declare createdAt: CreationOptional<Date>
}

Feedback.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  type: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'Feedback', tableName: 'feedback', updatedAt: false })

export class Creative extends Model<InferAttributes<Creative>, InferCreationAttributes<Creative>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare title: string
  declare type: string
  declare genre: string | null
  declare content: string
  declare isDeleted: CreationOptional<boolean>
  declare deletedAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

Creative.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  title: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  genre: { type: DataTypes.STRING, allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'Creative', tableName: 'creatives' })

export class NovelVersion extends Model<InferAttributes<NovelVersion>, InferCreationAttributes<NovelVersion>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare novelId: number
  declare label: string | null
  declare snapshot: NovelSnapshot
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

NovelVersion.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  novelId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'novels', key: 'id' } },
  label: { type: DataTypes.STRING, allowNull: true },
  snapshot: { type: DataTypes.JSON, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'NovelVersion', tableName: 'novel_versions' })

export class GenerationHistory extends Model<InferAttributes<GenerationHistory>, InferCreationAttributes<GenerationHistory>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare novelId: number | null
  declare chapterId: number | null
  declare action: string
  declare prompt: string | null
  declare params: Record<string, unknown> | null
  declare result: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

GenerationHistory.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  novelId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'novels', key: 'id' } },
  chapterId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'chapters', key: 'id' } },
  action: { type: DataTypes.STRING, allowNull: false },
  prompt: { type: DataTypes.TEXT, allowNull: true },
  params: { type: DataTypes.JSON, allowNull: true },
  result: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'GenerationHistory', tableName: 'generation_histories' })

export class AiRequestLog extends Model<InferAttributes<AiRequestLog>, InferCreationAttributes<AiRequestLog>> {
  declare id: CreationOptional<number>
  declare userId: number
  declare novelId: number | null
  declare chapterId: number | null
  declare action: string
  declare platform: string
  declare model: string
  declare status: CreationOptional<AiRequestStatus>
  declare promptTokens: CreationOptional<number>
  declare completionTokens: CreationOptional<number>
  declare totalTokens: CreationOptional<number>
  declare isEstimated: CreationOptional<boolean>
  declare durationMs: number | null
  declare promptLength: CreationOptional<number>
  declare resultLength: CreationOptional<number>
  declare errorMessage: string | null
  declare metadata: Record<string, unknown> | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

AiRequestLog.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  novelId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'novels', key: 'id' } },
  chapterId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'chapters', key: 'id' } },
  action: { type: DataTypes.STRING, allowNull: false },
  platform: { type: DataTypes.STRING, allowNull: false },
  model: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('success', 'failed'), allowNull: false, defaultValue: 'success' },
  promptTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  completionTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isEstimated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  durationMs: { type: DataTypes.INTEGER, allowNull: true },
  promptLength: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resultLength: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'AiRequestLog', tableName: 'ai_request_logs' })

export class CharacterCard extends Model<InferAttributes<CharacterCard>, InferCreationAttributes<CharacterCard>> {
  declare id: CreationOptional<number>
  declare novelId: number
  declare name: string
  declare role: string | null
  declare identity: string | null
  declare personality: string | null
  declare appearance: string | null
  declare relationship: string | null
  declare secret: string | null
  declare arc: string | null
  declare notes: string | null
  declare priority: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

CharacterCard.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  novelId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'novels', key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: true },
  identity: { type: DataTypes.STRING, allowNull: true },
  personality: { type: DataTypes.TEXT, allowNull: true },
  appearance: { type: DataTypes.TEXT, allowNull: true },
  relationship: { type: DataTypes.TEXT, allowNull: true },
  secret: { type: DataTypes.TEXT, allowNull: true },
  arc: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'CharacterCard', tableName: 'character_cards' })

export class NovelSetting extends Model<InferAttributes<NovelSetting>, InferCreationAttributes<NovelSetting>> {
  declare id: CreationOptional<number>
  declare novelId: number
  declare worldview: string | null
  declare genreStyle: string | null
  declare powerSystem: string | null
  declare timeline: string | null
  declare plotRules: string | null
  declare taboos: string | null
  declare styleGuide: string | null
  declare notes: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

NovelSetting.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  novelId: { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'novels', key: 'id' } },
  worldview: { type: DataTypes.TEXT, allowNull: true },
  genreStyle: { type: DataTypes.TEXT, allowNull: true },
  powerSystem: { type: DataTypes.TEXT, allowNull: true },
  timeline: { type: DataTypes.TEXT, allowNull: true },
  plotRules: { type: DataTypes.TEXT, allowNull: true },
  taboos: { type: DataTypes.TEXT, allowNull: true },
  styleGuide: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'NovelSetting', tableName: 'novel_settings' })

User.hasMany(Novel, { foreignKey: 'userId' })
Novel.belongsTo(User, { foreignKey: 'userId' })

User.hasOne(AiCredential, { foreignKey: 'userId' })
AiCredential.belongsTo(User, { foreignKey: 'userId' })

Novel.hasMany(Chapter, { foreignKey: 'novelId' })
Chapter.belongsTo(Novel, { foreignKey: 'novelId' })

User.hasMany(Feedback, { foreignKey: 'userId' })
Feedback.belongsTo(User, { foreignKey: 'userId' })

User.hasMany(Creative, { foreignKey: 'userId' })
Creative.belongsTo(User, { foreignKey: 'userId' })

User.hasMany(NovelVersion, { foreignKey: 'userId' })
NovelVersion.belongsTo(User, { foreignKey: 'userId' })
Novel.hasMany(NovelVersion, { foreignKey: 'novelId' })
NovelVersion.belongsTo(Novel, { foreignKey: 'novelId' })

User.hasMany(GenerationHistory, { foreignKey: 'userId' })
GenerationHistory.belongsTo(User, { foreignKey: 'userId' })
Novel.hasMany(GenerationHistory, { foreignKey: 'novelId' })
GenerationHistory.belongsTo(Novel, { foreignKey: 'novelId' })
Chapter.hasMany(GenerationHistory, { foreignKey: 'chapterId' })
GenerationHistory.belongsTo(Chapter, { foreignKey: 'chapterId' })

User.hasMany(AiRequestLog, { foreignKey: 'userId' })
AiRequestLog.belongsTo(User, { foreignKey: 'userId' })
Novel.hasMany(AiRequestLog, { foreignKey: 'novelId' })
AiRequestLog.belongsTo(Novel, { foreignKey: 'novelId' })
Chapter.hasMany(AiRequestLog, { foreignKey: 'chapterId' })
AiRequestLog.belongsTo(Chapter, { foreignKey: 'chapterId' })

Novel.hasMany(CharacterCard, { foreignKey: 'novelId' })
CharacterCard.belongsTo(Novel, { foreignKey: 'novelId' })
Novel.hasOne(NovelSetting, { foreignKey: 'novelId' })
NovelSetting.belongsTo(Novel, { foreignKey: 'novelId' })

const syncDatabase = async (): Promise<void> => {
  try {
    console.log('数据库同步已禁用')
  } catch (error) {
    console.error('数据库同步失败:', error)
  }
}

void syncDatabase()
