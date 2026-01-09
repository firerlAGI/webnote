import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { User } from '@webnote/shared/types'
import api from '@webnote/shared/api'
import { handleApiError, logError } from '../utils/errorHandler';

/**
 * AuthContextType 定义了认证上下文的类型接口
 * @property {User | null} user - 当前登录用户信息
 * @property {string | null} token - 认证令牌
 * @property {boolean} isAuthenticated - 是否已认证
 * @property {boolean} isLoading - 是否正在加载
 * @property {string | null} error - 错误信息
 * @property {Function} login - 登录函数
 * @property {Function} register - 注册函数
 * @property {Function} logout - 登出函数
 * @property {Function} clearError - 清除错误函数
 */
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider 组件提供认证状态和方法
 * @param {Object} props - 组件属性
 * @param {ReactNode} props.children - 子组件
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 从存储中加载令牌和用户信息
  useEffect(() => {
    const loadAuth = async () => {
      try {
        if (typeof sessionStorage !== 'undefined') {
          const storedToken = sessionStorage.getItem('token');
          const storedUser = sessionStorage.getItem('user');
          const tokenExpiry = sessionStorage.getItem('tokenExpiry');

          // 检查令牌是否过期
          if (storedToken && storedUser && tokenExpiry) {
            const now = new Date().getTime();
            if (now < parseInt(tokenExpiry)) {
              setToken(storedToken);
              setUser(JSON.parse(storedUser));
              setIsAuthenticated(true);
            } else {
              // 令牌过期，清除存储
              sessionStorage.removeItem('token');
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('tokenExpiry');
            }
          }
        }
      } catch (err) {
        console.error('Error loading auth data:', err);
        // 加载出错时清除状态
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  /**
   * 登录函数
   * @param {string} email - 用户邮箱
   * @param {string} password - 用户密码
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ user: User; token: string }>(
        '/auth/login',
        { email, password }
      );

      if (response.success) {
        setUser(response.data.user);
        setToken(response.data.token);
        setIsAuthenticated(true);

        if (typeof sessionStorage !== 'undefined') {
          // 设置令牌过期时间为24小时后
          const expiry = new Date().getTime() + 24 * 60 * 60 * 1000;
          sessionStorage.setItem('token', response.data.token);
          sessionStorage.setItem('user', JSON.stringify(response.data.user));
          sessionStorage.setItem('tokenExpiry', expiry.toString());
        }
      } else {
        // 处理API返回的错误
        setError(response.message || 'Login failed: Invalid response');
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      // 处理网络错误或其他异常
      const standardError = handleApiError(err)
      logError(standardError, 'Login')
      setError(standardError.message)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 注册函数
   * @param {string} username - 用户名
   * @param {string} email - 用户邮箱
   * @param {string} password - 用户密码
   */
  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.post<{ user: User; token: string }>(
          '/auth/register',
          { username, email, password }
        );

        if (response.success) {
          setUser(response.data.user);
          setToken(response.data.token);
          setIsAuthenticated(true);

          if (typeof sessionStorage !== 'undefined') {
            // 设置令牌过期时间为24小时后
            const expiry = new Date().getTime() + 24 * 60 * 60 * 1000;
            sessionStorage.setItem('token', response.data.token);
            sessionStorage.setItem('user', JSON.stringify(response.data.user));
            sessionStorage.setItem('tokenExpiry', expiry.toString());
          }
        } else {
          // 处理API返回的错误
          setError(response.message || 'Registration failed: Invalid response');
          setIsAuthenticated(false);
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        const standardError = handleApiError(err);
        logError(standardError, 'Register');
        setError(standardError.message);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
  }, []);

  /**
   * 登出函数
   */
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('tokenExpiry');
    }
  }, []);

  /**
   * 清除错误函数
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth 钩子用于在组件中访问认证上下文
 * @returns {AuthContextType} 认证上下文
 * @throws {Error} 如果在AuthProvider之外使用
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
