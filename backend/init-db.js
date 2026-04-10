const mysql = require('mysql2')
require('dotenv').config()

// 创建数据库连接
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
})

// 连接数据库
connection.connect((err) => {
  if (err) {
    console.error('连接数据库失败:', err)
    return
  }
  console.log('连接数据库成功')

  // 创建数据库
  connection.query('CREATE DATABASE IF NOT EXISTS smart_scribe', (err, results) => {
    if (err) {
      console.error('创建数据库失败:', err)
    } else {
      console.log('数据库创建成功')
    }
    connection.end()
  })
})
