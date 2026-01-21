import React, { useEffect, useState } from 'react';

const bootLogs = [
  "INITIALIZING KERNEL...",
  "LOADING NEURAL INTERFACE v2.0.77...",
  "BYPASSING SECURITY PROTOCOLS...",
  "ESTABLISHING SECURE CONNECTION...",
  "DECRYPTING USER DATA...",
  "MOUNTING VIRTUAL DOM...",
  "SYSTEM READY."
];

export const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let delay = 0;
    
    // Process logs
    bootLogs.forEach((log) => {
      delay += Math.random() * 300 + 100;
      setTimeout(() => {
        setLogs(prev => [...prev, log]);
      }, delay);
    });

    // Progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 5;
      });
    }, 100);

    // Completion
    setTimeout(() => {
      onComplete();
    }, delay + 800);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-cyber-cyan font-mono flex flex-col items-center justify-center p-10 cursor-wait">
      <div className="w-full max-w-lg space-y-4">
        {/* Hexagon Logo Animation */}
        <div className="flex justify-center mb-10">
           <div className="relative w-20 h-20 animate-spin-slow">
              <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-cyber-cyan stroke-[2]">
                 <polygon points="50 5, 95 27.5, 95 72.5, 50 95, 5 72.5, 5 27.5" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs animate-pulse">
                LOADING
              </div>
           </div>
        </div>

        {/* Log Stream */}
        <div className="h-40 overflow-hidden border border-gray-800 p-4 bg-black/50 text-xs shadow-[0_0_20px_rgba(0,243,255,0.1)]">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">
              <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
              <span className="animate-pulse">{log}</span>
            </div>
          ))}
          <div className="w-2 h-4 bg-cyber-cyan animate-flicker inline-block align-middle ml-1"></div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
             <span>SYSTEM_CHECK</span>
             <span>{Math.min(100, Math.floor(progress))}%</span>
          </div>
          <div className="h-1 w-full bg-gray-900 overflow-hidden">
             <div 
               className="h-full bg-cyber-cyan shadow-[0_0_10px_#00f3ff] transition-all duration-100 ease-out"
               style={{ width: `${progress}%` }}
             ></div>
          </div>
        </div>
      </div>
      
      {/* Background Noise */}
      <div className="fixed inset-0 pointer-events-none opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2280%22%20height=%2280%22%20viewBox=%220%200%2080%2080%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.8%22%20numOctaves=%222%22%20stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect%20width=%2280%22%20height=%2280%22%20filter=%22url(%23n)%22%20opacity=%220.4%22/%3E%3C/svg%3E')]"></div>
    </div>
  );
};
