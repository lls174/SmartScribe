const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')

const NovelSetting = sequelize.define('NovelSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  novelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'novels',
      key: 'id'
    }
  },
  worldview: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  genreStyle: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  powerSystem: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timeline: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  plotRules: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  taboos: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  styleGuide: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  overallOutline: {
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
  tableName: 'novel_settings'
})

module.exports = NovelSetting
