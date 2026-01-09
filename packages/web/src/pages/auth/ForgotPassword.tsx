import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@webnote/shared/api';
import { Button, Input, Card, Alert } from '../../components/ui';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ message: string }>(
        '/auth/forgot-password',
        { email: formData.email }
      );

      if (response.success) {
        setSuccess('重置密码链接已发送到您的邮箱');
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || '发送重置链接失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">忘记密码</h1>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              邮箱
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="请输入您的邮箱"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isSubmitting}
          >
            发送重置链接
          </Button>

          <div className="text-center mt-4">
            <span className="text-sm">
              记起密码了？{' '}
              <Link
                to="/auth/login"
                className="text-blue-600 hover:underline font-medium"
              >
                立即登录
              </Link>
            </span>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPassword;
