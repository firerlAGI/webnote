import React from 'react';

export type LoaderSize = 'small' | 'medium' | 'large' | 'lg';
export type LoaderVariant = 'primary' | 'secondary' | 'white';

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: LoaderSize;
  variant?: LoaderVariant;
  fullWidth?: boolean;
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({
  size = 'medium',
  variant = 'primary',
  fullWidth = false,
  text,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    lg: 'h-12 w-12',
  };

  const variantClasses = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent',
  };

  const widthClasses = fullWidth ? 'flex justify-center w-full' : '';

  return (
    <div
      className={`inline-flex items-center ${widthClasses} ${className}`}
      {...props}
    >
      <svg
        className={`animate-spin rounded-full ${sizeClasses[size]} ${variantClasses[variant]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {text && <span className="ml-2 text-sm">{text}</span>}
    </div>
  );
};

export default Loader;
