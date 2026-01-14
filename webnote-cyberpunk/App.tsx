import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NotesPage from './pages/NotesPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import { AppRoute } from './types';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Basic mock auth state handling
  const handleLogout = () => {
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
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<AuthPageWrapper />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </HashRouter>
  );
};

// Wrapper to handle navigation prop in AuthPage
const AuthPageWrapper = () => {
  const navigate = useNavigate();
  return <AuthPage onLogin={() => navigate('/')} />;
};

const ProtectedRoutes = () => {
  return (
    <AppLayout>
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