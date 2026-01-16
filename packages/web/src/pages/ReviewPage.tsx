import React from 'react';
import { CyberCard, CyberInput, CyberButton } from '../components/CyberUI';
import { StatRadar } from '../components/SystemCharts';
import { Brain, Smile, Activity, Save } from 'lucide-react';

const ReviewPage: React.FC = () => {
  // Mock Data for the Radar Chart
  const statsData = [
    { subject: '精神', A: 8, fullMark: 10 },
    { subject: '体力', A: 6, fullMark: 10 },
    { subject: '专注', A: 9, fullMark: 10 },
    { subject: '创造', A: 7, fullMark: 10 },
    { subject: '情绪', A: 8, fullMark: 10 },
    { subject: '社交', A: 5, fullMark: 10 },
  ];

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col gap-6 animate-in slide-in-from-bottom-5 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-1 flex items-center gap-3">
             <span className="text-cyber-pink">DAILY_PROTOCOL</span>
             <span className="text-gray-600 text-lg">// REVIEW</span>
          </h1>
          <p className="text-cyber-cyan font-mono text-sm">CYCLE: {new Date().toISOString().split('T')[0]}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
             <p className="text-[10px] text-gray-500 font-mono">STREAK</p>
             <p className="text-xl font-display text-cyber-yellow">42 DAYS</p>
          </div>
          <CyberButton glow>
            <Save size={16} /> SUBMIT
          </CyberButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left: Visualization */}
        <div className="lg:col-span-5 flex flex-col gap-6">
           {/* Radar Chart Card */}
           <CyberCard title="BIO_METRICS" className="flex-1 min-h-[300px] flex flex-col items-center justify-center bg-black/40">
              <div className="w-full h-full -ml-4">
                 <StatRadar data={statsData} />
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-gray-500 mt-2">
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-cyber-cyan"></div> CURRENT</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-700"></div> TARGET</div>
              </div>
           </CyberCard>

           {/* Quick Stats Grid */}
           <div className="grid grid-cols-3 gap-3 shrink-0">
             <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2 group hover:border-cyber-cyan/50 transition-colors">
                <Brain size={20} className="text-gray-500 group-hover:text-cyber-cyan" />
                <span className="text-lg font-bold font-display text-white">85%</span>
                <span className="text-[9px] text-gray-600 font-mono">FOCUS</span>
             </div>
             <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2 group hover:border-cyber-pink/50 transition-colors">
                <Activity size={20} className="text-gray-500 group-hover:text-cyber-pink" />
                <span className="text-lg font-bold font-display text-white">92%</span>
                <span className="text-[9px] text-gray-600 font-mono">ENERGY</span>
             </div>
             <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2 group hover:border-cyber-yellow/50 transition-colors">
                <Smile size={20} className="text-gray-500 group-hover:text-cyber-yellow" />
                <span className="text-lg font-bold font-display text-white">7.5</span>
                <span className="text-[9px] text-gray-600 font-mono">MOOD</span>
             </div>
           </div>
        </div>

        {/* Right: Input Log */}
        <CyberCard title="LOG_ENTRY" className="lg:col-span-7 flex flex-col gap-4 bg-black/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CyberInput label="PRIME_DIRECTIVE (核心任务)" placeholder="Objective..." />
            <CyberInput label="SYSTEM_INTERRUPTS (阻碍)" placeholder="Anomalies detected..." />
          </div>
          
          <div className="flex-1 flex flex-col">
            <label className="block text-cyber-cyan text-xs font-mono mb-2 uppercase tracking-wider">
               ANALYSIS_DATA (详细复盘)
            </label>
            <div className="relative flex-1 group">
               <div className="absolute -inset-[1px] bg-gradient-to-b from-cyber-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded blur-sm pointer-events-none"></div>
               <textarea 
                  className="w-full h-full bg-black/60 border border-gray-800 focus:border-cyber-cyan/50 text-gray-200 p-4 font-mono text-sm outline-none resize-none rounded transition-all"
                  placeholder="Initiating daily dump sequence..."
               />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
             <div className="flex items-center gap-2 p-2 border border-dashed border-gray-800 rounded bg-black/30">
                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-gray-500 text-xs">+</div>
                <span className="text-xs text-gray-500 font-mono">ATTACH_EVIDENCE</span>
             </div>
          </div>
        </CyberCard>

      </div>
    </div>
  );
};

export default ReviewPage;
