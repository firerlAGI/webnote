import { useEffect, useRef } from 'react';

interface UseAutoSaveOptions {
  value: any;
  onSave: () => Promise<void> | void;
  delay?: number;
  enabled?: boolean;
}

export const useAutoSave = ({
  value,
  onSave,
  delay = 3000,
  enabled = true,
}: UseAutoSaveOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    // 如果值没有变化，不触发保存
    if (previousValueRef.current === value) {
      return;
    }

    // 如果自动保存被禁用，不触发保存
    if (!enabled) {
      previousValueRef.current = value;
      return;
    }

    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 设置新的定时器
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave();
        previousValueRef.current = value;
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, delay);

    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, onSave, delay, enabled]);

  // 组件卸载时执行最后一次保存
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // 如果值有变化，执行最后一次保存
      if (enabled && previousValueRef.current !== value) {
        onSave();
      }
    };
  }, [value, onSave, enabled]);
};

export default useAutoSave;
