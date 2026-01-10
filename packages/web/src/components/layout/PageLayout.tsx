import { ReactNode, HTMLAttributes } from 'react';

/**
 * PageLayout组件接口
 */
export interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 页面内容
   */
  children: ReactNode;
  /**
   * 页面标题
   */
  title?: string;
  /**
   * 页面副标题
   */
  subtitle?: string;
  /**
   * 页面头部操作区域
   */
  headerActions?: ReactNode;
  /**
   * 是否禁用底部导航栏间距（移动端）
   */
  disableBottomNav?: boolean;
  /**
   * 是否使用全屏布局
   */
  fullscreen?: boolean;
  /**
   * 自定义容器类名
   */
  containerClassName?: string;
  /**
   * 最大宽度
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
}

/**
 * PageLayout组件
 * 统一的页面布局模板，提供一致的页面结构和样式
 *
 * @example
 * ```tsx
 * <PageLayout
 *   title="我的笔记"
 *   subtitle="共 10 条笔记"
 *   headerActions={<Button>创建笔记</Button>}
 * >
 *   <NotesList />
 * </PageLayout>
 * ```
 */
const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  disableBottomNav = false,
  fullscreen = false,
  containerClassName = '',
  maxWidth = '7xl',
  className = '',
  ...props
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div
      className={`min-h-screen bg-background pb-16 md:pb-0 ${disableBottomNav ? '' : 'pb-16 md:pb-0'} ${className}`}
      {...props}
    >
      <div className={`container mx-auto px-4 py-6 ${maxWidthClasses[maxWidth]} ${containerClassName}`}>
        {/* 页面头部 */}
        {(title || subtitle || headerActions) && (
          <div className="mb-6 md:mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div>
                {title && (
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-gray-50">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-400">
                    {subtitle}
                  </p>
                )}
              </div>
              {headerActions && (
                <div className="flex items-center space-x-2 md:space-x-4">
                  {headerActions}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 页面内容 */}
        <div className="animate-fade-in">{children}</div>
      </div>
    </div>
  );
};

export default PageLayout;
