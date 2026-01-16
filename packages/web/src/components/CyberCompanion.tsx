import React, { useState, useEffect } from 'react';
import { MessageSquare, Heart, Zap, Activity } from 'lucide-react';
import { CyberScrambleText } from './CyberUI';

// 预设对话库
const DIALOGUES = [
  "NetRunner，检测到您的心率略有波动，建议检查神经连接。",
  "系统核心温度正常，随时准备执行协议。",
  "这一片数据的流动...真美，不是吗？",
  "别忘了每隔 45 分钟断开连接，休息一下肉体。",
  "我在潜网中发现了一些有趣的碎片，稍后整理给您。",
  "我是 NOVA，您的专属神经伴侣。随时待命。",
  "无论现实多么灰暗，这里永远有光。",
  "警告：检测到外部压力源。请保持专注。",
];

export const CyberCompanion: React.FC = () => {
  const [text, setText] = useState<string>("系统上线。等待指令...");
  const [isGlitching, setIsGlitching] = useState(false);
  const [affinity, setAffinity] = useState(50); // 好感度/同步率

  // 自动更换对话
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) { // 并非每次都说话
         changeDialogue();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const changeDialogue = () => {
    const randomText = DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)];
    setText(randomText);
  };

  const handleInteraction = () => {
    setIsGlitching(true);
    setAffinity(prev => Math.min(100, prev + 5));
    changeDialogue();
    setTimeout(() => setIsGlitching(false), 500);
  };

  return (
    <div className="relative w-full flex flex-col items-center group">
      
      {/* 顶部全息投影底座光效 */}
      <div className="absolute top-0 w-full h-full bg-gradient-to-b from-cyber-cyan/5 to-transparent pointer-events-none"></div>

      {/* 对话气泡 */}
      <div className={`absolute -top-16 left-0 right-0 z-20 transition-all duration-300 ${text ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-black/80 border border-cyber-cyan/40 p-3 rounded-lg relative shadow-[0_0_15px_rgba(0,243,255,0.2)] backdrop-blur-sm mx-4">
           <p className="text-cyber-cyan font-sans text-xs leading-relaxed typing-effect">
              {text}
           </p>
           {/* 气泡尖角 */}
           <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black border-r border-b border-cyber-cyan/40 transform rotate-45"></div>
        </div>
      </div>

      {/* 角色容器 */}
      <div 
        onClick={handleInteraction}
        className="relative w-full max-w-[280px] aspect-[3/4] cursor-pointer transition-transform active:scale-95"
      >
        {/* 全息扫描线效果 */}
        <div className="absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,243,255,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] pointer-events-none animate-scan"></div>
        
        {/* 角色图片 (这里使用 placeholder，实际开发请替换为透明背景的二次元立绘) */}
        {/* 注意：为了效果，我们使用了 CSS filter 来模拟全息感 */}
        <img 
          src="https://image.pollinations.ai/prompt/cyberpunk%20anime%20girl%20hologram%20portrait%20blue%20neon%20tech%20visor%20silver%20hair%20digital%20art%20black%20background?width=400&height=600&nologo=true" 
          alt="AI Companion"
          className={`w-full h-full object-cover rounded-xl border border-cyber-cyan/20 mask-image-gradient 
            ${isGlitching ? 'animate-glitch' : 'animate-pulse-slow'}
            filter drop-shadow-[0_0_10px_rgba(0,243,255,0.3)] opacity-90 hover:opacity-100 transition-opacity
          `}
          style={{
             maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
             WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
          }}
        />

        {/* 故障噪点层 (Glitch Overlay) */}
        {isGlitching && (
            <div className="absolute inset-0 bg-cyber-pink/20 mix-blend-overlay clip-diagonal animate-glitch"></div>
        )}
      </div>

      {/* 底部全息投影发生器 UI */}
      <div className="w-full mt-[-20px] relative z-10 px-6">
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyber-cyan to-transparent shadow-[0_0_10px_#00f3ff]"></div>
        <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-cyber-cyan/60">
           <div className="flex items-center gap-1">
              <Activity size={10} className="animate-pulse" />
              <span>SYNC: {affinity}%</span>
           </div>
           <div className="flex items-center gap-1">
              <span className="uppercase tracking-widest">NOVA_AI</span>
           </div>
        </div>
      </div>

    </div>
  );
};
