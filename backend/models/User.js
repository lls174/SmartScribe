const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')
const bcrypt = require('bcryptjs')

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user'
  },
  status: {
    type: DataTypes.ENUM('active', 'banned'),
    allowNull: false,
    defaultValue: 'active'
  },
  bannedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  banReason: {
    type: DataTypes.STRING,
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
  tableName: 'users'
})

// 设置密码（异步）
User.prototype.setPassword = async function(value) {
  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(value, salt)
  this.setDataValue('password', hash)
}

// 验证密码（异步）
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password)
}

module.exports = User