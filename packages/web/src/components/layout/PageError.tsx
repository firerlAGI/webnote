import { ReactNode, HTMLAttributes } from 'react';
import { Alert, Button } from '../ui';

/**
 * PageError组件接口
 */
export interface PageErrorProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 错误标题
   */
  title?: string;
  /**
   * 错误消息
   */
  error: string | Error;
  /**
   * 错误详情
   */
  details?: string | string[];
  /**
   * 重试按钮文本
   */
  retryText?: string;
  /**
   * 重试按钮回调
   */
  onRetry?: () => void;
  /**
   * 自定义操作按钮
   */
  actions?: ReactNode;
  /**
   * 是否显示返回首页按钮
   */
  showHomeButton?: boolean;
}

/**
 * PageError组件
 * 统一的页面错误状态组件，用于显示加载错误或操作失败
 *
 * @example
 * ```tsx
 * // 基础用法
 * <PageError error="加载笔记失败" onRetry={retryFunction} />
 *
 * // 完整用法
 * <PageError
 *   title="出错了"
 *   error="无法连接到服务器"
 *   details={["网络错误", "请检查您的网络连接"]}
 *   onRetry={retryFunction}
 *   showHomeButton
 * />
 * ```
 */
const PageError: React.FC<PageErrorProps> = ({
  title = '出错了',
  error,
  details,
  retryText = '重试',
  onRetry,
  actions,
  showHomeButton = false,
  className = '',
  ...props
}) => {
  // 将Error对象转换为字符串
  const errorMessage = error instanceof Error ? error.message : error;
  const errorDetails = error instanceof Error ? error.stack : details;

  return (
    <div className={`max-w-md mx-auto py-12 ${className}`} {...props}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-10 dark:bg-error-950 mb-4">
          <svg
            className="w-8 h-8 text-error-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">
          {title}
        </h2>
      </div>

      <Alert variant="error" className="mb-6" showIcon>
        <div className="font-medium mb-1">{errorMessage}</div>
        {errorDetails && (
          <div className="mt-2 text-sm">
            {Array.isArray(errorDetails) ? (
              <ul className="list-disc pl-5 space-y-1">
                {errorDetails.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">{errorDetails}</p>
            )}
          </div>
        )}
      </Alert>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {actions || (
          <>
            {onRetry && (
              <Button variant="primary" onClick={onRetry} className="w-full sm:w-auto">
                {retryText}
              </Button>
            )}
            {showHomeButton && (
              <Button variant="outline" onClick={() => (window.location.href = '/')} className="w-full sm:w-auto">
                返回首页
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PageError;
