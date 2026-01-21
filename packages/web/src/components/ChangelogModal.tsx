import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { CyberButton } from './CyberUI';

const translations = {
  'zh-CN': {
    title: '版本更新记录',
    subtitle: 'VERSION HISTORY // CHANGELOG',
    close: '关闭',
    loading: '加载数据中...',
    error: '无法加载更新日志',
  },
  en: {
    title: 'Version History',
    subtitle: 'VERSION HISTORY // CHANGELOG',
    close: 'Close',
    loading: 'Loading...',
    error: 'Failed to load changelog',
  },
  ja: {
    title: 'バージョン更新履歴',
    subtitle: 'VERSION HISTORY // CHANGELOG',
    close: '閉じる',
    loading: '読み込み中...',
    error: '更新ログの読み込みに失敗しました',
  },
} as const;

type Language = keyof typeof translations;

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose, language = 'zh-CN' }) => {
  const [changelog, setChangelog] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const t = translations[language];

  useEffect(() => {
    if (!isOpen) return;

    const fetchChangelog = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await fetch('/CHANGELOG.md');
        if (!response.ok) throw new Error('Failed to fetch changelog');
        const text = await response.text();
        setChangelog(text);
      } catch (err) {
        console.error('Error loading changelog:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-cyber-cyan/30 rounded-lg shadow-[0_0_40px_rgba(0,243,255,0.1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-cyber-cyan/20 bg-gradient-to-r from-cyber-cyan/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-cyber-cyan/20 flex items-center justify-center border border-cyber-cyan/30">
              <FileText size={20} className="text-cyber-cyan" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-white">{t.title}</h2>
              <p className="text-[10px] sm:text-xs font-mono text-cyber-cyan/70">{t.subtitle}</p>
            </div>
          </div>
          <CyberButton
            variant="secondary"
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 text-xs"
          >
            <X size={16} />
          </CyberButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-thin scrollbar-thumb-cyber-cyan/30 scrollbar-track-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-cyber-cyan font-mono text-sm">
                  <Sparkles size={16} className="animate-pulse" />
                  {t.loading}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-400 font-mono text-sm">{t.error}</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mt-6 mb-4 pb-2 border-b-2 border-cyber-cyan/30 flex items-center gap-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-white mt-8 mb-3 pb-2 border-b border-cyber-cyan/20 flex items-center gap-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-display font-bold text-cyber-cyan mt-6 mb-2 flex items-center gap-2">
                      <span className="text-cyber-cyan/50">›</span> {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-none space-y-2 mb-4 pl-0">{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2 text-gray-300">
                      <span className="text-cyber-cyan mt-1.5 shrink-0">•</span>
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">{children}</strong>
                  ),
                  code: ({ className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 bg-cyber-cyan/10 text-cyber-cyan text-xs font-mono rounded"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code
                        className={className}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-gray-900/50 border border-cyber-cyan/20 rounded-lg p-4 overflow-x-auto my-4">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyber-cyan hover:text-cyber-cyan/80 underline decoration-cyber-cyan/30 underline-offset-2 transition-colors"
                    >
                      {children}
                    </a>
                  ),
                  hr: () => (
                    <hr className="my-8 border-cyber-cyan/20" />
                  ),
                }}
              >
                {changelog}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-cyber-cyan/20 bg-black/30">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500 font-mono">
            <Calendar size={12} />
            {new Date().toLocaleDateString('zh-CN')}
          </div>
          <CyberButton onClick={onClose}>
            {t.close}
          </CyberButton>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
