import React, { useState, useEffect } from 'react';
import { CyberCard, CyberButton, CyberBadge } from '../components/CyberUI';
import { Note, Folder } from '../types';
import { Folder as FolderIcon, Search, Save, Plus, Trash2, Pin, Database } from 'lucide-react';
import { notesAPI, foldersAPI } from '../api';

const NotesPage: React.FC = () => {
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载笔记列表
  useEffect(() => {
    loadNotes();
    loadFolders();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await notesAPI.getAll();
      if (response.data.success) {
        const notesData = response.data.data.notes || response.data.data || [];
        setNotes(notesData);
        if (notesData.length > 0 && !selectedNoteId) {
          setSelectedNoteId(notesData[0].id);
        }
      } else {
        // 使用Mock数据作为fallback
        const mockNotes: Note[] = [
          {
            id: 1,
            user_id: 1,
            title: '欢迎使用 WebNote',
            content: '这是一个示例笔记。\n\n# 功能介绍\n- 笔记管理\n- 每日复盘\n- 快速搜索\n\n点击右上角的编辑按钮开始编辑这条笔记。',
            is_pinned: true,
            folder_id: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_accessed_at: new Date().toISOString()
          },
          {
            id: 2,
            user_id: 1,
            title: '项目开发计划',
            content: '## 待办事项\n- [x] 完成前后端结合\n- [x] 集成认证流程\n- [ ] 添加单元测试\n- [ ] 部署到生产环境\n\n## 备注\n注意时间节点和依赖关系。',
            is_pinned: false,
            folder_id: 2,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            updated_at: new Date(Date.now() - 86400000).toISOString(),
            last_accessed_at: new Date().toISOString()
          },
          {
            id: 3,
            user_id: 1,
            title: '技术笔记：React Hooks',
            content: '## useState\n用于管理组件状态。\n\n## useEffect\n用于处理副作用。\n\n## useCallback\n优化回调函数性能。\n\n## useMemo\n缓存计算结果。',
            is_pinned: false,
            folder_id: 1,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            updated_at: new Date(Date.now() - 172800000).toISOString(),
            last_accessed_at: new Date().toISOString()
          }
        ];
        setNotes(mockNotes);
        if (!selectedNoteId) {
          setSelectedNoteId(mockNotes[0].id);
        }
        console.warn('API调用失败，使用Mock数据');
      }
    } catch (err: any) {
      console.error('Failed to load notes:', err);
      // 使用Mock数据作为fallback
      const mockNotes: Note[] = [
        {
          id: 1,
          user_id: 1,
          title: '欢迎使用 WebNote',
          content: '这是一个示例笔记。\n\n# 功能介绍\n- 笔记管理\n- 每日复盘\n- 快速搜索\n\n点击右上角的编辑按钮开始编辑这条笔记。',
          is_pinned: true,
          folder_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString()
        }
      ];
      setNotes(mockNotes);
      if (!selectedNoteId) {
        setSelectedNoteId(mockNotes[0].id);
      }
      setError(err.response?.data?.error || 'API连接失败，使用Mock数据');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await foldersAPI.getAll();
      if (response.data.success) {
        setFolders(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load folders:', err);
      // 使用Mock数据作为fallback
      const mockFolders: Folder[] = [
        {
          id: 1,
          user_id: 1,
          name: '全部笔记',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          user_id: 1,
          name: '工作',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 3,
          user_id: 1,
          name: '学习',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setFolders(mockFolders);
    }
  };

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // 保存笔记
  const handleSave = async () => {
    if (!selectedNote) return;
    
    try {
      setLoading(true);
      await notesAPI.update(selectedNote.id, {
        title: selectedNote.title,
        content: selectedNote.content,
        is_pinned: selectedNote.is_pinned,
        folder_id: selectedNote.folder_id,
      });
      setIsEditing(false);
      await loadNotes(); // 重新加载数据
    } catch (err: any) {
      console.error('Failed to save note:', err);
      setError(err.response?.data?.error || '保存失败');
      setLoading(false);
    }
  };

  // 删除笔记
  const handleDelete = async (noteId: number) => {
    if (!confirm('确定要删除这条笔记吗？')) return;
    
    try {
      setLoading(true);
      await notesAPI.delete(noteId);
      setSelectedNoteId(null);
      await loadNotes();
    } catch (err: any) {
      console.error('Failed to delete note:', err);
      setError(err.response?.data?.error || '删除失败');
      setLoading(false);
    }
  };

  // 创建新笔记
  const handleCreate = async () => {
    try {
      setLoading(true);
      const response = await notesAPI.create({
        title: '新笔记',
        content: '',
        is_pinned: false,
      });
      if (response.data.success) {
        await loadNotes();
        setSelectedNoteId(response.data.data.id);
        setIsEditing(true);
      }
    } catch (err: any) {
      console.error('Failed to create note:', err);
      setError(err.response?.data?.error || '创建失败');
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 font-mono">加载中...</div>
      </div>
    );
  }

  if (error && notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 font-mono">{error}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-100px)]">
      
      {/* Sidebar: Folders & List */}
      <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-4 h-full">
        {/* Search */}
        <CyberCard noPadding className="flex items-center px-3 py-2">
          <Search className="text-gray-500 mr-2" size={18} />
          <input 
            type="text" 
            placeholder="检索数据库..." 
            className="bg-transparent border-none outline-none text-cyber-cyan placeholder-gray-600 font-mono w-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CyberCard>

        {/* Folders (Horizontal Scroller for this layout) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {folders.map(f => (
            <button key={f.id} className="flex items-center gap-2 px-3 py-1 border border-gray-800 bg-cyber-dark hover:border-cyber-cyan/50 rounded-sm text-xs font-mono text-gray-300 whitespace-nowrap transition-all">
              <FolderIcon size={12} className="text-cyber-yellow" />
              {f.name}
            </button>
          ))}
        </div>

        {/* Note List */}
        <CyberCard className="flex-1 overflow-hidden flex flex-col" noPadding>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`p-3 border-l-2 cursor-pointer transition-all ${
                  selectedNoteId === note.id 
                    ? 'border-cyber-cyan bg-cyber-cyan/10' 
                    : 'border-transparent hover:bg-white/5'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <h4 className={`font-mono font-bold text-sm truncate ${selectedNoteId === note.id ? 'text-cyber-cyan' : 'text-gray-300'}`}>
                    {note.title}
                  </h4>
                  {note.is_pinned && <Pin size={12} className="text-cyber-pink" />}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 font-sans">{note.content}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800">
             <CyberButton className="w-full text-sm" onClick={handleCreate}>
               <Plus size={16} /> 新建条目
             </CyberButton>
          </div>
        </CyberCard>
      </div>

      {/* Main Editor */}
      <div className="md:col-span-8 lg:col-span-9 h-full">
        {selectedNote ? (
          <CyberCard className="h-full flex flex-col" noPadding>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-cyber-dark/50">
              <div className="flex flex-col flex-1 mr-4">
                <input 
                   disabled={!isEditing}
                   className="bg-transparent text-xl font-display font-bold text-white outline-none w-full"
                   value={selectedNote.title}
                   onChange={(e) => {
                     const updated = { ...selectedNote, title: e.target.value };
                     setNotes(notes.map(n => n.id === n.id ? updated : n));
                   }}
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-gray-500">ID: {selectedNote.id}</span>
                  <span className="text-xs font-mono text-gray-600">|</span>
                  <span className="text-xs font-mono text-gray-500">上次更新: {new Date(selectedNote.updated_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                 {isEditing ? (
                   <CyberButton variant="primary" onClick={handleSave} className="h-8 text-xs">
                     <Save size={14} /> 保存
                   </CyberButton>
                 ) : (
                   <CyberButton variant="secondary" onClick={() => setIsEditing(true)} className="h-8 text-xs">
                     编辑模式
                   </CyberButton>
                 )}
                 <button 
                   onClick={() => handleDelete(selectedNote.id)}
                   className="p-2 text-gray-500 hover:text-cyber-pink transition-colors"
                 >
                   <Trash2 size={16} />
                 </button>
              </div>
            </div>

            {/* Editor / Preview Area */}
            <div className="flex-1 bg-black/40 relative">
              {isEditing ? (
                <textarea 
                  className="w-full h-full bg-transparent p-6 text-gray-300 font-mono text-sm outline-none resize-none leading-relaxed"
                  value={selectedNote.content}
                  onChange={(e) => {
                     const updated = { ...selectedNote, content: e.target.value };
                     setNotes(notes.map(n => n.id === n.id ? updated : n));
                  }}
                />
              ) : (
                <div className="p-6 prose prose-invert max-w-none prose-headings:font-display prose-headings:text-cyber-cyan prose-p:text-gray-300 prose-code:text-cyber-yellow prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700">
                  <h1 className="text-2xl font-bold mb-4 text-cyber-cyan">{selectedNote.title}</h1>
                  {selectedNote.content.split('\n').map((line: string, i: number) => (
                    <p key={i} className="mb-2 font-mono text-sm">
                      {line.startsWith('#') ? <span className="text-lg font-bold text-cyber-pink">{line.replace(/#/g, '')}</span> : line}
                    </p>
                  ))}
                </div>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="p-2 bg-cyber-black border-t border-gray-800 flex justify-between items-center text-[10px] font-mono text-gray-600">
              <span>字数: {selectedNote.content.split(' ').length}</span>
              <span>同步状态: <span className="text-cyber-cyan">已连接</span></span>
            </div>
          </CyberCard>
        ) : (
          <div className="h-full flex items-center justify-center flex-col text-gray-600">
             <Database size={48} className="mb-4 opacity-20" />
             <p className="font-mono">请选择数据源...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPage;
