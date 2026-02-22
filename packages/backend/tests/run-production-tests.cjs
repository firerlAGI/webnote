#!/usr/bin/env node

/**
 * 生产环境集成测试执行脚本
 * 对生产服务器执行同步功能测试
 */

const fs = require('fs');
const path = require('path');

// 加载测试配置
const configPath = path.join(__dirname, 'config', 'production-test.config.ts');
const configContent = fs.readFileSync(configPath, 'utf-8');

// 提取配置（简单解析）
const serverUrl = 'http://120.26.50.152/api';
const user1Token = configContent.match(/token: '([^']+)'/)?.[1] || '';
const user1Id = 2;
const user2Id = 3;

if (!user1Token) {
  console.error('❌ 未找到Token，请先运行 node scripts/get-tokens-v2.cjs');
  process.exit(1);
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP请求函数
async function apiRequest(endpoint, options = {}) {
  const url = `${serverUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  return { status: response.status, data };
}

// 测试套件
const testSuite = {
  P0: [
    {
      name: '创建笔记',
      description: '用户能够成功创建笔记',
      async test() {
        const result = await apiRequest('/notes', {
          method: 'POST',
          token: user1Token,
          body: JSON.stringify({
            title: '[TEST] 测试笔记',
            content: '这是一个测试笔记',
          }),
        });
        
        if (result.status !== 201) {
          throw new Error(`创建失败: ${JSON.stringify(result.data)}`);
        }
        
        return result.data.data.id;
      },
    },
    {
      name: '获取笔记列表',
      description: '用户能够获取笔记列表',
      async test() {
        const result = await apiRequest('/notes', { token: user1Token });
        
        if (result.status !== 200) {
          throw new Error(`获取失败: ${JSON.stringify(result.data)}`);
        }
        
        const testNotes = result.data.data.notes.filter(n => 
          n.title.includes('[TEST]')
        );
        
        log(`✓ 找到 ${testNotes.length} 条测试笔记`, 'green');
        return testNotes;
      },
    },
    {
      name: '更新笔记',
      description: '用户能够更新笔记',
      async test(noteId) {
        const result = await apiRequest(`/notes/${noteId}`, {
          method: 'PUT',
          token: user1Token,
          body: JSON.stringify({
            title: '[TEST] 更新后的笔记',
            content: '更新后的内容',
          }),
        });
        
        if (result.status !== 200) {
          throw new Error(`更新失败: ${JSON.stringify(result.data)}`);
        }
        
        log(`✓ 笔记更新成功`, 'green');
        return result.data.data;
      },
    },
    {
      name: '创建文件夹',
      description: '用户能够创建文件夹',
      async test() {
        const result = await apiRequest('/folders', {
          method: 'POST',
          token: user1Token,
          body: JSON.stringify({
            name: '[TEST] 测试文件夹',
          }),
        });
        
        if (result.status !== 201) {
          throw new Error(`创建失败: ${JSON.stringify(result.data)}`);
        }
        
        log(`✓ 文件夹创建成功 (ID: ${result.data.data.id})`, 'green');
        return result.data.data.id;
      },
    },
  ],
};

// 执行测试
async function runTests() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🚀 生产环境数据同步测试', 'cyan');
  log('='.repeat(70), 'cyan');
  log(`服务器: ${serverUrl}`);
  log(`用户1 ID: ${user1Id}`);
  log(`用户2 ID: ${user2Id}`);
  log('='.repeat(70), 'cyan');

  const results = {
