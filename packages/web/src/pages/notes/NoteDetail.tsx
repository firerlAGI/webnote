import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { Button, Card, Alert, Loader, Modal } from '../../components/ui';
import { formatDate } from '@webnote/shared/utils';

const NoteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getNoteById, deleteNote, isLoading, error, clearError } = useNotes();
  const [note, setNote] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadNote();
    }
  }, [id]);

  const loadNote = async () => {
    if (id) {
      const fetchedNote = await getNoteById(Number(id));
      setNote(fetchedNote);
    }
  };

  const handleDelete = async () => {
    if (id) {
      setIsDeleting(true);
      clearError();
      try {
        await deleteNote(Number(id));
        setShowDeleteModal(false);
        navigate('/notes');
      } catch (err) {
        console.error('Delete error:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleEdit = () => {
    if (id) {
      navigate(`/notes/edit/${id}`);
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
        <Button variant="primary" onClick={loadNote}>
          重试
        </Button>
      </div>
    );
  }

  if (!note) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">笔记不存在</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          该笔记可能已被删除或不存在
        </p>
        <Button variant="primary" asChild>
          <Link to="/notes">返回笔记列表</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold mb-1">{note.title}</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{formatDate(note.updated_at)}</span>
            {note.folder && (
              <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {note.folder.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-4">
          <Button variant="outline" onClick={handleEdit}>
            编辑
          </Button>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            删除
          </Button>
        </div>
      </div>

      <Card className="p-8">
        <div className="prose dark:prose-invert max-w-none">{note.content}</div>
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除笔记"
      >
        <div className="space-y-4">
          <p>确定要删除笔记 "{note.title}" 吗？此操作不可撤销。</p>
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={isDeleting}
              disabled={isDeleting}
            >
              删除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(NoteDetail);
