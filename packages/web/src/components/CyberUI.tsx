import React from 'react';

// --- CyberButton ---
interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  glow?: boolean;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  children, 
  variant = 'primary', 
  glow = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "relative font-mono font-bold tracking-wider uppercase transition-all duration-200 clip-corner-rb px-6 py-2 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-cyber-cyan text-cyber-black hover:bg-white hover:shadow-neon-cyan border-none",
    secondary: "bg-transparent border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/10",
    danger: "bg-transparent border border-cyber-pink text-cyber-pink hover:bg-cyber-pink/10 hover:shadow-neon-pink",
  };

  const glowStyle = glow ? (variant === 'danger' ? 'shadow-neon-pink' : 'shadow-neon-cyan') : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${glowStyle} ${className}`}
      {...props}
    >
      {children}
      {/* Decorative corner accent */}
      <span className="absolute bottom-0 right-0 w-2 h-2 bg-white/50 clip-path-polygon"></span>
    </button>
  );
};

// --- CyberCard ---
interface CyberCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
}

export const CyberCard: React.FC<CyberCardProps> = ({ children, title, className = '', noPadding = false }) => {
  return (
    <div className={`relative bg-cyber-panel border border-cyber-cyan/30 ${className}`}>
      {/* Header Bar */}
      {title && (
        <div className="flex items-center justify-between bg-cyber-cyan/10 border-b border-cyber-cyan/30 px-4 py-2">
          <h3 className="text-cyber-cyan font-mono text-sm tracking-widest uppercase truncate">
            // {title}
          </h3>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-cyber-cyan/50 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-cyber-cyan/30 rounded-full"></div>
            <div className="w-2 h-2 bg-cyber-cyan/10 rounded-full"></div>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyber-cyan"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyber-cyan"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyber-cyan"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyber-cyan"></div>
    </div>
  );
};

// --- CyberInput ---
interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const CyberInput: React.FC<CyberInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-cyber-cyan text-xs font-mono mb-1 uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full bg-black/50 border border-gray-700 focus:border-cyber-cyan text-gray-100 px-4 py-2 font-mono outline-none transition-colors placeholder-gray-600 focus:shadow-[0_0_10px_rgba(0,243,255,0.1)] ${className}`}
        {...props}
      />
    </div>
  );
};

// --- CyberBadge ---
export const CyberBadge: React.FC<{ children: React.ReactNode; color?: 'cyan' | 'pink' | 'yellow' }> = ({ children, color = 'cyan' }) => {
  const colors = {
    cyan: 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5',
    pink: 'border-cyber-pink text-cyber-pink bg-cyber-pink/5',
    yellow: 'border-cyber-yellow text-cyber-yellow bg-cyber-yellow/5',
  };
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${colors[color]}`}>
      {children}
    </span>
  );
};