import React from 'react';
import { CyberCard, CyberInput, CyberButton } from '../components/CyberUI';
import { Brain, Smile, Activity } from 'lucide-react';

const ReviewPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-500">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-1">每日协议复盘</h1>
          <p className="text-cyber-cyan font-mono text-sm">日期: {new Date().toISOString().split('T')[0]}</p>
        </div>
        <div className="px-4 py-2 border border-cyber-yellow text-cyber-yellow font-mono text-xs">
          连续记录: 42 天
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CyberCard className="flex flex-col items-center justify-center py-8 hover:bg-white/5 transition-colors cursor-pointer group">
          <Brain size={40} className="text-gray-500 group-hover:text-cyber-cyan mb-4 transition-colors" />
          <h3 className="font-display text-lg mb-2">精神状态</h3>
          <div className="w-3/4 h-2 bg-gray-800 rounded-full overflow-hidden">
             <div className="w-2/3 h-full bg-cyber-cyan"></div>
          </div>
          <span className="mt-2 font-mono text-xs text-cyber-cyan">极佳</span>
        </CyberCard>

        <CyberCard className="flex flex-col items-center justify-center py-8 hover:bg-white/5 transition-colors cursor-pointer group">
          <Activity size={40} className="text-gray-500 group-hover:text-cyber-pink mb-4 transition-colors" />
          <h3 className="font-display text-lg mb-2">生产效能</h3>
          <div className="w-3/4 h-2 bg-gray-800 rounded-full overflow-hidden">
             <div className="w-1/2 h-full bg-cyber-pink"></div>
          </div>
          <span className="mt-2 font-mono text-xs text-cyber-pink">平稳</span>
        </CyberCard>

        <CyberCard className="flex flex-col items-center justify-center py-8 hover:bg-white/5 transition-colors cursor-pointer group">
          <Smile size={40} className="text-gray-500 group-hover:text-cyber-yellow mb-4 transition-colors" />
          <h3 className="font-display text-lg mb-2">情绪指数</h3>
          <div className="w-3/4 h-2 bg-gray-800 rounded-full overflow-hidden">
             <div className="w-4/5 h-full bg-cyber-yellow"></div>
          </div>
          <span className="mt-2 font-mono text-xs text-cyber-yellow">高昂</span>
        </CyberCard>
      </div>

      <CyberCard title="日志录入">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CyberInput label="核心任务" placeholder="今天的主要目标是什么？" />
            <CyberInput label="系统阻碍" placeholder="是否有中断或干扰？" />
          </div>
          
          <div>
            <label className="block text-cyber-cyan text-xs font-mono mb-1 uppercase tracking-wider">复盘数据</label>
            <textarea className="w-full bg-black/50 border border-gray-700 focus:border-cyber-cyan text-gray-100 px-4 py-2 font-mono h-32 outline-none focus:shadow-[0_0_10px_rgba(0,243,255,0.1)]" placeholder="对本周期的详细分析..." />
          </div>

          <div className="flex justify-end pt-4">
            <CyberButton glow>提交协议</CyberButton>
          </div>
        </div>
      </CyberCard>
    </div>
  );
};

export default ReviewPage;