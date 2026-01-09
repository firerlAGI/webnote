import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useReviews } from '../../contexts/ReviewsContext';
import { Button, Card, Alert, Loader } from '../../components/ui';
import { formatDate } from '@webnote/shared/utils';

const ReviewDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getReviewById, deleteReview, isLoading, error } = useReviews();
  const [review, setReview] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadReview();
    }
  }, [id]);

  const loadReview = async () => {
    if (id) {
      const fetchedReview = await getReviewById(Number(id));
      setReview(fetchedReview);
    }
  };

  const handleDelete = async () => {
    if (id) {
      try {
        await deleteReview(Number(id));
        navigate('/reviews');
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const handleEdit = () => {
    if (id) {
      navigate(`/reviews/edit/${id}`);
    }
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
        <Button variant="primary" onClick={loadReview}>
          重试
        </Button>
      </div>
    );
  }

  if (!review) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">复盘不存在</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          该复盘可能已被删除或不存在
        </p>
        <Button variant="primary" asChild>
          <Link to="/reviews">返回复盘列表</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            复盘 - {formatDate(review.date)}
          </h1>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>心情指数：{review.mood}/10</span>
            <span>{formatDate(review.updated_at)}</span>
          </div>
        </div>
        <div className="flex space-x-4">
          <Button variant="outline" onClick={handleEdit}>
            编辑
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3 text-green-600 dark:text-green-400">
            今日成就
          </h3>
          <ul className="space-y-2">
            {review.achievements?.map((achievement: string, index: number) => (
              <li key={index} className="flex items-start">
                <svg
                  className="h-5 w-5 text-green-500 mr-2 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{achievement}</span>
              </li>
            )) || <li className="text-gray-500 dark:text-gray-400">无记录</li>}
          </ul>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3 text-yellow-600 dark:text-yellow-400">
            改进点
          </h3>
          <ul className="space-y-2">
            {review.improvements?.map((improvement: string, index: number) => (
              <li key={index} className="flex items-start">
                <svg
                  className="h-5 w-5 text-yellow-500 mr-2 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{improvement}</span>
              </li>
            )) || <li className="text-gray-500 dark:text-gray-400">无记录</li>}
          </ul>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">
            明日计划
          </h3>
          <ul className="space-y-2">
            {review.plans?.map((plan: string, index: number) => (
              <li key={index} className="flex items-start">
                <svg
                  className="h-5 w-5 text-blue-500 mr-2 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{plan}</span>
              </li>
            )) || <li className="text-gray-500 dark:text-gray-400">无记录</li>}
          </ul>
        </Card>
      </div>

      <Card className="p-8">
        <h3 className="text-lg font-semibold mb-4">总结</h3>
        <div className="prose dark:prose-invert max-w-none">
          {review.content}
        </div>
      </Card>
    </div>
  );
};

export default ReviewDetail;
