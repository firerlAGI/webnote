import { useState } from 'react';
import { authAPI } from '../api';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  duration?: number;
}

export default function ConnectionTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3000/api');

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const resetTests = () => {
    setTestResults([]);
  };

  const authenticatedRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = localStorage.getItem('test_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Ensure apiUrl doesn't end with slash if endpoint starts with one
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  };

  const runTests = async () => {
    setIsRunning(true);
    resetTests();

    // Test 1: Health Check
    await runTest('健康检查', async () => {
      const start = Date.now();
      const response = await fetch(`${apiUrl.replace('/api', '')}/health`);
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `状态: ${data.status}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(`HTTP ${response.status}`);
    });

    // Test 2: Register Test User
    await runTest('注册测试用户', async () => {
      const start = Date.now();
      const testEmail = `test_${Date.now()}@example.com`;
      const response = await authAPI.register('testuser', testEmail, 'testpassword123');
      const duration = Date.now() - start;
      
      if (response.data.success) {
        localStorage.setItem('test_token', response.data.data.token);
        localStorage.setItem('test_user', JSON.stringify(response.data.data.user));
        return { success: true, message: `用户ID: ${response.data.data.user.id}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(response.data.error || '注册失败');
    });

    // Test 3: Login
    await runTest('用户登录', async () => {
      const start = Date.now();
      const testEmail = `test_${Date.now()}@example.com`;
      const response = await authAPI.login(testEmail, 'testpassword123');
      const duration = Date.now() - start;
      
      if (response.data.success) {
        localStorage.setItem('test_token', response.data.data.token);
        return { success: true, message: `登录成功, Token长度: ${response.data.data.token.length}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(response.data.error || '登录失败');
    });

    // Test 4: Get User Info
    await runTest('获取用户信息', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/user/me');
      const duration = Date.now() - start;
      
      if (data.success) {
        return { success: true, message: `用户: ${data.data.username}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '获取用户信息失败');
    });

    // Test 5: Create Folder
    await runTest('创建文件夹', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/folders', 'POST', { name: '测试文件夹' });
      const duration = Date.now() - start;
      
      if (data.success) {
        localStorage.setItem('test_folder_id', data.data.id.toString());
        return { success: true, message: `文件夹ID: ${data.data.id}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '创建文件夹失败');
    });

    // Test 6: Create Note
    await runTest('创建笔记', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/notes', 'POST', {
        title: '测试笔记',
        content: '这是一条测试笔记内容',
        is_pinned: true
      });
      const duration = Date.now() - start;
      
      if (data.success) {
        localStorage.setItem('test_note_id', data.data.id.toString());
        return { success: true, message: `笔记ID: ${data.data.id}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '创建笔记失败');
    });

    // Test 7: Get Notes
    await runTest('获取笔记列表', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/notes');
      const duration = Date.now() - start;
      
      if (data.success) {
        const { notes, pagination } = data.data;
        return { success: true, message: `共 ${pagination.total} 条笔记, 当前页 ${notes.length} 条, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '获取笔记失败');
    });

    // Test 8: Create Review
    await runTest('创建复盘', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/reviews/detailed', 'POST', {
        date: new Date().toISOString().split('T')[0],
        content: '这是一条测试复盘内容',
        mood: 4,
        achievements: ['完成测试'],
        improvements: ['改进测试'],
        plans: ['计划测试']
      });
      const duration = Date.now() - start;
      
      if (data.success) {
        localStorage.setItem('test_review_id', data.data.id.toString());
        return { success: true, message: `复盘ID: ${data.data.id}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '创建复盘失败');
    });

    // Test 9: Create Backup
    await runTest('创建备份', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/backups', 'POST', { type: 'manual' });
      const duration = Date.now() - start;
      
      if (data.success) {
        return { success: true, message: `备份ID: ${data.data.id}, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '创建备份失败');
    });

    // Test 10: Get Backups
    await runTest('获取备份列表', async () => {
      const start = Date.now();
      const data = await authenticatedRequest('/backups');
      const duration = Date.now() - start;
      
      if (data.success) {
        return { success: true, message: `共 ${data.data.length} 个备份, 耗时: ${duration}ms`, duration };
      }
      throw new Error(data.error || '获取备份失败');
    });

    setIsRunning(false);
  };

  const runTest = async (name: string, testFn: () => Promise<{ success: boolean; message: string; duration: number }>) => {
    addTestResult({ name, status: 'pending', message: '执行中...' });
    
    try {
      const result = await testFn();
      addTestResult({ 
        name, 
        status: 'success', 
        message: result.message,
        duration: result.duration
      });
    } catch (error) {
      addTestResult({ 
        name, 
        status: 'error', 
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  const successCount = testResults.filter(r => r.status === 'success').length;
  const errorCount = testResults.filter(r => r.status === 'error').length;
  const totalDuration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

  return (
    <div className="h-full bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          前后端连接测试
        </h1>
        <p className="text-gray-400 text-center mb-8">验证前后端 API 通信是否正常</p>

        {/* API URL Configuration */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-2xl mr-2">⚙️</span>
            API 配置
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">后端 API 地址</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="http://localhost:3000/api"
              />
            </div>
          </div>
        </div>

        {/* Test Summary */}
        {testResults.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="text-2xl mr-2">📊</span>
              测试摘要
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{successCount}</div>
                <div className="text-gray-400">成功</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-400">{errorCount}</div>
                <div className="text-gray-400">失败</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{totalDuration}</div>
                <div className="text-gray-400">总耗时 (ms)</div>
              </div>
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <span className="text-2xl mr-2">🧪</span>
              测试结果
            </h2>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {isRunning ? '测试中...' : '运行测试'}
            </button>
          </div>
          
          {testResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              点击"运行测试"按钮开始测试
            </div>
          ) : (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    result.status === 'success' ? 'bg-green-900/20 border-green-800' :
                    result.status === 'error' ? 'bg-red-900/20 border-red-800' :
                    'bg-gray-700/20 border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {result.status === 'success' ? '✅' :
                       result.status === 'error' ? '❌' : '⏳'}
                    </span>
                    <div>
                      <div className="font-medium">{result.name}</div>
                      <div className="text-sm text-gray-400">{result.message}</div>
                    </div>
                  </div>
                  {result.duration && (
                    <div className="text-sm text-gray-400">{result.duration}ms</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection Info */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-2xl mr-2">🔌</span>
            连接信息
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">前端地址:</span>
              <span className="font-mono">{window.location.origin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">后端地址:</span>
              <span className="font-mono">{apiUrl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token:</span>
              <span className="font-mono">{localStorage.getItem('test_token') ? '已设置 ✓' : '未设置'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
