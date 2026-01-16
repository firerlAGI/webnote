import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { CyberCard, CyberButton, CyberTextArea, CyberTag, CyberScrambleText } from '../components/CyberUI';
import { Search, Plus, Trash2, Pin, Folder, Eye, Edit3, Maximize2, Minimize2, Save, Cloud, Hash, ChevronRight, FileCode, Code } from 'lucide-react';

const NotesPage: React.FC = () => {
  const { notes, folders, addNote, updateNote, deleteNote } = useData();
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // View States
  const [viewMode, setViewMode] = useState<'write' | 'read'>('write');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'synced'>('synced');

  // Editor Refs & State
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedNote = notes.find(n => n.id === selectedNoteId);
  
  // Refs for Editor
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Selection
  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNoteId]);

  // Simulated Auto-Save Logic
  const handleContentChange = (key: 'title' | 'content', value: string) => {
    if (!selectedNoteId) return;

    setSaveStatus('saving');
    
    // Immediate local update
    updateNote(selectedNoteId, { [key]: value } as any);

    // Debounce the "Synced" status
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('synced');
    }, 800);
  };

  const handleCreateNew = () => {
    addNote({
      title: 'UNTITLED_PROTOCOL',
      content: '',
      folder_id: selectedFolderId || 1,
      isPinned: false,
      tags: ['DRAFT'],
      user_id: 1
    });
  };

  const handleDelete = () => {
    if (!selectedNoteId) return;
    if (window.confirm('WARNING: PERMANENT DATA DELETION REQUESTED.\nCONFIRM?')) {
      deleteNote(selectedNoteId);
      setSelectedNoteId(null);
    }
  };

  // --- Code Block Logic ---
  const insertCodeBlock = () => {
    const textarea = textAreaRef.current;
    if (!textarea || !selectedNote) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = selectedNote.content;
    
    // Template for code block
    const codeBlockTemplate = "\n```javascript\n\n```\n";

    const newContent = text.substring(0, start) + codeBlockTemplate + text.substring(end);
    
    handleContentChange('content', newContent);

    // Restore focus and move cursor inside the block
    setTimeout(() => {
      textarea.focus();
      // Position cursor after ```javascript\n
      const cursorPosition = start + 13; 
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  };

  // --- Markdown Renderer (Text + Code Blocks) ---
  const renderMarkdown = (text: string) => {
    // Regex to split by code blocks: ```lang ... ```
    // Captures the whole block including backticks
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      // Check if this part is a code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.slice(3, -3).trim(); // Remove backticks
        // Extract language if present (first line)
        const firstLineBreak = content.indexOf('\n');
        let language = 'TEXT';
        let code = content;

        if (firstLineBreak !== -1) {
          const firstLine = content.substring(0, firstLineBreak).trim();
          if (firstLine && !firstLine.includes(' ')) {
             language = firstLine.toUpperCase();
             code = content.substring(firstLineBreak + 1);
          }
        }

        return (
          <div key={index} className="my-6 relative group rounded overflow-hidden border border-gray-800 bg-[#0c0c0c]">
             {/* Code Header */}
             <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-gray-800">
                <div className="flex gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                   <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                   <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                </div>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{language}</span>
             </div>
             
             {/* Code Body */}
             <div className="p-4 overflow-x-auto relative">
                {/* Decorative Line Number Strip (Fake) */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-pink/50"></div>
                <pre className="font-mono text-xs md:text-sm text-gray-300 leading-relaxed tab-4">
                  <code>{code}</code>
                </pre>
             </div>

             {/* Hover Glow */}
             <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover:border-cyber-pink/20 transition-colors rounded"></div>
          </div>
        );
      }
      
      // Regular text (handle newlines)
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  const filteredNotes = notes.filter(n => 
    (n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.content.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedFolderId === null || n.folderId === selectedFolderId)
  );

  const wordCount = selectedNote?.content.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
  const charCount = selectedNote?.content.length || 0;

  return (
    <div className="flex h-full gap-6 transition-all duration-500">
      
      {/* --- LEFT SIDEBAR: DATA MATRIX --- */}
      <div 
        className={`flex flex-col gap-4 transition-all duration-500 ease-in-out ${
          isFocusMode ? 'w-0 opacity-0 -ml-6 overflow-hidden' : 'w-full md:w-1/3 lg:w-1/4 opacity-100'
        }`}
      >
        {/* Search Matrix */}
        <div className="relative group">
          <div className="absolute inset-0 bg-cyber-cyan/5 skew-x-[-10deg] rounded border border-gray-800 group-hover:border-cyber-cyan/50 transition-colors"></div>
          <div className="relative flex items-center px-4 py-3 z-10">
            <span className="text-cyber-cyan mr-2 font-mono">{'>'}</span>
            <input 
              type="text" 
              placeholder="SEARCH_QUERY..." 
              className="bg-transparent border-none outline-none text-cyber-cyan placeholder-gray-700 font-mono w-full text-sm uppercase tracking-wider"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="text-gray-600 w-4 h-4 animate-pulse" />
          </div>
        </div>

        {/* Folder Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm text-[10px] font-mono transition-all whitespace-nowrap group ${
              selectedFolderId === null
                ? 'border-cyber-cyan bg-cyber-cyan/10 text-white'
                : 'border-gray-800 bg-black/40 text-gray-400 hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5 hover:text-white'
            }`}
          >
            <Folder size={10} className={`${selectedFolderId === null ? 'text-cyber-cyan' : 'text-gray-600 group-hover:text-cyber-yellow'} transition-colors`} />
            ALL_SECTORS
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFolderId(prev => prev === f.id ? null : f.id)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm text-[10px] font-mono transition-all whitespace-nowrap group ${
                selectedFolderId === f.id
                  ? 'border-cyber-cyan bg-cyber-cyan/10 text-white'
                  : 'border-gray-800 bg-black/40 text-gray-400 hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5 hover:text-white'
              }`}
            >
              <Folder size={10} className={`${selectedFolderId === f.id ? 'text-cyber-cyan' : 'text-gray-600 group-hover:text-cyber-yellow'} transition-colors`} />
              {f.name}
            </button>
          ))}
        </div>

        {/* The List */}
        <CyberCard className="flex-1 overflow-hidden flex flex-col" noPadding variant="flat">
          <div className="flex flex-col h-full">
          <div className="p-2 border-b border-gray-800 bg-black/20">
             <button 
               onClick={handleCreateNew}
               className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-700 hover:border-cyber-cyan text-gray-500 hover:text-cyber-cyan transition-all text-xs font-mono group"
             >
               <Plus size={14} className="group-hover:rotate-90 transition-transform" />
               INITIATE_NEW_ENTRY
             </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-50">
                <Hash className="text-gray-700 mb-2" />
                <span className="text-xs font-mono text-gray-600">NO DATA FOUND</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {filteredNotes.map(note => (
                  <div 
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`group relative p-4 cursor-pointer transition-all duration-200 border-l-2 hover:bg-white/5 ${
                      selectedNoteId === note.id 
                        ? 'border-cyber-cyan bg-cyber-cyan/5' 
                        : 'border-transparent'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-0 h-[1px] bg-cyber-cyan group-hover:w-full transition-all duration-700 opacity-50"></div>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-mono font-bold text-sm truncate pr-4 ${selectedNoteId === note.id ? 'text-cyber-cyan' : 'text-gray-300 group-hover:text-white'}`}>
                        {note.title || 'UNTITLED'}
                      </h4>
                      {note.isPinned && <Pin size={10} className="text-cyber-pink shrink-0 mt-1" />}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[9px] font-mono text-gray-600">
                          {new Date(note.updatedAt).toLocaleDateString(undefined, {month:'2-digit', day:'2-digit'})} <span className="text-gray-700">|</span> {new Date(note.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                       </span>
                       <div className="flex gap-1">
                          {note.tags.slice(0, 1).map(t => (
                            <span key={t} className="text-[8px] px-1 py-0.5 border border-gray-800 rounded text-gray-500 font-mono bg-black">{t}</span>
                          ))}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </CyberCard>
      </div>

      {/* --- RIGHT EDITOR: TACTICAL TERMINAL --- */}
      <div className={`flex-1 flex flex-col h-full relative transition-all duration-500 ${isFocusMode ? 'max-w-4xl mx-auto' : ''}`}>
        
        {selectedNote ? (
          <CyberCard className="h-full flex flex-col overflow-hidden shadow-2xl" noPadding variant="default">
            <div className="flex flex-col h-full">
            {/* 1. Tactical Toolbar */}
            <div className="shrink-0 h-14 bg-black/40 border-b border-gray-800 flex items-center justify-between px-4 select-none">
              
              {/* Left: Focus Toggle */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  className="p-2 text-gray-500 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded transition-all"
                  title={isFocusMode ? "Exit Focus" : "Focus Mode"}
                >
                  {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <div className="w-[1px] h-4 bg-gray-800 mx-1"></div>
                
                {/* Insert Code Block Button */}
                <button
                  onClick={insertCodeBlock}
                  className="p-2 text-gray-500 hover:text-cyber-pink hover:bg-cyber-pink/10 rounded transition-all group"
                  title="Insert Code Block"
                  disabled={viewMode === 'read'}
                >
                  <Code size={16} className={viewMode === 'write' ? 'group-hover:text-cyber-pink' : 'opacity-30'} />
                </button>
              </div>

              {/* Center: Mode Switcher */}
              <div className="flex items-center bg-black/60 rounded-lg p-1 border border-gray-800">
                <button 
                  onClick={() => setViewMode('write')}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                    viewMode === 'write' ? 'bg-cyber-cyan/20 text-cyber-cyan shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Edit3 size={12} /> WRITE
                </button>
                <div className="w-[1px] h-3 bg-gray-800 mx-1"></div>
                <button 
                  onClick={() => setViewMode('read')}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                    viewMode === 'read' ? 'bg-cyber-pink/20 text-cyber-pink shadow-[0_0_10px_rgba(255,0,85,0.1)]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Eye size={12} /> DECODE
                </button>
              </div>

              {/* Right: Actions & Status */}
              <div className="flex items-center gap-3">
                 <div className="hidden md:flex items-center gap-2 text-[10px] font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-cyber-yellow animate-pulse' : 'bg-green-500'}`}></span>
                    <span className={saveStatus === 'saving' ? 'text-cyber-yellow' : 'text-gray-500'}>
                      {saveStatus === 'saving' ? 'UPLOADING...' : 'SYNCED'}
                    </span>
                 </div>
                 <div className="h-4 w-[1px] bg-gray-800 mx-1"></div>
                 <button onClick={handleDelete} className="text-gray-600 hover:text-cyber-pink transition-colors">
                   <Trash2 size={16} />
                 </button>
              </div>
            </div>

            {/* 2. Meta Header */}
            <div className="shrink-0 px-6 pt-6 pb-2 bg-gradient-to-b from-black/20 to-transparent">
               <input 
                  value={selectedNote.title}
                  onChange={(e) => handleContentChange('title', e.target.value)}
                  placeholder="UNTITLED_ENTRY"
                  className="w-full bg-transparent text-2xl md:text-3xl font-display font-bold text-white placeholder-gray-700 outline-none border-none p-0 focus:ring-0"
               />
               <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-hide">
                  <Hash size={12} className="text-cyber-cyan/50" />
                  {selectedNote.tags.map((tag, idx) => (
                    <CyberTag key={idx} label={tag} onRemove={() => {
                       const newTags = selectedNote.tags.filter(t => t !== tag);
                       updateNote(selectedNote.id, { tags: newTags });
                    }} />
                  ))}
                  <button 
                    className="text-[10px] px-2 py-0.5 border border-dashed border-gray-700 text-gray-600 hover:text-cyber-cyan hover:border-cyber-cyan transition-colors rounded-sm"
                    onClick={() => {
                       const tag = prompt("ADD TAG (e.g. WORK):");
                       if (tag) updateNote(selectedNote.id, { tags: [...selectedNote.tags, tag] });
                    }}
                  >
                    + TAG
                  </button>
               </div>
            </div>

            {/* 3. Main Editor / Preview Area */}
            <div className="flex-1 relative overflow-hidden group">
               <div className="absolute inset-0 bg-cyber-grid bg-[length:40px_40px] opacity-5 pointer-events-none"></div>
               
               {viewMode === 'write' ? (
                  <CyberTextArea 
                    ref={textAreaRef}
                    value={selectedNote.content}
                    onChange={(e) => handleContentChange('content', e.target.value)}
                    placeholder="// START_DATA_ENTRY..."
                    className="leading-relaxed font-mono text-gray-300 text-sm md:text-base p-6 md:p-8"
                    spellCheck={false}
                  />
               ) : (
                  <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 md:p-8">
                     <div className="prose prose-invert prose-p:font-sans prose-headings:font-display prose-headings:text-cyber-cyan prose-code:text-cyber-pink prose-code:font-mono max-w-none">
                        <div className="whitespace-pre-wrap">
                          {selectedNote.content ? renderMarkdown(selectedNote.content) : <span className="text-gray-600 italic">// EMPTY_BUFFER</span>}
                        </div>
                     </div>
                  </div>
               )}
            </div>

            {/* 4. Footer Status Bar */}
            <div className="shrink-0 h-8 bg-black/60 border-t border-gray-800 flex items-center justify-between px-4 text-[9px] font-mono text-gray-500 select-none">
               <div className="flex gap-4">
                  <span>Ln {selectedNote.content.split('\n').length}, Col {selectedNote.content.length}</span>
                  <span>{wordCount} WORDS</span>
                  <span>{charCount} CHARS</span>
               </div>
               <div className="flex items-center gap-2">
                  <FileCode size={10} />
                  <span>MARKDOWN_SUPPORT: ACTIVE</span>
               </div>
            </div>
            </div>
          </CyberCard>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center border border-gray-800 rounded bg-black/20 relative overflow-hidden group">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
             <Cloud size={48} className="mb-4 text-gray-700 group-hover:text-cyber-cyan transition-colors duration-500" />
             <div className="text-xl font-display font-bold text-gray-500 tracking-widest group-hover:text-white transition-colors">WAITING FOR INPUT</div>
             <div className="text-xs font-mono text-gray-600 mt-2 flex items-center gap-2">
                <ChevronRight size={12} className="animate-pulse" />
                SELECT_DATA_SOURCE
             </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default NotesPage;
