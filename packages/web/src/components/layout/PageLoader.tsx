import { ReactNode, HTMLAttributes } from 'react';
import { Loader } from '../ui';

/**
 * PageLoader组件接口
 */
export interface PageLoaderProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 加载文本
   */
  text?: string;
  /**
   * 加载器大小
   */
  size?: 'small' | 'medium' | 'large' | 'lg';
  /**
   * 是否全屏加载
   */
  fullscreen?: boolean;
  /**
   * 自定义内容
   */
  children?: ReactNode;
  /**
   * 最小高度
   */
  minHeight?: string;
}

/**
 * PageLoader组件
 * 统一的页面加载状态组件，用于显示加载中的状态
 *
 * @example
 * ```tsx
 * // 基础用法
 * <PageLoader text="正在加载笔记..." />
 *
 * // 全屏加载
 * <PageLoader fullscreen text="请稍候..." />
 *
 * // 自定义内容
 * <PageLoader>
 *   <div className="text-center">
 *     <p>正在同步数据...</p>
 *     <progress value={50} max={100} />
 *   </div>
 * </PageLoader>
 * ```
 */
const PageLoader: React.FC<PageLoaderProps> = ({
  text,
  size = 'lg',
  fullscreen = false,
  children,
  minHeight = 'min-h-64',
  className = '',
  ...props
}) => {
  const content = (
    <div
      className={`flex flex-col items-center justify-center ${minHeight} ${className}`}
      {...props}
    >
      {children || (
        <>
          <Loader size={size} text={text} variant="primary" />
          {text && !children && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{text}</p>}
        </>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[var(--z-index-max)] flex items-center justify-center bg-background bg-opacity-80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export default PageLoader;
