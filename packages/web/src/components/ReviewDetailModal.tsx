import React from 'react';
import { X, Calendar, Brain, Activity, Smile, Edit, Trash2 } from 'lucide-react';
import { CyberButton, CyberCard } from './CyberUI';
import { StatRadar } from './SystemCharts';

interface ReviewDetailModalProps {
  review?: {
    id: number;
    date: string;
    content?: string;
    mood?: number;
    achievements?: string[];
    improvements?: string[];
    plans?: string[];
  };
  isOpen: boolean;
  onClose: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const ReviewDetailModal: React.FC<ReviewDetailModalProps> = ({ review, isOpen, onClose, onEdit, onDelete }) => {
  if (!isOpen || !review) return null;

  // 构造雷达图数据
  const statsData = [
    { subject: '精神', A: review.mood || 5, fullMark: 10 },
    { subject: '体力', A: review.mood || 5, fullMark: 10 },
    { subject: '专注', A: review.mood || 5, fullMark: 10 },
    { subject: '创造', A: review.mood || 5, fullMark: 10 },
    { subject: '情绪', A: review.mood || 5, fullMark: 10 },
    { subject: '社交', A: review.mood || 5, fullMark: 10 },
  ];

  // 情绪评分颜色
  const getMoodColor = (mood?: number) => {
    if (!mood) return 'text-gray-500';
    if (mood >= 8) return 'text-cyber-cyan';
    if (mood >= 5) return 'text-cyber-yellow';
    return 'text-cyber-pink';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* 背景模糊遮罩 */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* 弹窗内容 */}
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-auto bg-cyber-black border border-cyber-cyan/30 rounded-lg shadow-[0_0_30px_rgba(0,255,255,0.1)] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-cyber-cyan" />
            <div>
              <h2 className="text-xl font-display font-bold text-white">
                {review.date || 'N/A'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Smile size={14} className={getMoodColor(review.mood)} />
                <span className={`text-sm font-mono ${getMoodColor(review.mood)}`}>
                  MOOD: {review.mood || 'N/A'}/10
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cyber-cyan/10 rounded transition-colors text-gray-400 hover:text-cyber-cyan"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：雷达图 */}
          <div className="lg:col-span-1">
            <CyberCard title="BIO_METRICS" className="h-full min-h-[400px] bg-black/40">
              <div className="w-full">
                <StatRadar data={statsData} />
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-gray-500 mt-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-cyber-cyan"></div>
                  CURRENT
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-700"></div>
                  TARGET
                </div>
              </div>

              {/* 统计指标卡片 */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2">
                  <Brain size={18} className="text-cyber-cyan" />
                  <span className="text-lg font-bold font-display text-white">
                    {review.mood || 0}
                  </span>
                  <span className="text-[9px] text-gray-600 font-mono">FOCUS</span>
                </div>
                <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2">
                  <Activity size={18} className="text-cyber-pink" />
                  <span className="text-lg font-bold font-display text-white">
                    {review.mood || 0}
                  </span>
                  <span className="text-[9px] text-gray-600 font-mono">ENERGY</span>
                </div>
                <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2">
                  <Smile size={18} className="text-cyber-yellow" />
                  <span className="text-lg font-bold font-display text-white">
                    {review.mood || 0}
                  </span>
                  <span className="text-[9px] text-gray-600 font-mono">MOOD</span>
                </div>
              </div>
            </CyberCard>
          </div>

          {/* 右侧：详细内容 */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* 核心任务 */}
            {review.achievements && review.achievements.length > 0 && (
              <CyberCard title="PRIME_DIRECTIVE" className="bg-black/40">
                <ul className="space-y-2">
                  {review.achievements.map((achievement, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-gray-300 font-mono"
                    >
                      <span className="text-cyber-cyan mt-1">▹</span>
                      <span>{achievement}</span>
                    </li>
                  ))}
                </ul>
              </CyberCard>
            )}

            {/* 系统阻碍 */}
            {review.improvements && review.improvements.length > 0 && (
              <CyberCard title="SYSTEM_INTERRUPTS" className="bg-black/40">
                <ul className="space-y-2">
                  {review.improvements.map((improvement, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-gray-300 font-mono"
                    >
                      <span className="text-cyber-pink mt-1">▹</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CyberCard>
            )}

            {/* 详细复盘 */}
            {review.content && (
              <CyberCard title="ANALYSIS_DATA" className="bg-black/40 flex-1">
                <div className="whitespace-pre-wrap text-sm text-gray-300 font-mono">
                  {review.content}
                </div>
              </CyberCard>
            )}

            {/* 下一步计划 */}
            {review.plans && review.plans.length > 0 && (
              <CyberCard title="NEXT_STEPS" className="bg-black/40">
                <ul className="space-y-2">
                  {review.plans.map((plan, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-gray-300 font-mono"
                    >
                      <span className="text-cyber-yellow mt-1">▹</span>
                      <span>{plan}</span>
                    </li>
                  ))}
                </ul>
              </CyberCard>
            )}
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="sticky bottom-0 z-10 bg-black/90 backdrop-blur-sm border-t border-gray-800 px-6 py-4 flex items-center justify-end gap-3">
          <CyberButton
            variant="secondary"
            onClick={() => onEdit(review.id)}
          >
            <Edit size={16} />
            EDIT
          </CyberButton>
          <CyberButton
            variant="danger"
            onClick={() => onDelete(review.id)}
          >
            <Trash2 size={16} />
            DELETE
          </CyberButton>
        </div>
      </div>
    </div>
  );
};

export default ReviewDetailModal;
