import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

export interface DatabaseStatus {
  connected: boolean
  lastCheckedAt: string | null
  lastError: string | null
}

interface ConnectDatabaseOptions {
  logSuccess?: boolean
  logFailure?: boolean
}

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_scribe',
  logging: process.env.NODE_ENV === 'production' ? false : console.log
})

const databaseState: DatabaseStatus = {
  connected: false,
  lastCheckedAt: null,
  lastError: null
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const setDatabaseState = (connected: boolean, error: unknown = null): void => {
  databaseState.connected = connected
  databaseState.lastCheckedAt = new Date().toISOString()
  databaseState.lastError = error ? getErrorMessage(error) : null
}

export const connectDatabase = async ({
  logSuccess = true,
  logFailure = true
}: ConnectDatabaseOptions = {}): Promise<boolean> => {
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

export const getDatabaseStatus = (): DatabaseStatus => ({ ...databaseState })

export default sequelize
