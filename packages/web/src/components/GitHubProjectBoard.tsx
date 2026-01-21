import React, { useState, useEffect } from 'react';
import { Clock, GitCommit, GitBranch, GitPullRequest, AlertCircle, CheckCircle, Activity, Users, Star, GitFork } from 'lucide-react';

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

interface ProjectStats {
  totalCommits: number;
  branches: number;
  contributors: number;
  stars: number;
  forks: number;
  issues: {
    open: number;
    closed: number;
  };
  pullRequests: {
    open: number;
    merged: number;
  };
}

interface GitHubProjectBoardProps {
  owner?: string;
  repo?: string;
  autoRefresh?: number; // 刷新间隔（毫秒）
}

const GitHubProjectBoard: React.FC<GitHubProjectBoardProps> = ({
  owner = 'firerlAGI',
  repo = 'webnote',
  autoRefresh = 30000
}) => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取提交历史
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`
      );
      if (!commitsResponse.ok) throw new Error('获取提交数据失败');
      const commitsData = await commitsResponse.json();
      setCommits(commitsData);

      // 获取仓库信息
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`
      );
      if (!repoResponse.ok) throw new Error('获取仓库信息失败');
      const repoData = await repoResponse.json();

      // 获取分支数量
      const branchesResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches`
      );
      const branchesData = await branchesResponse.ok ? await branchesResponse.json() : [];

      // 获取贡献者
      const contributorsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contributors`
      );
      const contributorsData = contributorsResponse.ok ? await contributorsResponse.json() : [];

      // 获取Issues
      const issuesResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`
      );
      const openIssues = issuesResponse.ok ? await issuesResponse.json() : [];

      // 获取Pull Requests
      const prsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`
      );
      const prsData = prsResponse.ok ? await prsResponse.json() : [];

      setStats({
        totalCommits: repoData.size || 0,
        branches: branchesData.length || 0,
        contributors: contributorsData.length || 0,
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        issues: {
          open: Array.isArray(openIssues) ? openIssues.length : 0,
          closed: repoData.closed_issues_count || 0
        },
        pullRequests: {
          open: prsData.filter((pr: any) => pr.state === 'open').length,
          merged: prsData.filter((pr: any) => pr.merged_at).length
        }
      });

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
      console.error('GitHub API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    if (autoRefresh > 0) {
      const interval = setInterval(fetchData, autoRefresh);
      return () => clearInterval(interval);
    }
  }, [owner, repo, autoRefresh]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
    return `${Math.floor(seconds / 86400)} 天前`;
  };

  const truncateMessage = (message: string, maxLength: number = 80) => {
    const firstLine = message.split('\n')[0];
    return firstLine.length > maxLength ? firstLine.substring(0, maxLength) + '...' : firstLine;
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 bg-black/30 border border-cyan-500/30 rounded-lg">
        <div className="text-cyan-400 flex items-center gap-2">
          <Activity className="animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            icon={<GitCommit className="w-5 h-5" />}
            label="提交"
            value={stats.totalCommits}
            color="cyan"
          />
          <StatCard
            icon={<GitBranch className="w-5 h-5" />}
            label="分支"
            value={stats.branches}
            color="purple"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="贡献者"
            value={stats.contributors}
            color="green"
          />
          <StatCard
            icon={<Star className="w-5 h-5" />}
            label="星标"
            value={stats.stars}
            color="yellow"
          />
          <StatCard
            icon={<GitFork className="w-5 h-5" />}
            label="Fork"
            value={stats.forks}
            color="blue"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Issues"
            value={stats.issues.open}
            color="red"
          />
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 提交历史 */}
        <div className="lg:col-span-2 bg-black/40 border border-cyan-500/30 rounded-lg overflow-hidden">
          <div className="bg-cyan-500/10 px-4 py-3 border-b border-cyan-500/30 flex items-center justify-between">
            <h2 className="text-cyan-400 font-semibold flex items-center gap-2">
              <GitCommit className="w-5 h-5" />
              最近提交
            </h2>
            <button
              onClick={fetchData}
              className="text-xs px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded border border-cyan-500/30 transition-colors"
            >
              刷新
            </button>
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {error ? (
              <div className="text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            ) : commits.length === 0 ? (
              <div className="text-gray-400 text-center py-8">暂无提交记录</div>
            ) : (
              commits.map((commit) => (
                <CommitItem
                  key={commit.sha}
                  commit={commit}
                  formatTimeAgo={formatTimeAgo}
                  truncateMessage={truncateMessage}
                />
              ))
            )}
          </div>
        </div>

        {/* 项目状态 */}
        <div className="space-y-6">
          {/* Issues 状态 */}
          {stats && (
            <div className="bg-black/40 border border-purple-500/30 rounded-lg overflow-hidden">
              <div className="bg-purple-500/10 px-4 py-3 border-b border-purple-500/30">
                <h2 className="text-purple-400 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Issues 状态
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">开放中</span>
                  <span className="text-green-400 font-semibold">{stats.issues.open}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">已关闭</span>
                  <span className="text-purple-400 font-semibold">{stats.issues.closed}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                    style={{
                      width: `${(stats.issues.open / (stats.issues.open + stats.issues.closed || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pull Requests 状态 */}
          {stats && (
            <div className="bg-black/40 border border-green-500/30 rounded-lg overflow-hidden">
              <div className="bg-green-500/10 px-4 py-3 border-b border-green-500/30">
                <h2 className="text-green-400 font-semibold flex items-center gap-2">
                  <GitPullRequest className="w-5 h-5" />
                  Pull Requests
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">开放中</span>
                  <span className="text-yellow-400 font-semibold">{stats.pullRequests.open}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">已合并</span>
                  <span className="text-green-400 font-semibold">{stats.pullRequests.merged}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                    style={{
                      width: `${(stats.pullRequests.merged / (stats.pullRequests.open + stats.pullRequests.merged || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 最后更新 */}
          <div className="bg-black/40 border border-blue-500/30 rounded-lg overflow-hidden">
            <div className="bg-blue-500/10 px-4 py-3 border-b border-blue-500/30">
              <h2 className="text-blue-400 font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                数据更新
              </h2>
            </div>
            <div className="p-4">
              <div className="text-gray-300 text-sm">
                最后更新：{lastUpdated.toLocaleString('zh-CN')}
              </div>
              {autoRefresh > 0 && (
                <div className="text-gray-500 text-xs mt-2">
                  自动刷新：{autoRefresh / 1000} 秒
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'cyan' | 'purple' | 'green' | 'yellow' | 'blue' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    green: 'text-green-400 border-green-500/30 bg-green-500/10',
    yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    red: 'text-red-400 border-red-500/30 bg-red-500/10'
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]} backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
};

interface CommitItemProps {
  commit: Commit;
  formatTimeAgo: (date: string) => string;
  truncateMessage: (message: string, maxLength?: number) => string;
}

const CommitItem: React.FC<CommitItemProps> = ({ commit, formatTimeAgo, truncateMessage }) => {
  return (
    <a
      href={commit.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-black/30 hover:bg-black/50 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-cyan-400 font-medium group-hover:text-cyan-300 transition-colors text-sm mb-1">
            {truncateMessage(commit.commit.message)}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span>{commit.commit.author.name}</span>
            <span>•</span>
            <span>{formatTimeAgo(commit.commit.author.date)}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {commit.sha.substring(0, 7)}
        </div>
      </div>
    </a>
  );
};

export default GitHubProjectBoard;
