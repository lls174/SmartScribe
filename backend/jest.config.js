module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    '**/routes/**/*.js',
    '**/services/**/*.js',
    '**/models/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFiles: [
    './tests/setup.js'
  ]
}