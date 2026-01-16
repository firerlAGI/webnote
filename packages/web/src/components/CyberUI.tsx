import React, { useState, useEffect, forwardRef } from 'react';

// --- CyberScrambleText ---
// A visual effect that "decodes" text characters randomly
export const CyberScrambleText: React.FC<{ text: string; className?: string; speed?: number }> = ({ 
  text, 
  className = '',
  speed = 30
}) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }

      iteration += 1 / 2; // Decodes slowly
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={className}>{display}</span>;
};

// --- CyberButton ---
interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  glow?: boolean;
  icon?: React.ReactNode;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  children, 
  variant = 'primary', 
  glow = false,
  className = '',
  icon,
  ...props 
}) => {
  const baseStyles = "relative font-mono font-bold tracking-wider uppercase transition-all duration-300 clip-corner-rb px-6 py-2 flex items-center justify-center gap-2 group overflow-hidden select-none active:scale-95";
  
  const variants = {
    primary: "bg-cyber-cyan text-black hover:bg-white border-none shadow-[0_0_10px_rgba(0,243,255,0.2)]",
    secondary: "bg-transparent border border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan hover:shadow-[0_0_10px_rgba(0,243,255,0.2)]",
    danger: "bg-transparent border border-cyber-pink/50 text-cyber-pink hover:bg-cyber-pink/10 hover:border-cyber-pink hover:shadow-neon-pink",
    ghost: "bg-transparent text-gray-400 hover:text-cyber-cyan hover:bg-white/5",
  };

  const glowStyle = glow ? (variant === 'danger' ? 'shadow-neon-pink' : 'shadow-neon-cyan') : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${glowStyle} ${className}`}
      {...props}
    >
      {/* Background Scan Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite] pointer-events-none"></div>
      
      {icon && <span className="relative z-10">{icon}</span>}
      <span className="relative z-10">{children}</span>
      
      {/* Decorative Corner */}
      <span className="absolute bottom-0 right-0 w-3 h-3 bg-white/30 clip-path-polygon group-hover:bg-white/80 transition-colors"></span>
    </button>
  );
};

// --- CyberCard ---
interface CyberCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
  variant?: 'default' | 'hologram' | 'flat';
}

export const CyberCard: React.FC<CyberCardProps> = ({ 
  children, 
  title, 
  className = '', 
  noPadding = false,
  variant = 'default' 
}) => {
  const variantStyles = {
    default: "bg-cyber-panel border border-cyber-cyan/20 shadow-[0_0_10px_rgba(0,0,0,0.5)]",
    hologram: "bg-cyber-cyan/5 border border-cyber-cyan/30 backdrop-blur-sm shadow-[0_0_15px_rgba(0,243,255,0.05)]",
    flat: "bg-black/40 border border-gray-800"
  };

  return (
    <div className={`relative ${variantStyles[variant]} ${className} group overflow-hidden transition-all duration-500`}>
      {/* Grid Background for Hologram */}
      {variant === 'hologram' && (
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-cyber-grid bg-[length:20px_20px]"></div>
      )}

      {/* Header Bar */}
      {title && (
        <div className="relative flex items-center justify-between bg-black/40 border-b border-cyber-cyan/20 px-4 py-2 z-10">
          <h3 className="text-cyber-cyan font-mono text-sm tracking-widest uppercase truncate flex items-center gap-2">
             <span className="w-1 h-3 bg-cyber-cyan"></span>
             <CyberScrambleText text={title} speed={50} />
          </h3>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-cyber-cyan/50 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-cyber-cyan/30 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-cyber-cyan/10 rounded-full"></div>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className={`${noPadding ? '' : 'p-5'} relative z-10 h-full`}>
        {children}
      </div>

      {/* Tech Corners */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyber-cyan/50 rounded-tl-sm group-hover:border-cyber-cyan transition-colors"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyber-cyan/50 rounded-tr-sm group-hover:border-cyber-cyan transition-colors"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyber-cyan/50 rounded-bl-sm group-hover:border-cyber-cyan transition-colors"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyber-cyan/50 rounded-br-sm group-hover:border-cyber-cyan transition-colors"></div>
    </div>
  );
};

// --- CyberInput ---
interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const CyberInput: React.FC<CyberInputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className="w-full group">
      {label && <label className="block text-cyber-cyan text-[10px] font-mono mb-1 uppercase tracking-wider opacity-80 group-hover:opacity-100 transition-opacity">{label}</label>}
      <div className="relative">
        <input
          className={`w-full bg-black/40 border border-gray-700 focus:border-cyber-cyan text-gray-100 pl-4 pr-4 py-2.5 font-mono text-sm outline-none transition-all placeholder-gray-700 focus:bg-cyber-cyan/5 focus:shadow-[0_0_15px_rgba(0,243,255,0.1)] ${icon ? 'pl-10' : ''} ${className}`}
          {...props}
        />
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-cyber-cyan transition-colors">{icon}</div>}
        {/* Animated bottom line */}
        <div className="absolute bottom-0 left-0 h-[1px] bg-cyber-cyan w-0 group-focus-within:w-full transition-all duration-500"></div>
      </div>
    </div>
  );
};

// --- CyberTextArea ---
interface CyberTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

// Converted to forwardRef to allow cursor manipulation by parent
export const CyberTextArea = forwardRef<HTMLTextAreaElement, CyberTextAreaProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className="w-full h-full group flex flex-col">
        {label && <label className="block text-cyber-cyan text-[10px] font-mono mb-1 uppercase tracking-wider opacity-80">{label}</label>}
        <div className="relative flex-1">
          <div className="absolute inset-0 bg-cyber-grid bg-[length:30px_30px] opacity-0 group-focus-within:opacity-10 transition-opacity pointer-events-none"></div>
          <textarea
            ref={ref}
            className={`w-full h-full bg-black/20 border border-transparent focus:border-cyber-cyan/30 text-gray-300 p-4 font-mono text-sm outline-none resize-none transition-all placeholder-gray-700 focus:bg-black/40 focus:shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] selection:bg-cyber-pink selection:text-white ${className}`}
            {...props}
          />
          {/* Corner Accents */}
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyber-cyan/0 group-focus-within:border-cyber-cyan/50 transition-colors"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyber-cyan/0 group-focus-within:border-cyber-cyan/50 transition-colors"></div>
        </div>
      </div>
    );
  }
);
CyberTextArea.displayName = 'CyberTextArea';

// --- CyberBadge ---
export const CyberBadge: React.FC<{ children: React.ReactNode; color?: 'cyan' | 'pink' | 'yellow'; size?: 'sm' | 'md' }> = ({ children, color = 'cyan', size = 'sm' }) => {
  const colors = {
    cyan: 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5 shadow-[0_0_5px_rgba(0,243,255,0.2)]',
    pink: 'border-cyber-pink text-cyber-pink bg-cyber-pink/5 shadow-[0_0_5px_rgba(255,0,85,0.2)]',
    yellow: 'border-cyber-yellow text-cyber-yellow bg-cyber-yellow/5 shadow-[0_0_5px_rgba(252,238,10,0.2)]',
  };
  const sizes = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };
  return (
    <span className={`inline-block border ${sizes[size]} font-mono font-bold uppercase tracking-wider backdrop-blur-sm ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- CyberTag ---
export const CyberTag: React.FC<{ label: string; onRemove?: () => void }> = ({ label, onRemove }) => {
  return (
    <div className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-sm group hover:border-cyber-cyan hover:bg-cyber-cyan/20 transition-all">
      <span className="text-[10px] font-mono text-cyber-cyan uppercase tracking-wider">#{label}</span>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="hover:text-cyber-pink p-0.5 text-cyber-cyan/50 transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
};
