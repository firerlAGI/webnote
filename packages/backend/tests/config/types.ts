/**
 * 测试配置类型定义
 */

export interface UserCredentials {
  id: number;
  username: string;
  email: string;
  token: string;
}

export interface TestConfig {
  // 服务器配置
  serverUrl: string;
  wsUrl: string;
  apiUrl: string;
  
  // 测试用户凭证
  users: {
    user1: UserCredentials;
    user2: UserCredentials;
  };
  
  // 测试配置
  test: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    
    // 性能基准
    benchmarks: {
      smallDataSize: number;
      mediumDataSize: number;
      largeDataSize: number;
      
      // 响应时间基准（毫秒）
      maxResponseTime: {
        sync: number;
        query: number;
        create: number;
        update: number;
        delete: number;
      };
    };
    
    // 数据前缀，用于清理测试数据
    dataPrefix: string;
  };
}
