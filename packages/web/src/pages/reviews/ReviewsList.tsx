import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews } from '../../contexts/ReviewsContext';
import { Button, Card, Loader, Alert } from '../../components/ui';
import { formatDate } from '@webnote/shared/utils';

const ReviewsList = () => {
  const { reviews, isLoading, error, fetchReviews, stats, fetchStats } =
    useReviews();
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      await fetchStats();
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };

  const handleCreateReview = () => {
    navigate('/reviews/new');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
        <Button variant="primary" onClick={fetchReviews}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold mb-1">我的复盘</h1>
          <p className="text-gray-600 dark:text-gray-400">
            共 {reviews.length} 条复盘
          </p>
        </div>
        <Button variant="primary" onClick={handleCreateReview}>
          今日复盘
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
              复盘统计
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              总复盘天数：{stats.total}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              平均心情指数：{stats.averageMood.toFixed(1)}/10
            </p>
          </Card>
        </div>
      )}

      {reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <svg
            className="h-16 w-16 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h2 className="text-xl font-semibold mb-2">暂无复盘</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            开始记录你的第一次复盘吧
          </p>
          <Button variant="primary" onClick={handleCreateReview}>
            今日复盘
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/reviews/${review.id}`)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold">
                    {formatDate(review.date)}
                  </h3>
                  <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-3 py-1 rounded-full text-sm">
                    心情 {review.mood}/10
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {review.content.substring(0, 150)}
                </p>
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    成就：{review.achievements?.length || 0} | 改进：
                    {review.improvements?.length || 0}
                  </span>
                  <span>{formatDate(review.updated_at)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewsList;
