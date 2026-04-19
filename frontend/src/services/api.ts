import axios from 'axios'

const ensureLeadingSlash = (value: string) => value.startsWith('/') ? value : `/${value}`

const normalizeAppBaseUrl = (value: string | undefined) => {
  if (!value) {
    return '/'
  }

  const normalized = ensureLeadingSlash(value)
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const normalizeApiBaseUrl = (value: string | undefined) => {
  const normalized = ensureLeadingSlash(value || '/api')
  return normalized !== '/' && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

export const APP_BASE_URL = normalizeAppBaseUrl(import.meta.env.BASE_URL)
export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
export const buildApiUrl = (path: string) => `${API_BASE_URL}${ensureLeadingSlash(path)}`
export const buildAppUrl = (path: string) => {
  const base = APP_BASE_URL === '/' ? '' : APP_BASE_URL.slice(0, -1)
  return path === '/' ? (base || '/') : `${base}${ensureLeadingSlash(path)}`
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // 允许携带 cookie
})

// CSRF Token 缓存
let csrfToken: string | null = null

// 获取 CSRF Token
const getCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) {
    return csrfToken
  }
  
  try {
    const response = await api.get('/csrf-token')
    csrfToken = response.data.csrfToken
    return csrfToken
  } catch (error) {
    console.error('获取 CSRF Token 失败:', error)
    return null
  }
}

// 请求拦截器
api.interceptors.request.use(
  async (config) => {
    // 添加 JWT Token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 添加 CSRF Token (对于非 GET 请求)
    if (config.method && config.method.toLowerCase() !== 'get') {
      const token = await getCsrfToken()
      if (token) {
        config.headers['X-CSRF-Token'] = token
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    // 处理 CSRF Token 过期或无效的情况
    if (error.response?.status === 403 && error.response?.data?.message === 'CSRF 验证失败') {
      // 清除缓存的 CSRF Token
      csrfToken = null
      
      // 重新获取 CSRF Token 并重试请求
      const originalRequest = error.config
      if (!originalRequest._retry) {
        originalRequest._retry = true
        const newToken = await getCsrfToken()
        if (newToken) {
          originalRequest.headers['X-CSRF-Token'] = newToken
          return api(originalRequest)
        }
      }
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = buildAppUrl('/login')
    }
    return Promise.reject(error)
  }
)

export const creativeApi = {
  create: (data: {
    title: string
    type: string
    genre: string
    content: string
  }) => {
    return api.post('/creative/create', data)
  },
  getList: (page = 1, limit = 10) => {
    return api.get(`/creative/list?page=${page}&limit=${limit}`)
  },
  getById: (id: number) => {
    return api.get(`/creative/${id}`)
  },
  update: (id: number, data: {
    title?: string
    content?: string
    genre?: string
  }) => {
    return api.put(`/creative/${id}`, data)
  },
  delete: (id: number) => {
    return api.delete(`/creative/${id}`)
  }
}

export default api
