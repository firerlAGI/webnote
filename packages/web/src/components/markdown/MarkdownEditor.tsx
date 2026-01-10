import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import MarkdownToolbar from './MarkdownToolbar';
import ImageUpload from './ImageUpload';
import '../../styles/markdown.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  placeholder = '开始编写 Markdown 内容...',
  minHeight = '300px',
  maxHeight = '600px',
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lastSavedValue, setLastSavedValue] = useState(value);

  // 处理工具栏操作
  const handleToolbarAction = useCallback((action: string, insertValue?: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    let newText = '';
    let cursorPosition = start;

    switch (action) {
      case 'bold':
        newText = `**${selectedText || '加粗文本'}**`;
        cursorPosition = selectedText ? newText.length : start + 2;
        break;
      case 'italic':
        newText = `*${selectedText || '斜体文本'}*`;
        cursorPosition = selectedText ? newText.length : start + 1;
        break;
      case 'strike':
        newText = `~~${selectedText || '删除线文本'}~~`;
        cursorPosition = selectedText ? newText.length : start + 2;
        break;
      case 'h1':
        newText = `# ${selectedText || '标题 1'}`;
        break;
      case 'h2':
        newText = `## ${selectedText || '标题 2'}`;
        break;
      case 'h3':
        newText = `### ${selectedText || '标题 3'}`;
        break;
      case 'ul':
        newText = `- ${selectedText || '列表项'}`;
        break;
      case 'ol':
        newText = `1. ${selectedText || '列表项'}`;
        break;
      case 'quote':
        newText = `> ${selectedText || '引用内容'}`;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          newText = `\`\`\`\n${selectedText}\n\`\`\``;
        } else {
          newText = `\`${selectedText || '代码'}\``;
          cursorPosition = selectedText ? newText.length : start + 1;
        }
        break;
      case 'link':
        newText = `[${selectedText || '链接文本'}](url)`;
        cursorPosition = selectedText ? newText.length - 4 : start + 1;
        break;
      case 'image':
        setShowImageUpload(true);
        return;
      case 'table':
        newText = `
| 标题1 | 标题2 | 标题3 |
|-------|-------|-------|
| 单元格1 | 单元格2 | 单元格3 |
| 单元格4 | 单元格5 | 单元格6 |
`.trim();
        break;
      case 'hr':
        newText = '\n---\n';
        break;
      default:
        return;
    }

    // 插入新文本
    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);

    // 恢复焦点和光标位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  }, [value, onChange]);

  // 处理图片上传成功
  const handleImageUploadSuccess = useCallback((url: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = `
![图片描述](${url})
`;

    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);
    setShowImageUpload(false);

    // 恢复焦点
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + newText.length - 2);
    }, 0);
  }, [value, onChange]);

  // 处理快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          onSave?.();
          setLastSavedValue(value);
          break;
        case 'b':
          e.preventDefault();
          handleToolbarAction('bold');
          break;
        case 'i':
          e.preventDefault();
          handleToolbarAction('italic');
          break;
        case 'e':
          e.preventDefault();
          handleToolbarAction('code');
          break;
        case 'k':
          e.preventDefault();
          handleToolbarAction('link');
          break;
      }
    }
  }, [value, onSave, handleToolbarAction]);

  // 支持 Tab 键缩进
  const handleKeyDownTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* 顶部工具栏 */}
      <MarkdownToolbar onAction={handleToolbarAction} />

      {/* 图片上传弹窗 */}
      {showImageUpload && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              上传图片
            </h3>
            <ImageUpload onUploadSuccess={handleImageUploadSuccess} />
            <button
              type="button"
              onClick={() => setShowImageUpload(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 编辑和预览切换按钮 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              showPreview
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            分屏预览
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              !showPreview
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            仅编辑
          </button>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          {onSave && (
            <>
              <span>
                {value === lastSavedValue ? '已保存' : '未保存'}
              </span>
              <span>•</span>
              <span>{value.length} 字符</span>
              <span>•</span>
              <span>Ctrl+S 保存</span>
            </>
          )}
        </div>
      </div>

      {/* 编辑器和预览区域 */}
      <div className={showPreview ? 'grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700' : ''}>
        {/* 编辑区域 */}
        <div className={showPreview ? 'w-full' : 'w-full'}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              handleKeyDown(e);
              handleKeyDownTab(e);
            }}
            placeholder={placeholder}
            className="w-full p-4 resize-none border-none outline-none font-mono text-sm leading-relaxed
              bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
              focus:outline-none
              min-h-[400px]"
            style={{
              minHeight,
              maxHeight: showPreview ? 'none' : maxHeight,
            }}
          />
        </div>

        {/* 预览区域 */}
        {showPreview && (
          <div className="w-full overflow-auto bg-white dark:bg-gray-900">
            <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
              >
                {value || '<p class="text-gray-400">预览将在这里显示...</p>'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;
