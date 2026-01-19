import React from 'react';
import { Calendar, Brain, Activity, Smile, Edit, Trash2 } from 'lucide-react';
import { CyberButton } from './CyberUI';

interface ReviewListCardProps {
  review: {
    id: number;
    date: string;
    content?: string;
    mood?: number;
    achievements?: string[];
    improvements?: string[];
    plans?: string[];
  };
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const ReviewListCard: React.FC<ReviewListCardProps> = ({ review, onView, onEdit, onDelete }) => {
  // 情绪评分颜色
  const getMoodColor = (mood?: number) => {
    if (!mood) return 'text-gray-500';
    if (mood >= 8) return 'text-cyber-cyan';
    if (mood >= 5) return 'text-cyber-yellow';
    return 'text-cyber-pink';
  };

  const getMoodBgColor = (mood?: number) => {
    if (!mood) return 'bg-gray-700';
    if (mood >= 8) return 'bg-cyber-cyan';
    if (mood >= 5) return 'bg-cyber-yellow';
    return 'bg-cyber-pink';
  };

  // 获取核心任务预览
  const getPreviewContent = () => {
    const achievements = review.achievements?.join(', ') || '';
    const content = review.content?.substring(0, 100) || '';
    return achievements || content || 'No data available';
  };

  return (
    <div
      className="bg-cyber-panel border border-gray-800 rounded-lg p-4 hover:border-cyber-cyan/50 transition-all duration-200 group cursor-pointer"
      onClick={() => onView(review.id)}
    >
      {/* 头部：日期和情绪 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-cyber-cyan" />
          <span className="font-mono text-sm text-gray-200">
            {review.date || 'N/A'}
          </span>
        </div>
        {review.mood !== undefined && review.mood > 0 && (
          <div className="flex items-center gap-2">
            <Smile size={16} className={getMoodColor(review.mood)} />
            <span className={`font-display font-bold ${getMoodColor(review.mood)}`}>
              {review.mood}/10
            </span>
          </div>
        )}
      </div>

      {/* 核心任务预览 */}
      <div className="mb-3">
        <p className="text-gray-400 text-sm line-clamp-2 font-mono">
          {getPreviewContent()}
        </p>
      </div>

      {/* 统计指标 */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <Brain size={12} className="text-cyber-cyan" />
          <span className="text-xs text-gray-500 font-mono">FOCUS</span>
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden ml-1">
            <div 
              className="h-full bg-cyber-cyan transition-all duration-300"
              style={{ width: `${review.mood ? review.mood * 10 : 50}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Activity size={12} className="text-cyber-pink" />
          <span className="text-xs text-gray-500 font-mono">ENERGY</span>
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden ml-1">
            <div 
              className="h-full bg-cyber-pink transition-all duration-300"
              style={{ width: `${review.mood ? review.mood * 10 : 50}%` }}
            />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <CyberButton
          className="px-3 py-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(review.id);
          }}
        >
          <Edit size={14} />
        </CyberButton>
        <CyberButton
          className="px-3 py-1 text-xs"
          variant="danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(review.id);
          }}
        >
          <Trash2 size={14} />
        </CyberButton>
      </div>
    </div>
  );
};

export default ReviewListCard;
