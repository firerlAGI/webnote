import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews } from '../../contexts/ReviewsContext';
import { Button, Card, Input, Alert } from '../../components/ui';

const ReviewCreate = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    content: '',
    mood: 5,
    achievements: [] as string[],
    improvements: [] as string[],
    plans: [] as string[],
    template_id: undefined as number | undefined,
  });
  const { createReview, isLoading, error, clearError } = useReviews();
  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMoodChange = (value: number) => {
    setFormData((prev) => ({
      ...prev,
      mood: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      const newReview = await createReview(formData);
      navigate(`/reviews/${newReview.id}`);
    } catch (err) {
      console.error('Create review error:', err);
    }
  };

  const handleCancel = () => {
    navigate('/reviews');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <h1 className="text-2xl font-bold mb-6">今日复盘</h1>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="date" className="block text-sm font-medium mb-2">
              日期
            </label>
            <Input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              required
              fullWidth
            />
          </div>

          <div>
            <label htmlFor="mood" className="block text-sm font-medium mb-2">
              心情指数：{formData.mood}
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    formData.mood >= value
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                  onClick={() => handleMoodChange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="achievements"
              className="block text-sm font-medium mb-2"
            >
              今日成就
            </label>
            <textarea
              id="achievements"
              name="achievements"
              value={formData.achievements.join('\n')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  achievements: e.target.value
                    .split('\n')
                    .filter((item) => item.trim()),
                }))
              }
              placeholder="列出今日完成的任务和成就（每行一条）"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white min-h-32"
            />
          </div>

          <div>
            <label
              htmlFor="improvements"
              className="block text-sm font-medium mb-2"
            >
              改进点
            </label>
            <textarea
              id="improvements"
              name="improvements"
              value={formData.improvements.join('\n')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  improvements: e.target.value
                    .split('\n')
                    .filter((item) => item.trim()),
                }))
              }
              placeholder="列出需要改进的地方（每行一条）"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white min-h-32"
            />
          </div>

          <div>
            <label htmlFor="plans" className="block text-sm font-medium mb-2">
              明日计划
            </label>
            <textarea
              id="plans"
              name="plans"
              value={formData.plans.join('\n')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  plans: e.target.value
                    .split('\n')
                    .filter((item) => item.trim()),
                }))
              }
              placeholder="列出明日的计划（每行一条）"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white min-h-32"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              总结
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="总结今日的收获和感悟"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white min-h-40"
              required
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={isLoading}
              disabled={isLoading}
            >
              保存复盘
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ReviewCreate;
