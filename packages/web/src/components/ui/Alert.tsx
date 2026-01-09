import React from 'react';

/**
 * Alert 组件的变体类型
 */
export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * Alert 组件的属性接口
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 警告变体类型
   */
  variant?: AlertVariant;
  /**
   * 警告标题
   */
  title?: string;
  /**
   * 警告内容
   */
  children: React.ReactNode;
  /**
   * 是否可关闭
   */
  dismissible?: boolean;
  /**
   * 关闭回调函数
   */
  onDismiss?: () => void;
  /**
   * 错误详情信息
   */
  details?: string | string[];
  /**
   * 是否显示图标
   */
  showIcon?: boolean;
}

/**
 * Alert 组件用于显示各种类型的通知和错误信息
 */
const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = '',
  details,
  showIcon = true,
  ...props
}) => {
  const baseClasses = 'relative rounded-md p-4 flex items-start';

  const variantClasses = {
    success: 'bg-green-50 text-green-800 border border-green-200',
    error: 'bg-red-50 text-red-800 border border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border border-blue-200',
  };

  const iconClasses = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  const allClasses = `${baseClasses} ${variantClasses[variant]} ${className}`;

  /**
   * 渲染图标
   */
  const renderIcon = () => {
    if (!showIcon) return null;

    switch (variant) {
      case 'success':
        return (
          <svg
            className={`h-5 w-5 mr-3 flex-shrink-0 ${iconClasses[variant]}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            className={`h-5 w-5 mr-3 flex-shrink-0 ${iconClasses[variant]}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className={`h-5 w-5 mr-3 flex-shrink-0 ${iconClasses[variant]}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className={`h-5 w-5 mr-3 flex-shrink-0 ${iconClasses[variant]}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  /**
   * 渲染错误详情
   */
  const renderDetails = () => {
    if (!details) return null;

    return (
      <div className="mt-2 text-sm opacity-80">
        {Array.isArray(details) ? (
          <ul className="list-disc pl-5 space-y-1">
            {details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        ) : (
          <p>{details}</p>
        )}
      </div>
    );
  };

  return (
    <div className={allClasses} {...props}>
      {renderIcon()}
      <div className="flex-1">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div>{children}</div>
        {renderDetails()}
      </div>
      {dismissible && onDismiss && (
        <button
          type="button"
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500 focus:outline-none"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;
