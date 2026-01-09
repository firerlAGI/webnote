import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { Review, ReviewStats } from '@webnote/shared/types';
import api from '@webnote/shared/api';

/**
 * ReviewsContextType 定义了评论上下文的类型接口
 * @property {Review[]} reviews - 评论列表
 * @property {Review | null} currentReview - 当前选中的评论
 * @property {ReviewStats | null} stats - 评论统计信息
 * @property {boolean} isLoading - 是否正在加载
 * @property {string | null} error - 错误信息
 * @property {Function} fetchReviews - 获取评论列表函数
 * @property {Function} getReviewById - 根据ID获取评论函数
 * @property {Function} createReview - 创建评论函数
 * @property {Function} updateReview - 更新评论函数
 * @property {Function} deleteReview - 删除评论函数
 * @property {Function} fetchStats - 获取评论统计信息函数
 * @property {Function} clearError - 清除错误函数
 */
interface ReviewsContextType {
  reviews: Review[];
  currentReview: Review | null;
  stats: ReviewStats | null;
  isLoading: boolean;
  error: string | null;
  fetchReviews: () => Promise<void>;
  getReviewById: (id: number) => Promise<Review | null>;
  createReview: (
    review: Omit<Review, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => Promise<Review>;
  updateReview: (id: number, review: Partial<Review>) => Promise<Review>;
  deleteReview: (id: number) => Promise<void>;
  fetchStats: () => Promise<void>;
  clearError: () => void;
}

// 创建评论上下文
const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

/**
 * ReviewsProvider 组件提供评论状态和方法
 * @param {Object} props - 组件属性
 * @param {ReactNode} props.children - 子组件
 */
export const ReviewsProvider = ({ children }: { children: ReactNode }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取评论列表函数
   */
  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Review[]>('/reviews');
      if (response.success) {
        setReviews(response.data);
      } else {
        // 处理API返回的错误
        setError(response.message || 'Failed to fetch reviews: Invalid response');
      }
    } catch (err: any) {
      // 处理网络错误或其他异常
      console.error('Fetch reviews error:', err);
      setError(err.message || 'Failed to fetch reviews: Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 根据ID获取评论函数
   * @param {number} id - 评论ID
   * @returns {Promise<Review | null>} 评论对象或null
   */
  const getReviewById = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Review>(`/reviews/${id}`);
      if (response.success) {
        setCurrentReview(response.data);
        return response.data;
      } else {
        // 处理API返回的错误
        setError(response.message || 'Failed to fetch review: Invalid response');
        return null;
      }
    } catch (err: any) {
      // 处理网络错误或其他异常
      console.error('Get review by ID error:', err);
      setError(err.message || 'Failed to fetch review: Network error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 创建评论函数
   * @param {Omit<Review, 'id' | 'user_id' | 'created_at' | 'updated_at'>} reviewData - 评论数据
   * @returns {Promise<Review>} 创建的评论对象
   */
  const createReview = useCallback(
    async (
      reviewData: Omit<Review, 'id' | 'user_id' | 'created_at' | 'updated_at'>
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.post<Review>('/reviews', reviewData);
        if (response.success) {
          setReviews((prev) => [...prev, response.data]);
          return response.data;
        } else {
          // 处理API返回的错误
          const errorMessage =
            response.message || 'Failed to create review: Invalid response';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        console.error('Create review error:', err);
        const errorMessage =
          err.message || 'Failed to create review: Network error';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * 更新评论函数
   * @param {number} id - 评论ID
   * @param {Partial<Review>} reviewData - 评论更新数据
   * @returns {Promise<Review>} 更新后的评论对象
   */
  const updateReview = useCallback(
    async (id: number, reviewData: Partial<Review>) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.put<Review>(`/reviews/${id}`, reviewData);
        if (response.success) {
          setReviews((prev) =>
            prev.map((review) => (review.id === id ? response.data : review))
          );
          if (currentReview?.id === id) {
            setCurrentReview(response.data);
          }
          return response.data;
        } else {
          // 处理API返回的错误
          const errorMessage =
            response.message || 'Failed to update review: Invalid response';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        console.error('Update review error:', err);
        const errorMessage =
          err.message || 'Failed to update review: Network error';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentReview]
  );

  /**
   * 删除评论函数
   * @param {number} id - 评论ID
   */
  const deleteReview = useCallback(
    async (id: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.delete<{ success: boolean }>(
          `/reviews/${id}`
        );
        if (response.success) {
          setReviews((prev) => prev.filter((review) => review.id !== id));
          if (currentReview?.id === id) {
            setCurrentReview(null);
          }
        } else {
          // 处理API返回的错误
          setError(
            response.message || 'Failed to delete review: Invalid response'
          );
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        console.error('Delete review error:', err);
        setError(err.message || 'Failed to delete review: Network error');
      } finally {
        setIsLoading(false);
      }
    },
    [currentReview]
  );

  /**
   * 获取评论统计信息函数
   */
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<ReviewStats>('/reviews/stats');
      if (response.success) {
        setStats(response.data);
      } else {
        // 处理API返回的错误
        setError(
          response.message || 'Failed to fetch review stats: Invalid response'
        );
      }
    } catch (err: any) {
      // 处理网络错误或其他异常
      console.error('Fetch review stats error:', err);
      setError(err.message || 'Failed to fetch review stats: Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 清除错误函数
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ReviewsContext.Provider
      value={{
        reviews,
        currentReview,
        stats,
        isLoading,
        error,
        fetchReviews,
        getReviewById,
        createReview,
        updateReview,
        deleteReview,
        fetchStats,
        clearError,
      }}
    >
      {children}
    </ReviewsContext.Provider>
  );
};

/**
 * useReviews 钩子用于在组件中访问评论上下文
 * @returns {ReviewsContextType} 评论上下文
 * @throws {Error} 如果在ReviewsProvider之外使用
 */
export const useReviews = () => {
  const context = useContext(ReviewsContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }
  return context;
};
