module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
    '^.+\\.js$': 'babel-jest'
  },
  testMatch: [
    '**/tests/unit/**/*.test.{js,ts}',
    '**/tests/integration/**/*.test.{js,ts}',
    '**/tests/**/*.test.{js,ts}'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'src/routes/**/*.ts',
    'src/services/**/*.ts',
    'src/models/**/*.ts'
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