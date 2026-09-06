module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    // Vite 页面常同时导出 React 组件和辅助类型，现阶段不强制刷新边界规则。
    'react-refresh/only-export-components': 'off',
    // 现存 Hooks 依赖告警由 lint 脚本的 7 条上限锁定，新增告警会使 CI 失败。
    '@typescript-eslint/no-explicit-any': 'off'
  }
}
