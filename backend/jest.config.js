module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  transform: {
    // 测试可以保留 CommonJS 写法，但被测模块统一由 ts-jest 从 src/*.ts 编译。
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
    // Babel 负责提升 jest.mock，确保模型 mock 在导入 TypeScript 路由前生效。
    '^.+\\.js$': 'babel-jest'
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts}'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // 始终检查未关闭资源；当前套件开启后无泄漏，且可避免普通模式的延迟退出误报。
  detectOpenHandles: true,
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'src/routes/**/*.ts',
    'src/services/**/*.ts',
    'src/models/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      // 以当前 TS 真实覆盖率为基线，后续新增测试只允许提高，不再使用 legacy JS 的虚假 0% 结果。
      branches: 15,
      functions: 25,
      lines: 38,
      statements: 35
    }
  },
  setupFiles: ['./tests/setup.js']
}