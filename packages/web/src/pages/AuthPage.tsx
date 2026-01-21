import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ChevronRight, AlertCircle } from 'lucide-react';
import { authAPI } from '../api';
import { User, UserExtended } from '../types';

type AuthPageProps = {
  onAuthSuccess?: (user: User | UserExtended) => void;
};

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootProgress, setBootProgress] = useState(0);

  // Boot Sequence Animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBootProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        // 注册模式
        if (!username) {
          setError('用户名不能为空');
          setIsLoading(false);
          return;
        }
        
        const response = await authAPI.register(username, email, password);
        
        if (response.data.success) {
          // 注册成功，保存 token 和用户信息
          localStorage.setItem('token', response.data.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
          onAuthSuccess?.(response.data.data.user);
          navigate('/');
        } else {
          setError(response.data.error || '注册失败');
        }
      } else {
        // 登录模式
        const response = await authAPI.login(email, password);
        
        if (response.data.success) {
          // 登录成功，保存 token 和用户信息
          localStorage.setItem('token', response.data.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
          onAuthSuccess?.(response.data.data.user);
          navigate('/');
        } else {
          setError(response.data.error || '登录失败');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError(mode === 'register' ? '注册失败，请稍后重试' : '登录失败，请检查邮箱和密码');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Boot Sequence Overlay */}
      {bootProgress < 100 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-80 space-y-4">
            <div className="flex items-center gap-3">
              <Cpu className="text-cyber-cyan animate-pulse" size={24} />
              <div className="flex-1">
                <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyber-cyan transition-all duration-100 ease-out"
                    style={{ width: `${bootProgress}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-cyber-cyan font-mono text-xs">{bootProgress}%</span>
            </div>
              <div className="space-y-1 font-mono text-[10px] text-gray-600">
                <p>{'> '}INITIALIZING NEURAL LINK...</p>
                <p>{'> '}LOADING SECURITY PROTOCOLS...</p>
                <p>{'> '}ESTABLISHING SECURE CONNECTION...</p>
              </div>
          </div>
        </div>
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-cyber-cyan/5 via-transparent to-cyber-pink/5 pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-cyan/10 rounded-full blur-[150px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-pink/10 rounded-full blur-[150px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

      {/* Decorative Lines */}
      <div className="absolute top-20 left-20 w-40 h-[1px] bg-cyber-cyan/20"></div>
      <div className="absolute top-20 left-20 w-[1px] h-40 bg-cyber-cyan/20"></div>
      <div className="absolute bottom-20 right-20 w-40 h-[1px] bg-cyber-pink/20"></div>
      <div className="absolute bottom-20 right-20 w-[1px] h-40 bg-cyber-pink/20"></div>

      {/* Main Card */}
      <div className="relative w-full max-w-md p-8 border border-gray-800 bg-black/40 backdrop-blur-xl rounded-lg shadow-2xl z-10">
        {/* Corner Accents */}
        <div className="absolute -top-[1px] -left-[1px] w-8 h-8 border-t-2 border-l-2 border-cyber-cyan"></div>
        <div className="absolute -top-[1px] -right-[1px] w-8 h-8 border-t-2 border-r-2 border-cyber-cyan"></div>
        <div className="absolute -bottom-[1px] -left-[1px] w-8 h-8 border-b-2 border-l-2 border-cyber-pink"></div>
        <div className="absolute -bottom-[1px] -right-[1px] w-8 h-8 border-b-2 border-r-2 border-cyber-pink"></div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-cyber-cyan bg-black mb-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-cyber-cyan/10 animate-pulse-slow"></div>
            <Cpu className="text-cyber-cyan relative z-10" size={32} />
            <div className="absolute inset-0 border border-cyber-cyan rounded-full animate-ping opacity-20"></div>
          </div>
          <h1 className="text-4xl font-display font-bold text-white tracking-widest mb-2">WEBNOTE</h1>
          <p className="text-cyber-cyan font-mono text-xs tracking-[0.3em]">
            {mode === 'login' ? 'SYSTEM_LOGIN' : 'SYSTEM_REGISTER'}
          </p>
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-cyber-cyan text-xs font-mono mb-2 uppercase tracking-wider">
                  {'> '}USERNAME
                </label>
                <div className="relative group">
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-cyber-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded blur-sm"></div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ENTER_USERNAME"
                    className="relative w-full bg-black border border-gray-800 focus:border-cyber-cyan text-gray-100 px-4 py-3 font-mono text-sm outline-none rounded transition-all"
                    required={mode === 'register'}
                  />
                </div>
              </div>
            )}

            <div>
                <label className="block text-cyber-cyan text-xs font-mono mb-2 uppercase tracking-wider">
                  {'> '}EMAIL_ADDRESS
                </label>
              <div className="relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-cyber-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded blur-sm"></div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ENTER_EMAIL"
                  className="relative w-full bg-black border border-gray-800 focus:border-cyber-cyan text-gray-100 px-4 py-3 font-mono text-sm outline-none rounded transition-all"
                  required
                />
              </div>
            </div>

            <div>
                <label className="block text-cyber-cyan text-xs font-mono mb-2 uppercase tracking-wider">
                  {'> '}ACCESS_KEY
                </label>
              <div className="relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-cyber-pink/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded blur-sm"></div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="ENTER_PASSWORD"
                  className="relative w-full bg-black border border-gray-800 focus:border-cyber-pink text-gray-100 px-4 py-3 font-mono text-sm outline-none rounded transition-all"
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 border border-red-500/50 bg-red-500/10 rounded text-red-400 text-xs font-mono">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Toggle */}
          <div className="flex items-center justify-between text-xs font-mono text-gray-500">
            <label className="flex items-center gap-2 cursor-pointer hover:text-cyber-cyan transition-colors">
              <input type="checkbox" className="accent-cyber-cyan w-4 h-4" />
              <span>KEEP_SESSION_ACTIVE</span>
            </label>
            <button type="button" className="hover:text-cyber-pink transition-colors">
              FORGOT_CREDENTIALS?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`relative w-full py-4 rounded font-mono font-bold text-sm uppercase tracking-wider transition-all ${
              isLoading
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-cyber-cyan text-black hover:bg-white shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                CONNECTING...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {mode === 'login' ? 'INITIALIZE_SESSION' : 'CREATE_ACCOUNT'}
                <ChevronRight size={16} />
              </span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-xs font-mono mb-3">
            {mode === 'login' ? 'NEW OPERATOR?' : 'EXISTING OPERATOR?'}
          </p>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-cyber-pink text-xs font-mono hover:text-white transition-colors hover:underline"
          >
            {mode === 'login' ? '>> REGISTER_NEW_ID' : '>> RETURN_TO_LOGIN'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-800/50">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-600">
            <span>STATUS: <span className="text-green-500">ONLINE</span></span>
            <span>ENCRYPTION: <span className="text-cyber-cyan">AES-256-GCM</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
