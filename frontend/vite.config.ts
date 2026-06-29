import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const appBaseUrl = env.VITE_APP_BASE_URL || '/'
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3001'

  return {
    base: appBaseUrl,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@styles': path.resolve(__dirname, './src/styles'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@types': path.resolve(__dirname, './src/types'),
        '@services': path.resolve(__dirname, './src/services'),
        '@contexts': path.resolve(__dirname, './src/contexts'),
        path: 'path-browserify',
      },
    },
    server: {
      port: 3002,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
          timeout: 0,
          proxyTimeout: 0,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes, req) => {
              if (req.url?.includes('/ai/')) {
                proxyRes.headers['cache-control'] = 'no-cache, no-transform'
                proxyRes.headers['x-accel-buffering'] = 'no'
              }
            })
          }
        }
      }
    },
    define: {
      global: 'window'
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/antd')
              || id.includes('node_modules/@ant-design/icons')
              || id.includes('node_modules/rc-')
            ) {
              return 'antd'
            }
            if (id.includes('node_modules/draft-js')) {
              return 'draft-js'
            }
            if (id.includes('node_modules/live2d')) {
              return 'live2d'
            }
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
              return 'react-vendor'
            }
          }
        }
      }
    }
  }
})