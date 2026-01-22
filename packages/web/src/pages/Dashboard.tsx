import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { notesAPI } from '../api';
import { ActivityChart } from '../components/SystemCharts';
import { CyberCard, CyberScrambleText } from '../components/CyberUI';
import { Cpu, Wifi, Sparkles, Mic, Paperclip, Send, FileText, Zap, Github } from 'lucide-react';
import { CyberCompanion } from '../components/CyberCompanion';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { notes, addNote } = useData();
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // --- Live Data Simulation ---
  const [cpuData, setCpuData] = useState<Array<{time: number, value: number}>>([]);
  const [netData, setNetData] = useState<Array<{time: number, value: number}>>([]);

  useEffect(() => {
    // Fill initial buffer
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: Math.floor(Math.random() * 30) + 20
    }));
    setCpuData(initialData);
    setNetData(initialData.map(d => ({ ...d, value: Math.floor(Math.random() * 50) + 10 })));

    const interval = setInterval(() => {
      setCpuData(prev => {
        // Create jagged, tech-like movement
        const lastValue = prev[prev.length - 1].value;
        const change = (Math.random() - 0.5) * 20;
        let newValue = Math.max(10, Math.min(90, lastValue + change));
        // Occasional spike
        if (Math.random() > 0.9) newValue = 95;
        
        const next = [...prev.slice(1), { time: prev[prev.length - 1].time + 1, value: Math.floor(newValue) }];
        return next;
      });
      setNetData(prev => {
        const next = [...prev.slice(1), { time: prev[prev.length - 1].time + 1, value: Math.floor(Math.random() * 60) + 20 }];
        return next;
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  const handleQuickAction = (action: string) => {
    if (action === 'review') navigate('/review');
    if (action === 'note') navigate('/notes');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      // 1. Call real API to create note
      await notesAPI.create({
        title: `速记_${new Date().toLocaleTimeString()}`,
        content: inputText,
        is_pinned: false
      });

      // 2. Add to local context (for immediate UI feedback in Data Stream)
      addNote({
        user_id: 1, 
        title: `速记_${new Date().toLocaleTimeString()}`,
        content: inputText,
        isPinned: false,
        tags: ['Dashboard', 'Quick']
      });

      setInputText('');
    } catch (error) {
      console.error('Failed to create note:', error);
      // Fallback: still add to local if API fails (optional, but good for UX if offline?)
      // For now, let's assume we only want to show if successful or keep it simple
    }
  };

  return (
    <div className="flex flex-col h-full relative animate-in fade-in duration-700">
      
      {/* HUD Corners - With Breathing Effect (Responsive) */}
      <div className="absolute top-0 left-0 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-l border-t border-cyber-cyan/30 rounded-tl-xl pointer-events-none animate-pulse-slow"></div>
      <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-r border-t border-cyber-cyan/30 rounded-tr-xl pointer-events-none animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-0 left-0 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-l border-b border-cyber-cyan/30 rounded-bl-xl pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-0 right-0 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-r border-b border-cyber-cyan/30 rounded-br-xl pointer-events-none animate-pulse-slow" style={{ animationDelay: '3s' }}></div>

      {/* Subtle Background Breathing Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyber-cyan/5 via-transparent to-cyber-pink/5 pointer-events-none animate-pulse-slow opacity-50"></div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 h-full p-2 relative z-10">
        
        {/* Left Column: Live Monitors (Show horizontal on md, vertical on lg) */}
        <div className="hidden md:flex md:col-span-2 lg:col-span-3 flex-col gap-4 md:gap-6 justify-center">
           <div className="flex lg:flex-col gap-4 w-full">
              {/* CPU Widget */}
              <CyberCard title="CPU_CORE_01" noPadding className="flex-1 bg-black/60 border-cyber-pink/30 hover:border-cyber-pink/80 transition-all shadow-[0_0_20px_rgba(255,0,85,0.1)] group overflow-visible">
                <div className="absolute -left-1 top-1/2 w-1 h-10 bg-cyber-pink/50 rounded-r opacity-50 group-hover:h-20 transition-all duration-500"></div>
                <div className="p-4 pb-0 flex justify-between items-end border-b border-gray-800/50 mb-2">
                  <div className="flex items-center gap-2 mb-2 text-cyber-pink">
                    <Cpu size={18} className="animate-pulse" />
                    <span className="text-xs font-mono font-bold">KERNEL_PANIC</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mb-2">PID: 8821</div>
                </div>
                <ActivityChart data={cpuData} color="rgb(var(--color-pink))" />
              </CyberCard>
              
              {/* Network Widget */}
              <CyberCard title="NET_UPLINK" noPadding className="flex-1 bg-black/60 border-cyber-cyan/30 hover:border-cyber-cyan/80 transition-all shadow-[0_0_20px_rgba(0,243,255,0.1)] group overflow-visible">
                <div className="absolute -left-1 top-1/2 w-1 h-10 bg-cyber-cyan/50 rounded-r opacity-50 group-hover:h-20 transition-all duration-500"></div>
                <div className="p-4 pb-0 flex justify-between items-end border-b border-gray-800/50 mb-2">
                  <div className="flex items-center gap-2 mb-2 text-cyber-cyan">
                    <Wifi size={18} />
                    <span className="text-xs font-mono font-bold">ETH_0 CONNECTED</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mb-2">TX/RX: 10GB</div>
                </div>
                <ActivityChart data={netData} color="#00f3ff" />
              </CyberCard>
           </div>
        </div>

        {/* Center Column: Input Terminal (The Core) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-6 flex flex-col items-center justify-center z-10">
          
          {/* Welcome Text with Float Animation */}
          <div className="text-center mb-6 md:mb-10 space-y-2 animate-float">
            <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-cyber-cyan/5 border border-cyber-cyan/20 shadow-[0_0_20px_rgba(0,243,255,0.15)] animate-pulse-fast">
              <Sparkles className="text-cyber-cyan w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-white tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              <CyberScrambleText text="NEURAL_LINK" />
            </h1>
            <p className="text-cyber-cyan/60 font-mono text-xs tracking-[0.3em]">SYSTEM ONLINE // READY</p>
          </div>

          {/* Terminal Input */}
          <div className={`w-full max-w-xl relative group transition-all duration-300 ${isFocused ? 'scale-[1.02]' : 'animate-float'} `} style={{ animationDelay: '2s' }}>
            <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyber-cyan via-purple-500 to-cyber-pink rounded-lg opacity-30 blur-md transition duration-1000 animate-pulse-slow ${isFocused ? 'opacity-80' : 'opacity-20 group-hover:opacity-40'}`}></div>
            
            <form onSubmit={handleSubmit} className="relative bg-cyber-black rounded-lg border border-gray-800 flex flex-col shadow-2xl overflow-hidden backdrop-blur-xl">
              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 border-b border-gray-800">
                 <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                 </div>
                 <div className="text-[9px] font-mono text-gray-500">bash --login</div>
              </div>

              <textarea
                className="w-full bg-black/90 text-gray-100 font-mono text-sm placeholder-gray-700 outline-none resize-none min-h-[100px] p-4 leading-relaxed focus:bg-black/95 transition-colors"
                placeholder="> Initiating thought sequence..."
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
              
              <div className="flex justify-between items-center px-3 py-2 bg-gray-900/30 border-t border-gray-800/50">
                <div className="flex gap-2 text-gray-600">
                  <Mic size={16} className="hover:text-cyber-cyan cursor-pointer transition-colors" />
                  <Paperclip size={16} className="hover:text-cyber-cyan cursor-pointer transition-colors" />
                </div>
                <button 
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    inputText.trim() 
                      ? 'bg-cyber-cyan text-black shadow-[0_0_10px_#00f3ff] hover:bg-white' 
                      : 'bg-gray-800 text-gray-600'
                  }`}
                >
                  <span>INJECT</span>
                  <Send size={10} />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 animate-float" style={{ animationDelay: '1.5s' }}>
             <button onClick={() => handleQuickAction('note')} className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] border border-gray-800 rounded bg-cyber-panel/50 hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5 transition-all group backdrop-blur-sm">
                <FileText size={16} className="text-gray-500 group-hover:text-cyber-cyan transition-colors" />
                <span className="text-xs font-mono text-gray-400 group-hover:text-white">NEW_NOTE</span>
             </button>
             <button onClick={() => handleQuickAction('review')} className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] border border-gray-800 rounded bg-cyber-panel/50 hover:border-cyber-pink/50 hover:bg-cyber-pink/5 transition-all group backdrop-blur-sm">
                <Zap size={16} className="text-gray-500 group-hover:text-cyber-pink transition-colors" />
                <span className="text-xs font-mono text-gray-400 group-hover:text-white">DAILY_LOG</span>
             </button>
             <button onClick={() => navigate('/github')} className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] border border-gray-800 rounded bg-cyber-panel/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group backdrop-blur-sm">
                <Github size={16} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                <span className="text-xs font-mono text-gray-400 group-hover:text-white">PROJECT_BOARD</span>
             </button>
          </div>
        </div>

        {/* Right Column: AI Companion & Recent Data Stream */}
        <div className="hidden lg:flex lg:col-span-3 flex-col justify-end pb-10">
           {/* Cyber Companion (Top) */}
           <div className="mb-6 flex justify-center animate-float" style={{ animationDelay: '0.5s' }}>
              <CyberCompanion />
           </div>

           {/* Data Stream (Bottom) */}
           <div className="border-l-2 border-gray-800 pl-4 space-y-4 opacity-70 hover:opacity-100 transition-opacity">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">Data_Stream</p>
              {notes.slice(0, 3).map((note) => (
                <div key={note.id} className="pointer-events-auto group cursor-pointer" onClick={() => navigate('/notes')}>
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono text-cyber-cyan">{new Date(note.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      <div className={`h-[1px] w-full bg-gray-800 group-hover:bg-cyber-cyan transition-colors`}></div>
                   </div>
                   <div className="text-xs text-gray-400 group-hover:text-white font-mono truncate transition-colors pl-2 border-l border-transparent group-hover:border-cyber-cyan">
                      {note.title}
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
