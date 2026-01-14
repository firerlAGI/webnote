import React, { useState } from 'react';
import { MOCK_NOTES, MOCK_FOLDERS } from '../constants';
import { CyberCard, CyberButton, CyberBadge } from '../components/CyberUI';
import { Note } from '../types';
import { Folder, Search, Save, Plus, Trash2, Pin, Database } from 'lucide-react';

const NotesPage: React.FC = () => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(MOCK_NOTES[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(MOCK_NOTES);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // Simplified handler for demo
  const handleSave = () => {
    setIsEditing(false);
    // Logic to sync would go here
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          {MOCK_FOLDERS.map(f => (
            <button key={f.id} className="flex items-center gap-2 px-3 py-1 border border-gray-800 bg-cyber-dark hover:border-cyber-cyan/50 rounded-sm text-xs font-mono text-gray-300 whitespace-nowrap transition-all">
              <Folder size={12} className="text-cyber-yellow" />
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
                  {note.isPinned && <Pin size={12} className="text-cyber-pink" />}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 font-sans">{note.content}</p>
                <div className="mt-2 flex gap-1">
                   {note.tags.slice(0, 2).map(t => (
                     <span key={t} className="text-[9px] text-gray-400 uppercase">#{t}</span>
                   ))}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800">
             <CyberButton className="w-full text-sm" onClick={() => alert("触发新建笔记指令")}>
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
              <div className="flex flex-col">
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
                  <span className="text-xs font-mono text-gray-500">上次更新: {new Date(selectedNote.updatedAt).toLocaleString('zh-CN')}</span>
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
                 <button className="p-2 text-gray-500 hover:text-cyber-pink transition-colors">
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
                  {/* Simulating Markdown Render */}
                  <h1 className="text-2xl font-bold mb-4 text-cyber-cyan">{selectedNote.title}</h1>
                  {selectedNote.content.split('\n').map((line, i) => (
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