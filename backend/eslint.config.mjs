import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// 仅检查当前 TypeScript 运行链路和测试；根目录同名 JS 是保留的旧实现。
export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'config/**',
      'constants/**',
      'middleware/**',
      'models/**',
      'routes/**',
      'services/**',
      'utils/**',
      'app.js',
      'init-db.js',
      'sync-db.js',
      'scripts/**/*.js'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // 下划线参数及仅参与类型推导的常量属于有意保留，不作为死代码处理。
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(AiContentResult|CHARACTER_FIELDS)$'
      }]
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
