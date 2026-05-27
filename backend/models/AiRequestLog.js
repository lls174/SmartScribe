const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')

const AiRequestLog = sequelize.define('AiRequestLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  novelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'novels',
      key: 'id'
    }
  },
  chapterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'chapters',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false
  },
  model: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: false,
    defaultValue: 'success'
  },
  promptTokens: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  completionTokens: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  totalTokens: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isEstimated: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  durationMs: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  promptLength: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  resultLength: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ai_request_logs'
})

module.exports = AiRequestLog
