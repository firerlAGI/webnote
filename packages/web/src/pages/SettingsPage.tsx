import React, { useState } from 'react';
import { CyberCard, CyberButton, CyberInput, CyberBadge } from '../components/CyberUI';
import { User, Monitor, Cloud, Bell, Shield, Trash2, Save, Smartphone, Wifi, Globe, Lock } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useState('cyan');
  const [syncEnabled, setSyncEnabled] = useState(true);

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-8 sm:pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
           <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">系统配置_Config</h1>
           <p className="text-cyber-cyan font-mono text-xs sm:text-sm">终端参数 // 偏好设置 // 安全协议</p>
        </div>
        <CyberButton glow onClick={() => alert("配置已覆写至神经芯片")}>
          <Save size={16} /> 保存配置
        </CyberButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Left Column: User & Security */}
        <div className="md:w-[280px] lg:w-auto space-y-4 md:space-y-6">
           <CyberCard title="用户识别码_Identity">
              <div className="flex flex-col items-center py-3 sm:py-4">
                 <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-cyber-cyan bg-cyber-cyan/10 flex items-center justify-center mb-3 sm:mb-4 relative group cursor-pointer overflow-hidden">
                    <User size={40} className="text-cyber-cyan" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="text-[10px] font-mono text-white">UPLOAD</span>
                    </div>
                 </div>
                 <h2 className="text-lg sm:text-xl font-display text-white">NetRunner_01</h2>
                 <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-3 sm:mb-4">ID: USR-9920-X</p>
                 <CyberBadge color="pink">管理员权限</CyberBadge>
              </div>
              <div className="space-y-4 mt-4">
                 <CyberInput label="显示名称" defaultValue="K" />
                 <CyberInput label="电子邮箱" defaultValue="k@nightcity.net" />
              </div>
           </CyberCard>

           <CyberCard title="安全协议_Security">
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
                    <div className="flex items-center gap-3">
                       <Lock size={18} className="text-cyber-yellow" />
                       <div>
                          <p className="text-sm font-bold text-gray-200">双重验证 (2FA)</p>
                          <p className="text-[10px] text-gray-500 font-mono">生物识别 / 硬件密钥</p>
                       </div>
                    </div>
                    <span className="text-cyber-cyan text-xs font-mono">已启用</span>
                 </div>
                 <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
                    <div className="flex items-center gap-3">
                       <Shield size={18} className="text-cyber-cyan" />
                       <div>
                          <p className="text-sm font-bold text-gray-200">数据加密</p>
                          <p className="text-[10px] text-gray-500 font-mono">AES-256-GCM</p>
                       </div>
                    </div>
                    <span className="text-green-500 text-xs font-mono">正常</span>
                 </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-800">
                 <CyberButton variant="danger" className="w-full text-xs">
                    <Trash2 size={14} /> 清除本地缓存
                 </CyberButton>
              </div>
           </CyberCard>
        </div>

        {/* Right Column: Interface & System */}
        <div className="lg:col-span-2 space-y-6">
           {/* Visual Settings */}
           <CyberCard title="神经界面_Interface">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-cyber-cyan text-xs font-mono mb-3 uppercase tracking-wider">全息主题色</label>
                    <div className="flex gap-4">
                       {['cyan', 'pink', 'yellow'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setTheme(c)}
                            className={`w-12 h-12 rounded border transition-all relative ${
                              theme === c ? `border-${c === 'cyan' ? 'cyber-cyan' : c === 'pink' ? 'cyber-pink' : 'cyber-yellow'} shadow-[0_0_10px_rgba(var(--color-${c}),0.5)]` : 'border-gray-700 bg-gray-900 opacity-50'
                            }`}
                            style={{ backgroundColor: c === 'cyan' ? '#00f3ff20' : c === 'pink' ? '#ff005520' : '#fcee0a20', borderColor: c === 'cyan' ? '#00f3ff' : c === 'pink' ? '#ff0055' : '#fcee0a' }}
                          >
                             {theme === c && <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-mono font-bold">ACT</div>}
                          </button>
                       ))}
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-cyber-cyan text-xs font-mono mb-3 uppercase tracking-wider">界面密度</label>
                    <div className="flex flex-col gap-2">
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" name="density" className="accent-cyber-cyan" defaultChecked />
                          <span className="text-sm text-gray-300 group-hover:text-white font-mono">标准视图 (Standard)</span>
                       </label>
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" name="density" className="accent-cyber-cyan" />
                          <span className="text-sm text-gray-300 group-hover:text-white font-mono">紧凑数据流 (Compact)</span>
                       </label>
                    </div>
                 </div>
              </div>
              
              <div className="mt-6">
                 <label className="block text-cyber-cyan text-xs font-mono mb-3 uppercase tracking-wider">系统语言</label>
                 <div className="flex gap-2">
                    <CyberButton variant="primary" className="text-xs py-1 px-3 h-8">简体中文</CyberButton>
                    <CyberButton variant="secondary" className="text-xs py-1 px-3 h-8">English</CyberButton>
                    <CyberButton variant="secondary" className="text-xs py-1 px-3 h-8">日本語</CyberButton>
                 </div>
              </div>
           </CyberCard>

           {/* Sync Settings */}
           <CyberCard title="数据链路_Link">
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded flex items-center justify-center bg-gray-900 border ${syncEnabled ? 'border-cyber-cyan text-cyber-cyan' : 'border-gray-700 text-gray-600'}`}>
                          <Cloud size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-200">云端实时同步</h4>
                          <p className="text-xs text-gray-500 font-mono">最后同步: 刚刚</p>
                       </div>
                    </div>
                    <button 
                       onClick={() => setSyncEnabled(!syncEnabled)}
                       className={`w-12 h-6 rounded-full p-1 transition-colors ${syncEnabled ? 'bg-cyber-cyan' : 'bg-gray-800'}`}
                    >
                       <div className={`w-4 h-4 bg-black rounded-full shadow-md transform transition-transform ${syncEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-3 border border-gray-800 bg-black/20 rounded">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                           <Wifi size={16} /> <span className="text-xs font-mono">网络带宽限制</span>
                        </div>
                        <input type="range" className="w-full accent-cyber-cyan h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                           <span>Eco</span>
                           <span>Unlimited</span>
                        </div>
                     </div>
                     <div className="p-3 border border-gray-800 bg-black/20 rounded">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                           <Smartphone size={16} /> <span className="text-xs font-mono">离线副本保留</span>
                        </div>
                        <div className="text-cyber-cyan font-mono text-xl font-bold">7 DAYS</div>
                     </div>
                 </div>
              </div>
           </CyberCard>

           {/* Notifications */}
           <CyberCard title="消息推送_Alerts">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {[
                    { label: '系统更新', desc: '核心组件补丁', active: true },
                    { label: '每日回顾提醒', desc: '20:00 PM', active: true },
                    { label: '入侵检测', desc: '异常登录警报', active: true },
                    { label: '社区动态', desc: '点赞与评论', active: false },
                 ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 border border-gray-800 bg-black/20 hover:border-cyber-cyan/30 transition-colors cursor-pointer group">
                       <div className={`mt-1 w-3 h-3 rounded-sm ${item.active ? 'bg-cyber-cyan shadow-[0_0_5px_#00f3ff]' : 'bg-gray-700'}`}></div>
                       <div>
                          <p className="text-sm font-bold text-gray-300 group-hover:text-cyber-cyan transition-colors">{item.label}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{item.desc}</p>
                       </div>
                    </div>
                 ))}
              </div>
           </CyberCard>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
