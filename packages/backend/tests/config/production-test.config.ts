/**
 * 生产环境测试配置
 * 自动生成于 2026-01-19T09:59:23.094Z
 */

import type { TestConfig, UserCredentials } from './types';

export const config: TestConfig = {
  // 服务器配置
  serverUrl: 'http://120.26.50.152',
  wsUrl: 'ws://120.26.50.152',
  apiUrl: 'http://120.26.50.152/api',
  
  // 测试用户凭证
  users: {
    user1: {
      id: 2,
      username: 'sync-test-user',
      email: 'sync-test-user@webnote.test',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJzeW5jLXRlc3QtdXNlciIsImlhdCI6MTc2ODgxNjc2Mn0.lVU21ff8Bmu7MY3y7CHKyMVGE6dJvDe7Esx9Pk2297o',
    } as UserCredentials,
    
    user2: {
      id: 3,
      username: 'sync-test-user2',
      email: 'sync-test-user2@webnote.test',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywidXNlcm5hbWUiOiJzeW5jLXRlc3QtdXNlcjIiLCJpYXQiOjE3Njg4MTY3NjN9.pGhkRw2Bbxk3kuePM5TUopeQUxYufzQIXj7Q7T0FAH0',
    } as UserCredentials,
  },
  
  // 测试配置
  test: {
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    
    // 性能基准
    benchmarks: {
      smallDataSize: 100,    // 小数据量：100条记录
      mediumDataSize: 500,   // 中数据量：500条记录
      largeDataSize: 1000,   // 大数据量：1000条记录
      
      // 响应时间基准（毫秒）
      maxResponseTime: {
        sync: 1000,      // 同步操作
        query: 500,      // 查询操作
        create: 500,      // 创建操作
        update: 500,      // 更新操作
        delete: 300,      // 删除操作
      },
    },
    
    // 数据前缀，用于清理测试数据
    dataPrefix: '[TEST]',
  },
};

export function generateTestTitle(prefix: string, index: number): string {
  return `[TEST] ${prefix} - ${index} - ${Date.now()}`;
}

export default config;
