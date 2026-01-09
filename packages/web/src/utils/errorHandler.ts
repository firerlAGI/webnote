/**
 * 错误处理工具函数
 */

/**
 * 错误类型
 */
export type ErrorType = 'network' | 'validation' | 'auth' | 'server' | 'unknown';

/**
 * 标准化错误对象接口
 */
export interface StandardError {
  type: ErrorType;
  message: string;
  details?: string | string[];
  originalError?: any;
  timestamp: number;
}

/**
 * 处理 API 错误
 * @param error - 原始错误对象
 * @returns 标准化的错误对象
 */
export const handleApiError = (error: any): StandardError => {
  // 检查是否是 API 响应错误
  if (error.response) {
    // 服务器返回错误状态码
    const status = error.response.status;
    const data = error.response.data;
    
    let errorType: ErrorType = 'server';
    let errorMessage = '服务器错误';
    let errorDetails: string | string[] = [];

    // 根据状态码确定错误类型
    if (status >= 400 && status < 500) {
      if (status === 401) {
        errorType = 'auth';
        errorMessage = '未授权，请重新登录';
      } else if (status === 403) {
        errorType = 'auth';
        errorMessage = '权限不足，无法访问该资源';
      } else if (status === 404) {
        errorType = 'server';
        errorMessage = '请求的资源不存在';
      } else if (status === 422) {
        errorType = 'validation';
        errorMessage = '数据验证失败';
      } else {
        errorType = 'server';
        errorMessage = '请求失败';
      }
    } else if (status >= 500) {
      errorType = 'server';
      errorMessage = '服务器内部错误';
    }

    // 从响应数据中提取错误信息
    if (data.error) {
      if (typeof data.error === 'string') {
        errorMessage = data.error;
      } else if (data.error.message) {
        errorMessage = data.error.message;
        if (data.error.details) {
          errorDetails = data.error.details;
        }
      }
    } else if (data.message) {
      errorMessage = data.message;
    }

    return {
      type: errorType,
      message: errorMessage,
      details: errorDetails,
      originalError: error,
      timestamp: Date.now()
    };
  } else if (error.request) {
    // 请求已发送但没有收到响应
    return {
      type: 'network',
      message: '网络错误，无法连接到服务器',
      details: '请检查您的网络连接并重试',
      originalError: error,
      timestamp: Date.now()
    };
  } else {
    // 请求配置出错
    return {
      type: 'unknown',
      message: error.message || '未知错误',
      originalError: error,
      timestamp: Date.now()
    };
  }
};

/**
 * 处理表单验证错误
 * @param errors - 验证错误对象
 * @returns 标准化的错误对象
 */
export const handleValidationError = (errors: Record<string, string>): StandardError => {
  const errorDetails = Object.entries(errors).map(([field, message]) => `${field}: ${message}`);
  
  return {
    type: 'validation',
    message: '表单验证失败',
    details: errorDetails,
    timestamp: Date.now()
  };
};

/**
 * 格式化错误信息为用户友好的形式
 * @param error - 标准化错误对象
 * @returns 格式化后的错误信息
 */
export const formatErrorForUser = (error: StandardError): string => {
  return error.message;
};

/**
 * 记录错误到控制台
 * @param error - 标准化错误对象
 * @param context - 错误发生的上下文
 */
export const logError = (error: StandardError, context?: string) => {
  console.error(`[${context || 'Error'}] ${error.type}: ${error.message}`, {
    details: error.details,
    timestamp: new Date(error.timestamp).toISOString(),
    originalError: error.originalError
  });
};

/**
 * 创建自定义错误
 * @param type - 错误类型
 * @param message - 错误信息
 * @param details - 错误详情
 * @returns 标准化错误对象
 */
export const createError = (type: ErrorType, message: string, details?: string | string[]): StandardError => {
  return {
    type,
    message,
    details,
    timestamp: Date.now()
  };
};