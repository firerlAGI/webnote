import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NotesPage from './pages/NotesPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import { AppRoute, User } from './types';
import { userAPI } from './api';

const AppLayout: React.FC<{ 
  children: React.ReactNode; 
  user: User; 
  onLogout: () => void;
}> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cyber-black text-gray-200 font-sans selection:bg-cyber-pink selection:text-white bg-grid-pattern">
      <Sidebar 
        currentRoute={location.pathname as AppRoute}
        onNavigate={(route) => navigate(route)} 
        onLogout={handleLogout}
      />
      <main className="ml-20 lg:ml-64 p-6 lg:p-10 min-h-screen">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔴 临时禁用鉴权 - 使用Mock用户
    const mockUser: User = {
      id: 1,
      username: 'DemoUser',
      email: 'demo@webnote.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setUser(mockUser);
    setLoading(false);

    /* 正常鉴权逻辑（已注释）
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token) {
      userAPI.getMe()
        .then(response => {
          if (response.data.success) {
            setUser(response.data.data);
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        })
        .catch((error) => {
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else if (savedUser) {
      setUser(JSON.parse(savedUser));
      setLoading(false);
    } else {
      setLoading(false);
    }
    */
  }, []);

  const handleLogin = async (email: string, password: string) => {
    // 登录逻辑在AuthPage中处理
    // 这里只是回调，实际登录由AuthPage完成
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black bg-grid-pattern">
        <div className="text-cyber-cyan font-mono">系统初始化中...</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<AuthPageWrapper />} />
        <Route path="/*" element={<ProtectedRoutes user={user} onLogout={handleLogout} />} />
      </Routes>
    </HashRouter>
  );
};

// Wrapper to handle navigation prop in AuthPage
const AuthPageWrapper = () => {
  const navigate = useNavigate();
  
  const handleLoginSuccess = () => {
    // 从localStorage获取用户信息并刷新
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      navigate('/');
    }
  };
  
  return <AuthPage onLogin={handleLoginSuccess} />;
};

const ProtectedRoutes: React.FC<{ user: User | null; onLogout: () => void }> = ({ user, onLogout }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <AppLayout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
