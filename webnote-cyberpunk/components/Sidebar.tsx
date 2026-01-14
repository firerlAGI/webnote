import React from 'react';
import { NavLink } from 'react-router-dom'; // Note: using NavLink conceptually, but will use simple props in App.tsx due to constraint
import { AppRoute } from '../types';
import { LayoutDashboard, FileText, CalendarCheck, Settings, LogOut, Hexagon } from 'lucide-react';

interface SidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate, onLogout }) => {
  const navItems = [
    { label: '主控台_Dashboard', icon: LayoutDashboard, route: AppRoute.DASHBOARD },
    { label: '神经记忆_Notes', icon: FileText, route: AppRoute.NOTES },
    { label: '每日复盘_Review', icon: CalendarCheck, route: AppRoute.REVIEW },
    { label: '系统配置_Config', icon: Settings, route: AppRoute.SETTINGS },
  ];

  return (
    <div className="w-20 lg:w-64 h-screen bg-cyber-black border-r border-gray-800 flex flex-col fixed left-0 top-0 z-40 transition-all duration-300">
      {/* Brand */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-800">
        <Hexagon className="text-cyber-cyan animate-spin-slow" size={28} />
        <span className="hidden lg:block ml-3 font-display font-bold text-xl tracking-wider text-white">WN<span className="text-cyber-cyan">_77</span></span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-8 flex flex-col gap-2 px-2 lg:px-4">
        {navItems.map((item) => {
          const isActive = currentRoute === item.route;
          return (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={`
                group flex items-center justify-center lg:justify-start px-2 lg:px-4 py-3 rounded-sm transition-all duration-200 relative overflow-hidden
                ${isActive ? 'bg-cyber-cyan/10 text-cyber-cyan border-r-2 border-cyber-cyan' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}
              `}
            >
              <item.icon size={20} className={`${isActive ? 'text-cyber-cyan' : 'group-hover:text-white'}`} />
              <span className="hidden lg:block ml-3 font-mono text-sm tracking-wide uppercase">{item.label}</span>
              {isActive && <div className="absolute inset-0 bg-cyber-cyan/5 blur-sm"></div>}
            </button>
          );
        })}
      </nav>

      {/* User / Logout */}
      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={onLogout}
          className="flex items-center justify-center lg:justify-start w-full text-gray-500 hover:text-cyber-pink transition-colors p-2"
        >
          <LogOut size={20} />
          <span className="hidden lg:block ml-3 font-mono text-xs uppercase">断开连接</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;