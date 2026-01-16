import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Github } from 'lucide-react';
import { CyberScrambleText } from '../components/CyberUI';
import GitHubProjectBoard from '../components/GitHubProjectBoard';

const GitHubBoardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header */}
      <div className="relative z-10 mb-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-gray-800 rounded-lg hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all group"
          >
            <ArrowLeft size={18} className="text-gray-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-sm text-gray-400 group-hover:text-cyan-400 transition-colors">返回仪表板</span>
          </button>
          
          <div className="flex items-center gap-3">
            <Github size={24} className="text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">
              <CyberScrambleText text="项目监控中心" />
            </h1>
          </div>
        </div>

        {/* Subtitle */}
        <div className="text-center mb-8">
          <p className="text-gray-500 font-mono text-sm">
            REPOSITORY: <span className="text-cyan-400">firerlAGI/webnote</span>
          </p>
          <p className="text-gray-600 font-mono text-xs mt-1">
            STATUS: <span className="text-green-400">ACTIVE</span> | 
            SYNC: <span className="text-purple-400">REAL-TIME</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        <GitHubProjectBoard 
          owner="firerlAGI"
          repo="webnote"
          autoRefresh={30000}
        />
      </div>

      {/* Footer Info */}
      <div className="relative z-10 mt-8 text-center">
        <p className="text-gray-600 text-xs font-mono">
          Powered by GitHub API | Refresh Interval: 30s
        </p>
      </div>
    </div>
  );
};

export default GitHubBoardPage;
