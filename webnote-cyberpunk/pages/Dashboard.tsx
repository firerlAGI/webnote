import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberUI';
import { MOCK_NOTES } from '../constants';
import { Send, Mic, Paperclip, Sparkles, Zap, Lock, FileText, Clock, Cpu } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleQuickAction = (action: string) => {
    // 模拟快捷跳转
    if (action === 'review') navigate('/review');
    if (action === 'note') navigate('/notes');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    alert(`指令已接收: ${inputText}\n数据已注入神经云端。`);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] relative animate-in fade-in duration-500">
      
      {/* 顶部极简状态栏 */}
      <div className="absolute top-0 right-0 flex gap-4 text-[10px] font-mono text-gray-500 select-none">
        <span className="flex items-center gap-1"><Cpu size={10} /> CORE: ONLINE</span>
        <span className="flex items-center gap-1 text-cyber-cyan"><Zap size={10} /> SYNC: ACTIVE</span>
      </div>

      {/* 中央核心区域 */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full z-10">
        
        {/* 欢迎语 / Logo */}
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 shadow-[0_0_15px_rgba(0,243,255,0.2)] mb-4">
            <Sparkles className="text-cyber-cyan" size={32} />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-wide">
            下午好, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink">NetRunner</span>
          </h1>
          <p className="text-gray-500 font-mono text-sm">系统就绪。准备执行什么协议？</p>
        </div>

        {/* 快捷指令卡片 (类似 ChatGPT 的建议) */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mb-8 px-4">
          <button 
            onClick={() => handleQuickAction('note')}
            className="p-4 border border-gray-800 bg-cyber-panel/50 hover:bg-cyber-cyan/10 hover:border-cyber-cyan/50 rounded-lg text-left transition-all group flex items-start gap-4"
          >
            <div className="p-2 bg-gray-900 rounded-md group-hover:bg-cyber-cyan/20 transition-colors">
              <FileText className="text-cyber-cyan group-hover:scale-110 transition-transform" size={24} />
            </div>
            <div>
              <div className="text-gray-200 text-sm font-bold group-hover:text-cyber-cyan transition-colors">新建笔记</div>
              <div className="text-gray-600 text-[10px] font-mono mt-1">创建新的记忆片段</div>
            </div>
          </button>

          <button 
             onClick={() => handleQuickAction('review')}
             className="p-4 border border-gray-800 bg-cyber-panel/50 hover:bg-cyber-pink/10 hover:border-cyber-pink/50 rounded-lg text-left transition-all group flex items-start gap-4"
          >
            <div className="p-2 bg-gray-900 rounded-md group-hover:bg-cyber-pink/20 transition-colors">
              <Zap className="text-cyber-pink group-hover:scale-110 transition-transform" size={24} />
            </div>
            <div>
              <div className="text-gray-200 text-sm font-bold group-hover:text-cyber-pink transition-colors">每日复盘</div>
              <div className="text-gray-600 text-[10px] font-mono mt-1">同步今日数据流</div>
            </div>
          </button>
        </div>

        {/* 主输入框 */}
        <div className={`w-full relative group transition-all duration-300 ${isFocused ? 'scale-[1.01]' : ''}`}>
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyber-cyan via-purple-500 to-cyber-pink rounded-lg opacity-30 blur transition duration-500 ${isFocused ? 'opacity-70' : 'opacity-20 group-hover:opacity-40'}`}></div>
          <form onSubmit={handleSubmit} className="relative bg-cyber-black rounded-lg border border-gray-700 flex flex-col p-4 shadow-2xl">
            <textarea
              className="w-full bg-transparent text-gray-100 font-mono text-sm placeholder-gray-600 outline-none resize-none min-h-[60px] max-h-[200px]"
              placeholder="在此输入指令、笔记内容或搜索关键词..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-800/50">
              <div className="flex gap-2">
                <button type="button" className="p-2 text-gray-500 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-full transition-colors">
                  <Paperclip size={18} />
                </button>
                <button type="button" className="p-2 text-gray-500 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-full transition-colors">
                  <Mic size={18} />
                </button>
              </div>
              <button 
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2 rounded-md transition-all duration-200 ${
                  inputText.trim() 
                    ? 'bg-cyber-cyan text-black shadow-neon-cyan hover:bg-white' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </form>
          <div className="text-center mt-2">
             <p className="text-[10px] text-gray-600 font-mono">WebNote v2.077 may produce inaccurate protocols. Verify important data.</p>
          </div>
        </div>

      </div>

      {/* 底部近期记录 (类似历史记录，不显眼) */}
      <div className="hidden lg:block absolute bottom-0 w-full left-0 px-4">
         <p className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wider pl-1">近期缓存 // Recent_Cache</p>
         <div className="grid grid-cols-3 gap-4 opacity-60 hover:opacity-100 transition-opacity duration-300">
           {MOCK_NOTES.slice(0, 3).map(note => (
             <div key={note.id} className="p-3 border border-gray-800 bg-cyber-panel/30 rounded cursor-pointer hover:border-gray-600">
               <div className="flex items-center gap-2 mb-1">
                 <Clock size={12} className="text-cyber-cyan" />
                 <span className="text-[10px] text-gray-400 font-mono">{new Date(note.updatedAt).toLocaleDateString()}</span>
               </div>
               <div className="text-sm text-gray-300 truncate font-mono">{note.title}</div>
             </div>
           ))}
         </div>
      </div>

    </div>
  );
};

export default Dashboard;