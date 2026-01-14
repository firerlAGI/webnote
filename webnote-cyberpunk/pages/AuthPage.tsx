import React from 'react';
import { CyberCard, CyberInput, CyberButton } from '../components/CyberUI';
import { Cpu } from 'lucide-react';

interface AuthPageProps {
  onLogin: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-black bg-grid-pattern relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-cyan/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-pink/10 rounded-full blur-[100px]"></div>

      <CyberCard className="w-full max-w-md z-10 p-8 border-cyber-cyan/50 shadow-[0_0_50px_rgba(0,243,255,0.1)]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-cyber-cyan/30 bg-black mb-4 relative">
             <Cpu className="text-cyber-cyan animate-pulse" size={32} />
             <div className="absolute inset-0 border border-cyber-cyan rounded-full animate-ping opacity-20"></div>
          </div>
          <h1 className="text-4xl font-display font-bold text-white tracking-widest">WEBNOTE</h1>
          <p className="text-cyber-cyan font-mono text-xs tracking-[0.3em] mt-2">安全接入终端</p>
        </div>

        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
          <CyberInput label="网络 ID" placeholder="USR-2077" />
          <CyberInput label="访问密钥" type="password" placeholder="••••••••" />
          
          <div className="flex items-center justify-between text-xs font-mono text-gray-500">
            <label className="flex items-center cursor-pointer hover:text-cyber-cyan">
              <input type="checkbox" className="mr-2 accent-cyber-cyan" />
              保持链路连接
            </label>
            <a href="#" className="hover:text-cyber-pink transition-colors">重置凭证?</a>
          </div>

          <CyberButton className="w-full py-3" glow>
            初始化会话
          </CyberButton>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-gray-600 text-xs font-mono">
            系统状态: <span className="text-green-500">在线</span> | 加密: <span className="text-cyber-cyan">AES-256</span>
          </p>
        </div>
      </CyberCard>
    </div>
  );
};

export default AuthPage;