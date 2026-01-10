import React from 'react';

interface MarkdownToolbarProps {
  onAction: (action: string, value?: string) => void;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onAction }) => {
  const toolbarButtons = [
    { name: 'bold', label: '加粗', icon: 'B', shortcut: 'Ctrl+B' },
    { name: 'italic', label: '斜体', icon: 'I', shortcut: 'Ctrl+I' },
    { name: 'strike', label: '删除线', icon: 'S', shortcut: '' },
    { name: 'divider' },
    { name: 'h1', label: '标题1', icon: 'H1', shortcut: '' },
    { name: 'h2', label: '标题2', icon: 'H2', shortcut: '' },
    { name: 'h3', label: '标题3', icon: 'H3', shortcut: '' },
    { name: 'divider' },
    { name: 'ul', label: '无序列表', icon: '•', shortcut: '' },
    { name: 'ol', label: '有序列表', icon: '1.', shortcut: '' },
    { name: 'divider' },
    { name: 'quote', label: '引用', icon: '"', shortcut: '' },
    { name: 'code', label: '代码块', icon: '</>', shortcut: '' },
    { name: 'divider' },
    { name: 'link', label: '链接', icon: '🔗', shortcut: '' },
    { name: 'image', label: '图片', icon: '🖼️', shortcut: '' },
    { name: 'divider' },
    { name: 'table', label: '表格', icon: '▦', shortcut: '' },
    { name: 'hr', label: '分隔线', icon: '—', shortcut: '' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      {toolbarButtons.map((button, index) => {
        if (button.name === 'divider') {
          return (
            <div
              key={`divider-${index}`}
              className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"
            />
          );
        }

        return (
          <button
            key={button.name}
            type="button"
            onClick={() => onAction(button.name)}
            className={`flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors
              ${button.name === 'bold' || button.name === 'italic' || button.name === 'strike'
                ? 'font-serif italic' 
                : 'font-sans'
              }
              hover:bg-white dark:hover:bg-gray-700 
              border border-gray-300 dark:border-gray-600
              text-gray-700 dark:text-gray-300
              focus:outline-none focus:ring-2 focus:ring-blue-500
              group relative`}
            title={`${button.label} ${button.shortcut ? `(${button.shortcut})` : ''}`}
          >
            {button.name === 'bold' && <span className="font-bold">B</span>}
            {button.name === 'italic' && <span className="italic">I</span>}
            {button.name === 'strike' && <span className="line-through">S</span>}
            {button.name === 'h1' && <span className="text-lg font-bold">H1</span>}
            {button.name === 'h2' && <span className="text-base font-bold">H2</span>}
            {button.name === 'h3' && <span className="text-sm font-bold">H3</span>}
            {button.name === 'ul' && <span className="text-lg">•</span>}
            {button.name === 'ol' && <span>1.</span>}
            {button.name === 'quote' && <span className="text-lg">"</span>}
            {button.name === 'code' && <span className="font-mono text-xs">&lt;/&gt;</span>}
            {button.name === 'link' && <span>🔗</span>}
            {button.name === 'image' && <span>🖼️</span>}
            {button.name === 'table' && <span>▦</span>}
            {button.name === 'hr' && <span>—</span>}
          </button>
        );
      })}
    </div>
  );
};

export default MarkdownToolbar;
