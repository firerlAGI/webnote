import { Button, Card } from '../components/ui';

const Home = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">欢迎回来，用户！</h1>
        <p className="mb-6 opacity-90">继续你的笔记和复盘之旅</p>
        <div className="flex space-x-4">
          <Button variant="white" size="lg">
            创建笔记
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="text-white border-white hover:bg-white/10"
          >
            今日复盘
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mr-4">
              <svg
                className="h-6 w-6 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">笔记管理</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            创建、编辑和组织你的笔记，支持Markdown格式
          </p>
          <Button variant="primary" asChild>
            <a href="/notes">查看笔记</a>
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mr-4">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">每日复盘</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            记录每日成就、改进点和计划，跟踪个人成长
          </p>
          <Button variant="primary" asChild>
            <a href="/reviews">查看复盘</a>
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mr-4">
              <svg
                className="h-6 w-6 text-purple-600 dark:text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">文件夹</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            分类组织你的笔记，建立清晰的知识体系
          </p>
          <Button variant="primary" asChild>
            <a href="/folders">管理文件夹</a>
          </Button>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">最近活动</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">
                创建了新笔记 <span className="font-medium">项目计划</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">2小时前</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">
                更新了笔记 <span className="font-medium">技术文档</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">昨天</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">完成了每日复盘</p>
              <p className="text-xs text-gray-400 mt-1">昨天</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Home;
