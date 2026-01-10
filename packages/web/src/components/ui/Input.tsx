import { ReactNode } from 'react';

export type InputSize = 'small' | 'medium' | 'large' | 'lg';

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size'
> {
  size?: InputSize;
  fullWidth?: boolean;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input: React.FC<InputProps> = ({
  size = 'medium',
  fullWidth = false,
  error,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const baseClasses =
    'block w-full rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation';

  const sizeClasses = {
    small: 'px-3 py-2 text-sm min-h-[36px]',
    medium: 'px-4 py-2 text-base min-h-[44px]',
    large: 'px-6 py-3 text-lg min-h-[48px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  };

  const widthClasses = fullWidth ? 'w-full' : '';

  const errorClasses = error
    ? 'border-red-500'
    : 'border-gray-300 focus:border-blue-500';

  const allClasses = `${baseClasses} ${sizeClasses[size]} ${widthClasses} ${errorClasses} ${className}`;

  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        className={`${allClasses} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''}`}
        {...props}
      />
      {rightIcon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {rightIcon}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default Input;
