import { ReactNode, useState } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'content'
> {
  children: ReactNode;
  content: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  enabled?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 300,
  enabled = true,
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (enabled) {
      const id = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      setTimeoutId(id);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
      {isVisible && enabled && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-lg">
            {content}
          </div>
          <div
            className={`absolute ${
              position === 'top'
                ? 'bottom-0 left-1/2 transform -translate-x-1/2 rotate-180'
                : position === 'bottom'
                  ? 'top-0 left-1/2 transform -translate-x-1/2'
                  : position === 'left'
                    ? 'right-0 top-1/2 transform -translate-y-1/2 rotate-90'
                    : 'left-0 top-1/2 transform -translate-y-1/2 -rotate-90'
            }`}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 0L4 4L8 0V8H0V0Z"
                fill="gray"
                fillOpacity="0.9"
              ></path>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
