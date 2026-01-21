import React, { useState, useEffect } from 'react';
import { CyberCard, CyberButton, CyberInput, CyberBadge } from '../components/CyberUI';
import { User, Cloud, Shield, Trash2, Save, Smartphone, Wifi, Lock, FileText } from 'lucide-react';
import { userAPI } from '../api';
import { User as UserType, UserExtended } from '../types';
import ChangelogModal from '../components/ChangelogModal';

const translations = {
  'zh-CN': {
    pageTitle: '系统配置_Config',
    pageSubtitle: '终端参数 // 偏好设置 // 安全协议',
    saveConfig: '保存配置',
    saveAlert: '配置已覆写至神经芯片',
    identityTitle: '用户识别码_Identity',
    upload: 'UPLOAD',
    displayName: '显示名称',
    email: '电子邮箱',
    permissionUser: '用户权限',
    permissionGuest: '未登录',
    idLabel: 'ID',
    securityTitle: '安全协议_Security',
    twoFactorTitle: '双重验证 (2FA)',
    twoFactorDesc: '生物识别 / 硬件密钥',
    twoFactorStatus: '已启用',
    encryptionTitle: '数据加密',
    encryptionDesc: 'AES-256-GCM',
    encryptionStatus: '正常',
    clearCache: '清除本地缓存',
    interfaceTitle: '神经界面_Interface',
    themeLabel: '全息主题色',
    densityLabel: '界面密度',
    densityStandard: '标准视图 (Standard)',
    densityCompact: '紧凑数据流 (Compact)',
    languageLabel: '系统语言',
    syncTitle: '数据链路_Link',
    syncName: '云端实时同步',
    lastSync: '最后同步: 刚刚',
    bandwidthLimit: '网络带宽限制',
    offlineRetention: '离线副本保留',
    offlineRetentionValue: '7 DAYS',
    alertsTitle: '消息推送_Alerts',
    notificationSystemUpdate: '系统更新',
    notificationSystemUpdateDesc: '核心组件补丁',
    notificationDailyReview: '每日回顾提醒',
    notificationDailyReviewDesc: '20:00 PM',
    notificationIntrusion: '入侵检测',
    notificationIntrusionDesc: '异常登录警报',
    notificationCommunity: '社区动态',
    notificationCommunityDesc: '点赞与评论',
    viewChangelog: '查看更新日志',
    systemUpdateVersion: '当前版本',
    currentVersion: 'v1.0.0',
  },
  en: {
    pageTitle: 'System Config_Config',
    pageSubtitle: 'Terminal parameters // Preferences // Security protocols',
    saveConfig: 'Save Config',
    saveAlert: 'Config overridden to neural chip',
    identityTitle: 'User Identity_Identity',
    upload: 'UPLOAD',
    displayName: 'Display Name',
    email: 'Email',
    permissionUser: 'User Access',
    permissionGuest: 'Not Logged In',
    idLabel: 'ID',
    securityTitle: 'Security Protocols_Security',
    twoFactorTitle: 'Two-Factor Auth (2FA)',
    twoFactorDesc: 'Biometrics / Hardware Key',
    twoFactorStatus: 'Enabled',
    encryptionTitle: 'Data Encryption',
    encryptionDesc: 'AES-256-GCM',
    encryptionStatus: 'Normal',
    clearCache: 'Clear Local Cache',
    interfaceTitle: 'Neural Interface_Interface',
    themeLabel: 'Holographic Theme',
    densityLabel: 'Interface Density',
    densityStandard: 'Standard View (Standard)',
    densityCompact: 'Compact Data Stream (Compact)',
    languageLabel: 'System Language',
    syncTitle: 'Data Link_Link',
    syncName: 'Cloud Realtime Sync',
    lastSync: 'Last Sync: Just now',
    bandwidthLimit: 'Network Bandwidth Limit',
    offlineRetention: 'Offline Copy Retention',
    offlineRetentionValue: '7 DAYS',
    alertsTitle: 'Alerts_Alerts',
    notificationSystemUpdate: 'System Update',
    notificationSystemUpdateDesc: 'Core component patch',
    notificationDailyReview: 'Daily Review Reminder',
    notificationDailyReviewDesc: '20:00 PM',
    notificationIntrusion: 'Intrusion Detection',
    notificationIntrusionDesc: 'Anomalous login alert',
    notificationCommunity: 'Community Activity',
    notificationCommunityDesc: 'Likes & Comments',
    viewChangelog: 'View Changelog',
    systemUpdateVersion: 'Current Version',
    currentVersion: 'v1.0.0',
  },
  ja: {
    pageTitle: 'システム設定_Config',
    pageSubtitle: '端末パラメータ // 設定 // セキュリティプロトコル',
    saveConfig: '設定を保存',
    saveAlert: '設定をニューラルチップに上書きしました',
    identityTitle: 'ユーザー識別_Identity',
    upload: 'UPLOAD',
    displayName: '表示名',
    email: 'メール',
    permissionUser: 'ユーザー権限',
    permissionGuest: '未ログイン',
    idLabel: 'ID',
    securityTitle: 'セキュリティプロトコル_Security',
    twoFactorTitle: '二要素認証 (2FA)',
    twoFactorDesc: '生体認証 / ハードウェアキー',
    twoFactorStatus: '有効',
    encryptionTitle: 'データ暗号化',
    encryptionDesc: 'AES-256-GCM',
    encryptionStatus: '正常',
    clearCache: 'ローカルキャッシュを削除',
    interfaceTitle: '神経インターフェース_Interface',
    themeLabel: 'ホログラムテーマ',
    densityLabel: '画面密度',
    densityStandard: '標準ビュー (Standard)',
    densityCompact: 'コンパクトデータストリーム (Compact)',
    languageLabel: 'システム言語',
    syncTitle: 'データリンク_Link',
    syncName: 'クラウドリアルタイム同期',
    lastSync: '最終同期: たった今',
    bandwidthLimit: 'ネットワーク帯域制限',
    offlineRetention: 'オフライン複製保持',
    offlineRetentionValue: '7日間',
    alertsTitle: '通知_Alerts',
    notificationSystemUpdate: 'システム更新',
    notificationSystemUpdateDesc: 'コアコンポーネントのパッチ',
    notificationDailyReview: '日次レビュー通知',
    notificationDailyReviewDesc: '20:00 PM',
    notificationIntrusion: '侵入検知',
    notificationIntrusionDesc: '異常ログイン警告',
    notificationCommunity: 'コミュニティ動向',
    notificationCommunityDesc: 'いいね・コメント',
    viewChangelog: '更新ログを表示',
    systemUpdateVersion: '現在のバージョン',
    currentVersion: 'v1.0.0',
  },
} as const;

type Language = keyof typeof translations;
type TranslationKey = keyof typeof translations['zh-CN'];

const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'cyan');
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('language');
    if (stored === 'zh-CN' || stored === 'en' || stored === 'ja') return stored;
    return 'zh-CN';
  });
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [user, setUser] = useState<UserType | UserExtended | null>(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });
  const [displayName, setDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [stats, setStats] = useState({ totalWordCount: 0, activeDays: 0 });

  useEffect(() => {
    userAPI.getStats()
      .then(response => {
        if (response.data.success) {
          setStats(response.data.data);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.username || '');
      setUserEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    userAPI.getMe()
      .then(response => {
        if (response.data.success) {
          setUser(response.data.data);
          localStorage.setItem('user', JSON.stringify(response.data.data));
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-language', language);
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: TranslationKey) => translations[language][key];

  const userIdLabel = user?.id ? `USR-${String(user.id).padStart(4, '0')}` : 'USR-????';
  const permissionLabel = user ? t('permissionUser') : t('permissionGuest');
  const permissionColor = user ? 'cyan' : 'yellow';
  const languageOptions: { value: Language; label: string }[] = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-8 sm:pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
           <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">{t('pageTitle')}</h1>
           <p className="text-cyber-cyan font-mono text-xs sm:text-sm">{t('pageSubtitle')}</p>
        </div>
        <CyberButton glow onClick={() => alert(t('saveAlert'))}>
          <Save size={16} /> {t('saveConfig')}
        </CyberButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Left Column: User & Security */}
        <div className="md:w-[280px] lg:w-auto space-y-4 md:space-y-6">
           <CyberCard title={t('identityTitle')}>
              <div className="flex flex-col items-center py-3 sm:py-4">
                 <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-cyber-cyan bg-cyber-cyan/10 flex items-center justify-center mb-3 sm:mb-4 relative group cursor-pointer overflow-hidden">
                    <User size={40} className="text-cyber-cyan" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="text-[10px] font-mono text-white">{t('upload')}</span>
                    </div>
                 </div>
                 <h2 className="text-lg sm:text-xl font-display text-white">{displayName || '—'}</h2>
                 <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-3 sm:mb-4">{t('idLabel')}: {userIdLabel}</p>
                 <CyberBadge color={permissionColor}>{permissionLabel}</CyberBadge>
              </div>
              <div className="space-y-4 mt-4">
                 <CyberInput label={t('displayName')} value={displayName} readOnly />
                 <CyberInput label={t('email')} value={userEmail} readOnly />
              </div>
           </CyberCard>

           <CyberCard title={t('securityTitle')}>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
                    <div className="flex items-center gap-3">
                       <Lock size={18} className="text-cyber-yellow" />
                       <div>
                          <p className="text-sm font-bold text-gray-200">{t('twoFactorTitle')}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{t('twoFactorDesc')}</p>
                       </div>
                    </div>
                    <span className="text-cyber-cyan text-xs font-mono">{t('twoFactorStatus')}</span>
                 </div>
                 <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
                    <div className="flex items-center gap-3">
                       <Shield size={18} className="text-cyber-cyan" />
                       <div>
                          <p className="text-sm font-bold text-gray-200">{t('encryptionTitle')}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{t('encryptionDesc')}</p>
                       </div>
                    </div>
                    <span className="text-green-500 text-xs font-mono">{t('encryptionStatus')}</span>
                 </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-800">
                 <CyberButton variant="danger" className="w-full text-xs">
                    <Trash2 size={14} /> {t('clearCache')}
                 </CyberButton>
              </div>
           </CyberCard>
        </div>

        {/* Right Column: Interface & System */}
        <div className="lg:col-span-2 space-y-6">
           {/* Compact Stats Panel */}
           <div className="grid grid-cols-2 gap-4">
             <div className="bg-black/40 border border-cyber-cyan/30 p-3 rounded flex items-center justify-between shadow-[0_0_10px_rgba(0,243,255,0.1)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-cyan/5 rounded-full blur-xl -mr-8 -mt-8 transition-all group-hover:bg-cyber-cyan/10"></div>
               <div className="relative z-10">
                 <div className="text-cyber-cyan text-[10px] font-mono tracking-widest uppercase mb-1">DATA_VOLUME</div>
                 <div className="text-white text-xl font-display font-bold tracking-wide">{stats.totalWordCount.toLocaleString()} <span className="text-[10px] font-mono text-gray-500 font-normal">CHARS</span></div>
               </div>
               <div className="relative z-10 h-8 w-8 rounded bg-cyber-cyan/10 border border-cyber-cyan/20 flex items-center justify-center text-cyber-cyan group-hover:border-cyber-cyan/50 transition-colors">
                 <FileText size={14} />
               </div>
             </div>
             <div className="bg-black/40 border border-cyber-pink/30 p-3 rounded flex items-center justify-between shadow-[0_0_10px_rgba(255,0,85,0.1)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-pink/5 rounded-full blur-xl -mr-8 -mt-8 transition-all group-hover:bg-cyber-pink/10"></div>
               <div className="relative z-10">
                 <div className="text-cyber-pink text-[10px] font-mono tracking-widest uppercase mb-1">UPTIME</div>
                 <div className="text-white text-xl font-display font-bold tracking-wide">{stats.activeDays} <span className="text-[10px] font-mono text-gray-500 font-normal">DAYS</span></div>
               </div>
               <div className="relative z-10 h-8 w-8 rounded bg-cyber-pink/10 border border-cyber-pink/20 flex items-center justify-center text-cyber-pink group-hover:border-cyber-pink/50 transition-colors">
                 <Smartphone size={14} />
               </div>
             </div>
           </div>

           {/* Visual Settings */}
           <CyberCard title={t('interfaceTitle')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-cyber-cyan text-xs font-mono mb-3 uppercase tracking-wider">{t('themeLabel')}</label>
                    <div className="flex gap-4">
                       {['cyan', 'pink', 'yellow'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setTheme(c)}
                            className={`w-12 h-12 rounded border transition-all relative ${
                              theme === c ? `border-${c === 'cyan' ? 'cyber-cyan' : c === 'pink' ? 'cyber-pink' : 'cyber-yellow'} shadow-[0_0_10px_rgba(var(--color-${c}),0.5)]` : 'border-gray-700 bg-gray-900 opacity-50'
                            }`}
                            style={{ backgroundColor: c === 'cyan' ? 'rgba(var(--color-cyan) / 0.125)' : c === 'pink' ? 'rgba(var(--color-pink) / 0.125)' : 'rgba(var(--color-yellow) / 0.125)', borderColor: c === 'cyan' ? 'rgb(var(--color-cyan))' : c === 'pink' ? 'rgb(var(--color-pink))' : 'rgb(var(--color-yellow))' }}
                          >
                             {theme === c && <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-mono font-bold">ACT</div>}
                          </button>
                       ))}
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-cyber-cyan text-xs font-mono mb-3 uppercase tracking-wider">{t('densityLabel')}</label>
                    <div className="flex flex-col gap-2">
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" name="density" className="accent-cyber-cyan" defaultChecked />
                          <span className="text-sm text-gray-300 group-hover:text-white font-mono">{t('densityStandard')}</span>
                       </label>
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" name="density" className="accent-cyber-cyan" />
                          <span className="text-sm text-gray-300 group-hover:text-white font-mono">{t('densityCompact')}</span>
                       </label>
                    </div>
                 </div>
              </div>
              
              <div className="mt-6">
                 <label className="block text-cyber-cyan text-xs font-mono mb-3 uppercase tracking-wider">{t('languageLabel')}</label>
                 <div className="flex gap-2">
                    {languageOptions.map(option => (
                      <CyberButton
                        key={option.value}
                        variant={language === option.value ? 'primary' : 'secondary'}
                        className="text-xs py-1 px-3 h-8"
                        onClick={() => setLanguage(option.value)}
                      >
                        {option.label}
                      </CyberButton>
                    ))}
                 </div>
              </div>
           </CyberCard>

           {/* Sync Settings */}
           <CyberCard title={t('syncTitle')}>
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded flex items-center justify-center bg-gray-900 border ${syncEnabled ? 'border-cyber-cyan text-cyber-cyan' : 'border-gray-700 text-gray-600'}`}>
                          <Cloud size={20} />
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-200">{t('syncName')}</h4>
                          <p className="text-xs text-gray-500 font-mono">{t('lastSync')}</p>
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
                           <Wifi size={16} /> <span className="text-xs font-mono">{t('bandwidthLimit')}</span>
                        </div>
                        <input type="range" className="w-full accent-cyber-cyan h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                           <span>Eco</span>
                           <span>Unlimited</span>
                        </div>
                     </div>
                     <div className="p-3 border border-gray-800 bg-black/20 rounded">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                           <Smartphone size={16} /> <span className="text-xs font-mono">{t('offlineRetention')}</span>
                        </div>
                        <div className="text-cyber-cyan font-mono text-xl font-bold">{t('offlineRetentionValue')}</div>
                     </div>
                 </div>
              </div>
           </CyberCard>

           {/* Notifications */}
           <CyberCard title={t('alertsTitle')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {/* System Update - Special Card with Changelog Button */}
                 <div className="col-span-1 sm:col-span-2 flex items-start gap-3 p-4 border border-gray-800 bg-black/20 hover:border-cyber-cyan/30 transition-colors">
                    <div className="mt-1 w-3 h-3 rounded-sm bg-cyber-cyan shadow-[0_0_5px_#00f3ff]"></div>
                    <div className="flex-1">
                       <div className="flex items-center justify-between mb-1">
                          <div>
                             <p className="text-sm font-bold text-gray-200">{t('notificationSystemUpdate')}</p>
                             <p className="text-[10px] text-gray-500 font-mono">{t('notificationSystemUpdateDesc')}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                             <div className="text-right">
                                <p className="text-[10px] text-gray-500 font-mono">{t('systemUpdateVersion')}</p>
                                <p className="text-sm font-mono text-cyber-cyan font-bold">{t('currentVersion')}</p>
                             </div>
                             <CyberButton
                                variant="secondary"
                                onClick={() => setShowChangelog(true)}
                                className="shrink-0 px-3 py-1.5 text-xs"
                             >
                                <FileText size={14} />
                                {t('viewChangelog')}
                             </CyberButton>
                          </div>
                       </div>
                    </div>
                 </div>

                 {[
                    { label: t('notificationDailyReview'), desc: t('notificationDailyReviewDesc'), active: true },
                    { label: t('notificationIntrusion'), desc: t('notificationIntrusionDesc'), active: true },
                    { label: t('notificationCommunity'), desc: t('notificationCommunityDesc'), active: false },
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

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={showChangelog}
        onClose={() => setShowChangelog(false)}
        language={language}
      />
    </div>
  );
};

export default SettingsPage;
