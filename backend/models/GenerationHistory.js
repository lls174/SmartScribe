const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')

const GenerationHistory = sequelize.define('GenerationHistory', {
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
  prompt: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  params: {
    type: DataTypes.JSON,
    allowNull: true
  },
  result: {
    type: DataTypes.TEXT,
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
  tableName: 'generation_histories'
})

module.exports = GenerationHistory

