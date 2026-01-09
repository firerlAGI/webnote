import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { Button, Card, Input, Alert } from '../../components/ui';

const NoteCreate = () => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    folder_id: undefined as number | undefined,
    is_pinned: false,
  });
  const { createNote, isLoading, error, clearError } = useNotes();
  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const target = e.target as HTMLInputElement;
    const checked = target.type === 'checkbox' ? target.checked : false;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      const newNote = await createNote(formData);
      navigate(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Create note error:', err);
    }
  };

  const handleCancel = () => {
    navigate('/notes');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <h1 className="text-2xl font-bold mb-6">创建笔记</h1>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              标题
            </label>
            <Input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="输入笔记标题"
              required
              fullWidth
              size="lg"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              内容
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="开始编写笔记内容...（支持 Markdown 格式）"
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white min-h-64"
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_pinned"
              name="is_pinned"
              type="checkbox"
              checked={formData.is_pinned}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label
              htmlFor="is_pinned"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              置顶笔记
            </label>
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
              创建笔记
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NoteCreate;
