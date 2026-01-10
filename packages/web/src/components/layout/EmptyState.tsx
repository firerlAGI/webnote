import { ReactNode, HTMLAttributes } from 'react';
import { Button } from '../ui';

/**
 * EmptyState组件接口
 */
export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 空状态图标
   */
  icon?: ReactNode;
  /**
   * 空状态标题
   */
  title?: string;
  /**
   * 空状态描述
   */
  description?: string;
  /**
   * 操作按钮文本
   */
  actionText?: string;
  /**
   * 操作按钮回调
   */
  onAction?: () => void;
  /**
   * 自定义操作区域
   */
  actions?: ReactNode;
  /**
   * 是否在卡片内
   */
  card?: boolean;
}

/**
 * EmptyState组件
 * 统一的空状态组件，用于显示没有数据的状态
 *
 * @example
 * ```tsx
 * // 基础用法
 * <EmptyState
 *   title="暂无笔记"
 *   description="开始创建你的第一条笔记吧"
 *   actionText="创建笔记"
 *   onAction={handleCreate}
 * />
 *
 * // 使用卡片样式
 * <EmptyState
 *   card
 *   title="暂无复盘"
 *   description="还没有创建任何复盘记录"
 *   actionText="创建复盘"
 *   onAction={handleCreate}
 * />
 *
 * // 自定义图标
 * <EmptyState
 *   icon={<CustomIcon />}
 *   title="暂无数据"
 *   description="这里什么都没有"
 * />
 * ```
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = '暂无数据',
  description,
  actionText,
  onAction,
  actions,
  card = true,
  className = '',
  ...props
}) => {
  // 默认图标
  const defaultIcon = (
    <svg
      className="w-16 h-16 text-gray-400 dark:text-gray-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  const content = (
    <div className={`text-center p-6 md:p-8 ${className}`} {...props}>
      {/* 图标 */}
      {icon || defaultIcon}

      {/* 标题 */}
      <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
        {title}
      </h3>

      {/* 描述 */}
      {description && (
        <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          {description}
        </p>
      )}

      {/* 操作区域 */}
      {(actions || (actionText && onAction)) && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {actions || (
            <Button variant="primary" onClick={onAction} className="w-full sm:w-auto">
              {actionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (card) {
    return (
      <div className="bg-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {content}
      </div>
    );
  }

  return content;
};

export default EmptyState;
