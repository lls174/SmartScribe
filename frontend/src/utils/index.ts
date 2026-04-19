// 格式化日期
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 防抖函数
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 节流函数
export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// 本地存储工具
export const storage = {
  get: (key: string): string | null => {
    return localStorage.getItem(key)
  },
  set: (key: string, value: string): void => {
    localStorage.setItem(key, value)
  },
  remove: (key: string): void => {
    localStorage.removeItem(key)
  },
  clear: (): void => {
    localStorage.clear()
  }
}

// 验证工具
export const validators = {
  // 验证用户名
  username: (username: string): boolean => {
    return username.length >= 3 && username.length <= 20
  },
  
  // 验证密码
  password: (password: string): boolean => {
    return password.length >= 6 && password.length <= 16
  },
  
  // 验证邮箱
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

// 文本处理工具
export const textUtils = {
  // 截断文本
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  },
  
  // 去除HTML标签
  stripHtml: (html: string): string => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  },
  
  // 计算字数
  countWords: (text: string): number => {
    return text.trim().split(/\s+/).length
  }
}
