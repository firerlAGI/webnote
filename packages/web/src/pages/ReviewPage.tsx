import React, { useState, useEffect } from 'react';
import { CyberCard, CyberInput, CyberButton } from '../components/CyberUI';
import { StatRadar } from '../components/SystemCharts';
import ReviewListCard from '../components/ReviewListCard';
import ReviewDetailModal from '../components/ReviewDetailModal';
import { Brain, Smile, Activity, Save, Calendar, Search, Filter, X, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { reviewsAPI } from '../api';
import type { Review } from '../types';

const ReviewPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  
  // 今日复盘表单状态
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    content: '',
    mood: 8,
    achievements: [] as string[],
    improvements: [] as string[],
    plans: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Mock Data for the Radar Chart
  const statsData = [
    { subject: '精神', A: 8, fullMark: 10 },
    { subject: '体力', A: 6, fullMark: 10 },
    { subject: '专注', A: 9, fullMark: 10 },
    { subject: '创造', A: 7, fullMark: 10 },
    { subject: '情绪', A: 8, fullMark: 10 },
    { subject: '社交', A: 5, fullMark: 10 },
  ];

  // 历史记录状态
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<Review | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 筛选条件
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 分页
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);

  // 初始化日期范围（最近30天）
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // 使用今天的日期作为结束日期（包含今天）
    const todayStr = today.toISOString().split('T')[0];
    setEndDate(todayStr);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    
    // 同时设置表单日期为今天
    setFormData(prev => ({ ...prev, date: todayStr }));
  }, []);

  // 获取复盘列表
  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit: pageSize,
      };

      // 情绪筛选
      if (moodFilter === 'high') {
        params.mood = '8,9,10';
      } else if (moodFilter === 'medium') {
        params.mood = '5,6,7';
      } else if (moodFilter === 'low') {
        params.mood = '1,2,3,4';
      }

      const response = await reviewsAPI.getAll(params);
      
      if (response.data.success) {
        setReviews(response.data.data?.reviews || []);
        setTotal(response.data.data?.pagination?.total || 0);
      } else {
        setError(response.data.error || 'Failed to load reviews');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // 当切换到历史Tab或筛选条件变化时重新获取数据
  useEffect(() => {
    if (activeTab === 'history') {
      fetchReviews();
    }
  }, [activeTab]); // 只在Tab切换时重新获取，避免筛选条件变化时频繁请求

  // 筛选条件变化时重新获取数据（使用debounce）
  useEffect(() => {
    if (activeTab === 'history') {
      const timer = setTimeout(() => {
        setPage(1); // 重置到第一页
        fetchReviews();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [startDate, endDate, moodFilter]);

  // 搜索功能（前端过滤）
  const filteredReviews = reviews.filter(review => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const content = review.content?.toLowerCase() || '';
    const achievements = review.achievements?.join(' ').toLowerCase() || '';
    const improvements = review.improvements?.join(' ').toLowerCase() || '';
    const plans = review.plans?.join(' ').toLowerCase() || '';
    
    return (
      content.includes(query) ||
      achievements.includes(query) ||
      improvements.includes(query) ||
      plans.includes(query)
    );
  });

  // 保存复盘
  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await reviewsAPI.create(formData);
      
      if (response.data.success) {
        setSaveSuccess(true);
        // 清空表单
        setFormData({
          date: new Date().toISOString().split('T')[0],
          content: '',
          mood: 8,
          achievements: [],
          improvements: [],
          plans: [],
        });
        
        // 3秒后隐藏成功提示
        setTimeout(() => setSaveSuccess(false), 3000);
        
        // 自动切换到历史记录Tab并刷新列表
        setActiveTab('history');
        // 等待状态更新后再刷新
        setTimeout(() => fetchReviews(), 100);
      } else {
        setError(response.data.error || 'Failed to save review');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  // 查看详情
  const handleView = async (id: number) => {
    try {
      const response = await reviewsAPI.getById(id);
      if (response.data.success) {
        setSelectedReview(response.data.data);
        setIsModalOpen(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load review');
    }
  };

  // 编辑复盘
  const handleEdit = (id: number) => {
    window.location.hash = `/review?id=${id}`;
  };

  // 删除复盘
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await reviewsAPI.delete(id);
      if (response.data.success) {
        setIsModalOpen(false);
        setSelectedReview(undefined);
        fetchReviews();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete review');
    }
  };

  // 重置筛选
  const handleResetFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    setMoodFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  // 总页数
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col gap-6 animate-in slide-in-from-bottom-5 duration-500">
      
      {/* Header */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-1 flex items-center gap-3">
               <span className="text-cyber-pink">DAILY_PROTOCOL</span>
               <span className="text-gray-600 text-lg">// REVIEW</span>
            </h1>
            <p className="text-cyber-cyan font-mono text-sm">CYCLE: {new Date().toISOString().split('T')[0]}</p>
          </div>
          {activeTab === 'today' && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                 <p className="text-[10px] text-gray-500 font-mono">STREAK</p>
                 <p className="text-xl font-display text-cyber-yellow">42 DAYS</p>
              </div>
              <CyberButton 
                glow
                onClick={handleSubmit}
                disabled={saving || !formData.content.trim()}
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-cyber-cyan border-t-transparent rounded-full" />
                    SAVING...
                  </>
                ) : (
                  <>
                    <Save size={16} /> SUBMIT
                  </>
                )}
              </CyberButton>
            </div>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-2 border-b border-gray-800 pb-0">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-6 py-3 font-mono text-sm uppercase tracking-wider border-b-2 transition-all relative ${
              activeTab === 'today'
                ? 'border-cyber-cyan text-cyber-cyan'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            今日复盘
            {activeTab === 'today' && <div className="absolute inset-0 bg-cyber-cyan/5 blur-sm"></div>}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-mono text-sm uppercase tracking-wider border-b-2 transition-all relative flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-cyber-cyan text-cyber-cyan'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <History size={16} />
            历史记录
            {activeTab === 'history' && <div className="absolute inset-0 bg-cyber-cyan/5 blur-sm"></div>}
          </button>
        </div>
      </div>

      {/* 今日复盘内容 */}
      {activeTab === 'today' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 flex-1 min-h-0 animate-in fade-in duration-300">
        
        {/* Left: Visualization */}
        <div className="md:col-span-1 lg:col-span-5 flex flex-col gap-4 md:gap-6">
           {/* Radar Chart Card */}
          <CyberCard title="BIO_METRICS" className="flex-1 min-h-[280px] sm:min-h-[300px] md:min-h-[380px] bg-black/40">
             <div className="w-full">
                <StatRadar data={statsData} />
             </div>
              <div className="flex gap-4 text-[10px] font-mono text-gray-500 mt-2">
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-cyber-cyan"></div> CURRENT</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-700"></div> TARGET</div>
              </div>
           </CyberCard>

           {/* Quick Stats Grid */}
           <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
             <div className="p-2 sm:p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2 group hover:border-cyber-cyan/50 transition-colors">
                <Brain size={16} sm:size-20 className="text-gray-500 group-hover:text-cyber-cyan" />
                <span className="text-base sm:text-lg font-bold font-display text-white">85%</span>
                <span className="text-[9px] text-gray-600 font-mono">FOCUS</span>
             </div>
             <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2 group hover:border-cyber-pink/50 transition-colors">
                <Activity size={16} sm:size-20 className="text-gray-500 group-hover:text-cyber-pink" />
                <span className="text-base sm:text-lg font-bold font-display text-white">92%</span>
                <span className="text-[9px] text-gray-600 font-mono">ENERGY</span>
             </div>
             <div className="p-3 bg-cyber-panel border border-gray-800 rounded flex flex-col items-center justify-center gap-2 group hover:border-cyber-yellow/50 transition-colors">
                <Smile size={16} sm:size-20 className="text-gray-500 group-hover:text-cyber-yellow" />
                <span className="text-base sm:text-lg font-bold font-display text-white">7.5</span>
                <span className="text-[9px] text-gray-600 font-mono">MOOD</span>
             </div>
           </div>
        </div>

        {/* Right: Input Log */}
        <CyberCard title="LOG_ENTRY" className="md:col-span-1 lg:col-span-7 flex flex-col gap-4 bg-black/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex flex-col gap-2">
              <label className="block text-cyber-cyan text-xs font-mono uppercase tracking-wider">
                PRIME_DIRECTIVE (核心任务)
              </label>
              <textarea 
                className="w-full min-h-[80px] sm:min-h-[100px] bg-black/60 border border-gray-800 focus:border-cyber-cyan/50 text-gray-200 p-2 sm:p-3 font-mono text-xs sm:text-sm outline-none resize-none rounded transition-all"
                placeholder="Objective..."
                value={formData.achievements.join('\n')}
                onChange={(e) => setFormData({ ...formData, achievements: e.target.value.split('\n').filter(a => a.trim()) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="block text-cyber-cyan text-xs font-mono uppercase tracking-wider">
                SYSTEM_INTERRUPTS (阻碍)
              </label>
              <textarea 
                className="w-full min-h-[80px] sm:min-h-[100px] bg-black/60 border border-gray-800 focus:border-cyber-cyan/50 text-gray-200 p-2 sm:p-3 font-mono text-xs sm:text-sm outline-none resize-none rounded transition-all"
                placeholder="Anomalies detected..."
                value={formData.improvements.join('\n')}
                onChange={(e) => setFormData({ ...formData, improvements: e.target.value.split('\n').filter(a => a.trim()) })}
              />
            </div>
          </div>
          
          <div className="flex-1 flex flex-col">
            <label className="block text-cyber-cyan text-xs font-mono mb-2 uppercase tracking-wider">
               ANALYSIS_DATA (详细复盘)
            </label>
            <div className="relative flex-1 group">
               <div className="absolute -inset-[1px] bg-gradient-to-b from-cyber-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded blur-sm pointer-events-none"></div>
               <textarea 
                  className="w-full h-full min-h-[200px] sm:min-h-[300px] md:min-h-[400px] bg-black/60 border border-gray-800 focus:border-cyber-cyan/50 text-gray-200 p-3 sm:p-4 font-mono text-xs sm:text-sm outline-none resize-none rounded transition-all"
                  placeholder="Initiating daily dump sequence..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
               />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
             <div className="flex items-center gap-2 p-2 border border-dashed border-gray-800 rounded bg-black/30">
                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-gray-500 text-xs">+</div>
                <span className="text-xs text-gray-500 font-mono">ATTACH_EVIDENCE</span>
             </div>
             {saveSuccess && (
               <div className="flex items-center gap-2 p-2 border border-green-500/30 rounded bg-green-500/10 animate-in slide-in-from-right-2 duration-300">
                 <span className="text-xs text-green-400 font-mono">✓ SAVED_SUCCESSFULLY</span>
               </div>
             )}
          </div>
        </CyberCard>

        </div>
      )}

      {/* 历史记录内容 */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4 flex-1 min-h-0 animate-in fade-in duration-300">
          {/* 筛选器区域 */}
          <CyberCard title="FILTER_SYSTEM" className="bg-black/20 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
              {/* 开始日期 */}
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-cyber-cyan shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-black/40 border border-gray-700 focus:border-cyber-cyan text-gray-100 px-2 sm:px-3 py-2 font-mono text-xs sm:text-sm outline-none transition-all rounded"
                />
              </div>

              {/* 结束日期 */}
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-cyber-cyan shrink-0" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-black/40 border border-gray-700 focus:border-cyber-cyan text-gray-100 px-2 sm:px-3 py-2 font-mono text-xs sm:text-sm outline-none transition-all rounded"
                />
              </div>

              {/* 情绪筛选 */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-cyber-yellow shrink-0" />
                <select
                  value={moodFilter}
                  onChange={(e) => {
                    setMoodFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-black/40 border border-gray-700 focus:border-cyber-cyan text-gray-100 px-2 sm:px-3 py-2 font-mono text-xs sm:text-sm outline-none transition-all rounded"
                >
                  <option value="all">ALL_MOODS</option>
                  <option value="high">HIGH (8-10)</option>
                  <option value="medium">MEDIUM (5-7)</option>
                  <option value="low">LOW (1-4)</option>
                </select>
              </div>

              {/* 搜索框 */}
              <div className="flex items-center gap-2">
                <Search size={16} className="text-cyber-cyan shrink-0" />
                <input
                  type="text"
                  placeholder="SEARCH..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-gray-700 focus:border-cyber-cyan text-gray-100 px-2 sm:px-3 py-2 font-mono text-xs sm:text-sm outline-none transition-all rounded placeholder-gray-700"
                />
              </div>

              {/* 重置按钮 */}
              <div className="flex items-center justify-end">
                <CyberButton
                  variant="secondary"
                  onClick={handleResetFilters}
                  className="w-full"
                >
                  <X size={14} />
                  RESET
                </CyberButton>
              </div>
            </div>
          </CyberCard>

          {/* 统计信息 */}
          <div className="flex items-center justify-between text-gray-500 font-mono text-sm px-2 shrink-0">
            <span>TOTAL_RECORDS: {total}</span>
            <span>PAGE: {page}/{totalPages || 1}</span>
          </div>

          {/* 复盘列表 */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-cyber-cyan font-mono text-sm animate-pulse">
                    LOADING_DATA...
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-cyber-pink font-mono text-sm">
                    ERROR: {error}
                  </div>
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <History size={64} className="text-gray-700" />
                  <div className="text-center">
                    <p className="text-gray-500 font-mono text-lg mb-2">NO_DATA_DETECTED</p>
                    <p className="text-gray-600 font-mono text-sm">No reviews found in this time range</p>
                  </div>
                </div>
              ) : (
                filteredReviews.map((review) => (
                  <ReviewListCard
                    key={review.id}
                    review={review}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-800 pt-4 shrink-0">
              <div className="text-gray-500 font-mono text-sm">
                SHOWING {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} OF {total}
              </div>
              <div className="flex items-center gap-2">
                <CyberButton
                  variant="secondary"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3"
                >
                  <ChevronLeft size={16} />
                </CyberButton>
                <span className="text-cyber-cyan font-mono text-sm px-4">
                  {page} / {totalPages}
                </span>
                <CyberButton
                  variant="secondary"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3"
                >
                  <ChevronRight size={16} />
                </CyberButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 详情弹窗 */}
      <ReviewDetailModal
        review={selectedReview}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReview(undefined);
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default ReviewPage;
