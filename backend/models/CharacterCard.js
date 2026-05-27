const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')

const CharacterCard = sequelize.define('CharacterCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  novelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'novels',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: true
  },
  identity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  personality: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  appearance: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  relationship: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  secret: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  arc: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
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
  tableName: 'character_cards'
})

module.exports = CharacterCard
