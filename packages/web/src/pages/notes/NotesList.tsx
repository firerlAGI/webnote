import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../../contexts/NotesContext';
import { Button, Card, Input, Loader, Alert } from '../../components/ui';
import { formatDate } from '@webnote/shared/utils';

const NotesList = () => {
  const { notes, isLoading, error, fetchNotes, setFilters, filters } =
    useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      setFilters({
        ...filters,
        search: query,
      });
    },
    [filters, setFilters]
  );

  const handleCreateNote = useCallback(() => {
    navigate('/notes/new');
  }, [navigate]);

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
        <Button variant="primary" onClick={fetchNotes}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold mb-1">我的笔记</h1>
          <p className="text-gray-600 dark:text-gray-400">
            共 {notes.length} 条笔记
          </p>
        </div>
        <div className="flex space-x-4">
          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <Button variant="primary" onClick={handleCreateNote}>
            创建笔记
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <h2 className="text-xl font-semibold mb-2">暂无笔记</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            开始创建你的第一条笔记吧
          </p>
          <Button variant="primary" onClick={handleCreateNote}>
            创建笔记
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/notes/${note.id}`)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold truncate">
                    {note.title}
                  </h3>
                  {note.is_pinned && (
                    <svg
                      className="h-5 w-5 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {note.content.replace(/[#*`]/g, '').substring(0, 100)}
                </p>
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatDate(note.updated_at)}</span>
                  {note.folder && (
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {note.folder.name}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(NotesList);
