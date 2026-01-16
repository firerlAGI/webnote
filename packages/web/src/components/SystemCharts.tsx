import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

// --- Shared SVG Defs for High-Tech Gradients ---
const TechGradients = () => (
  <svg style={{ height: 0, width: 0, position: 'absolute' }}>
    <defs>
      {/* Cyan Striped Gradient */}
      <pattern id="cyan-stripe" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
        <rect width="2" height="4" transform="translate(0,0)" fill="#00f3ff" fillOpacity="0.3" />
      </pattern>
      <linearGradient id="cyan-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#00f3ff" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#00f3ff" stopOpacity="0"/>
      </linearGradient>
      <mask id="cyan-mask">
         <rect x="0" y="0" width="100%" height="100%" fill="url(#cyan-fade)" />
      </mask>

      {/* Pink Striped Gradient */}
      <pattern id="pink-stripe" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
        <rect width="2" height="4" transform="translate(0,0)" fill="#ff0055" fillOpacity="0.3" />
      </pattern>
      <linearGradient id="pink-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff0055" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#ff0055" stopOpacity="0"/>
      </linearGradient>
      <mask id="pink-mask">
         <rect x="0" y="0" width="100%" height="100%" fill="url(#pink-fade)" />
      </mask>
    </defs>
  </svg>
);

// --- Radar Chart (Hexagon) for Skills/Stats ---
interface StatRadarProps {
  data: { subject: string; A: number; fullMark: number }[];
}

export const StatRadar: React.FC<StatRadarProps> = ({ data }) => {
  return (
    <div className="w-full h-[300px] relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          <PolarGrid stroke="#374151" strokeDasharray="4 4" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#00f3ff', fontSize: 12, fontFamily: 'monospace' } as any}
          />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="Current Status"
            dataKey="A"
            stroke="#00f3ff"
            strokeWidth={2}
            fill="url(#cyan-stripe)" // Use striped pattern
            fillOpacity={0.8}
            className="drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]"
          />
          {/* Decorative glowing overlay */}
          <Radar
            name="Glow"
            dataKey="A"
            stroke="transparent"
            fill="#00f3ff"
            fillOpacity={0.2}
            className="filter blur-md"
          />
        </RadarChart>
      </ResponsiveContainer>
      {/* Target Crosshair Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <div className="w-[160%] h-[1px] bg-cyber-cyan/30 absolute"></div>
        <div className="h-[160%] w-[1px] bg-cyber-cyan/30 absolute"></div>
        <div className="w-[85%] h-[85%] border border-dashed border-cyber-cyan/20 rounded-full absolute animate-spin-slow"></div>
      </div>
      <TechGradients />
    </div>
  );
};

// --- Live Activity Chart (Area) ---
interface ActivityChartProps {
  data: { time: string | number; value: number }[];
  color?: string;
  label?: string;
  valueDisplay?: string;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data, color = "#ff0055", label, valueDisplay }) => {
  // Determine gradient ID based on color hex (simplification for this specific theme)
  const isCyan = color === "#00f3ff";
  const maskId = isCyan ? "url(#cyan-mask)" : "url(#pink-mask)";
  const patternId = isCyan ? "url(#cyan-stripe)" : "url(#pink-stripe)";
  const glowShadow = isCyan ? "drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]" : "drop-shadow-[0_0_8px_rgba(255,0,85,0.6)]";

  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;

  return (
    <div className="w-full h-[160px] relative overflow-hidden group">
      <TechGradients />
      
      {/* Background Tactical Grid */}
      <div className="absolute inset-0 border-t border-b border-gray-800/50 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:20px_20px] pointer-events-none"></div>

      {/* Header Info Overlay */}
      <div className="absolute top-2 right-2 z-10 text-right pointer-events-none">
         <div className="text-2xl font-display font-bold tabular-nums leading-none" style={{ color: color, textShadow: `0 0 10px ${color}` }}>
            {valueDisplay || latestValue}<span className="text-[10px] ml-1 opacity-70">%</span>
         </div>
         <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mt-1">
           PEAK: {Math.max(...data.map(d => d.value))} / AVG: {Math.round(data.reduce((a, b) => a + b.value, 0) / data.length)}
         </div>
      </div>

      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <AreaChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <defs>
            {/* We define specific linear gradients here for the stroke fade effect */}
            <linearGradient id={`stroke${color.replace('#','')}`} x1="0" y1="0" x2="1" y2="0">
               <stop offset="0%" stopColor={color} stopOpacity={0.2} />
               <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#374151" opacity={0.3} vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis hide domain={[0, 100]} />
          
          {/* The Fill Layer (Striped Pattern masked by Fade) */}
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="none" 
            fill={patternId}
            mask={maskId}
            isAnimationActive={false}
          />

          {/* The Stroke Layer (Glowing Line) */}
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={`url(#stroke${color.replace('#','')})`}
            strokeWidth={3}
            fill="none" 
            className={glowShadow}
            isAnimationActive={true}
            animationDuration={300}
          />
          
          {/* Threshold Line */}
          <ReferenceLine y={80} stroke={color} strokeDasharray="3 3" opacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Dynamic Scanline Animation */}
      <div className="absolute top-0 bottom-0 w-[2px] bg-white opacity-50 shadow-[0_0_15px_white] animate-[scan_3s_linear_infinite] pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, ${color}, transparent)` }}></div>
      
      {/* Glitch Overlay Effect on Hover */}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:animate-pulse pointer-events-none mix-blend-overlay transition-opacity"></div>
    </div>
  );
};
