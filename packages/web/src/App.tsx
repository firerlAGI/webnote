import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NotesPage from './pages/NotesPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import GitHubBoardPage from './pages/GitHubBoardPage';
import ConnectionTestPage from './pages/ConnectionTestPage';
import { BootSequence } from './components/BootSequence';
import { AppRoute, User, UserExtended } from './types';
import { userAPI } from './api';
import { DataProvider } from './contexts/DataContext';

const AppLayout: React.FC<{ 
  children: React.ReactNode; 
  user: User | UserExtended; 
  onLogout: () => void;
}> = ({ children, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cyber-black text-gray-200 font-sans selection:bg-cyber-pink selection:text-white bg-grid-pattern overflow-hidden">
      <Sidebar 
        currentRoute={location.pathname as AppRoute} 
        onNavigate={(route) => navigate(route)} 
        onLogout={handleLogout}
      />
      <main className="ml-14 sm:ml-16 md:ml-20 lg:ml-64 p-3 sm:p-4 lg:p-8 h-screen overflow-y-auto scrollbar-hide overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<User | UserExtended | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'cyan';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage === 'zh-CN' || savedLanguage === 'en' || savedLanguage === 'ja') {
      document.documentElement.setAttribute('data-language', savedLanguage);
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  useEffect(() => {
    // 正常鉴权逻辑
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
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('user');
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <DataProvider>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      <div className={booted ? 'opacity-100 transition-opacity duration-1000' : 'opacity-0'}>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center bg-cyber-black bg-grid-pattern">
            <div className="text-cyber-cyan font-mono">系统初始化中...</div>
          </div>
        ) : (
          <HashRouter>
            <Routes>
              <Route path="/login" element={<AuthPage onAuthSuccess={(nextUser) => setUser(nextUser)} />} />
              <Route path="/*" element={<ProtectedRoutes user={user} onLogout={handleLogout} />} />
            </Routes>
          </HashRouter>
        )}
      </div>
    </DataProvider>
  );
};

const ProtectedRoutes: React.FC<{ user: User | UserExtended | null; onLogout: () => void }> = ({ user, onLogout }) => {
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
        <Route path="/github" element={<GitHubBoardPage />} />
        <Route path="/test-connection" element={<ConnectionTestPage />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
