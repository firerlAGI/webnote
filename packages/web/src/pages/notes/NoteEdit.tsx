import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { Button, Card, Input, Alert, Loader } from '../../components/ui';
import { MarkdownEditor } from '../../components/markdown';
import { useAutoSave } from '../../hooks/useAutoSave';

const NoteEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getNoteById, updateNote, isLoading, error, clearError } = useNotes();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    folder_id: undefined as number | undefined,
    is_pinned: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (id) {
      loadNote();
    }
  }, [id]);

  const loadNote = async () => {
    if (id) {
      const note = await getNoteById(Number(id));
      if (note) {
        setFormData({
          title: note.title,
          content: note.content,
          folder_id: note.folder_id,
          is_pinned: note.is_pinned,
        });
        setLastSavedAt(new Date());
      }
    }
  };

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

  const handleContentChange = (content: string) => {
    setFormData((prev) => ({ ...prev, content }));
  };

  // 手动保存
  const handleManualSave = useCallback(async () => {
    if (!id || isSubmitting) return;

    setIsSubmitting(true);
    clearError();

    try {
      await updateNote(Number(id), formData);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Save note error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [id, formData, isSubmitting, clearError, updateNote]);

  // 自动保存
  const handleAutoSave = useCallback(async () => {
    if (!id || isAutoSaving || isSubmitting) return;

    setIsAutoSaving(true);

    try {
      await updateNote(Number(id), formData);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Auto save error:', err);
    } finally {
      setIsAutoSaving(false);
    }
  }, [id, formData, isAutoSaving, isSubmitting, updateNote]);

  // 使用自动保存钩子
  useAutoSave({
    value: JSON.stringify(formData),
    onSave: handleAutoSave,
    delay: 3000,
    enabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      if (id) {
        const updatedNote = await updateNote(Number(id), formData);
        setLastSavedAt(new Date());
        navigate(`/notes/${updatedNote.id}`);
      }
    } catch (err) {
      console.error('Update note error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (id) {
      navigate(`/notes/${id}`);
    } else {
      navigate('/notes');
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
      <div className="max-w-4xl mx-auto">
        <Card className="p-6">
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
          <Button variant="primary" onClick={loadNote}>
            重试
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Card className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">编辑笔记</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            {isAutoSaving ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                自动保存中...
              </span>
            ) : lastSavedAt ? (
              <span>已保存于 {lastSavedAt.toLocaleTimeString()}</span>
            ) : (
              <span>未保存</span>
            )}
          </div>
        </div>

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
              内容 (支持 Markdown)
            </label>
            <MarkdownEditor
              value={formData.content}
              onChange={handleContentChange}
              onSave={handleManualSave}
              placeholder="开始编写笔记内容...（支持 Markdown 格式）"
              minHeight="400px"
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

          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              快捷键: <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl+S</kbd> 保存
            </div>
            <div className="flex space-x-4">
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                完成编辑
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NoteEdit;
