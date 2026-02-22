# 速率限制配置文档

## 概述

WebNote 后端使用 `@fastify/rate-limit` 插件实现 API 速率限制，防止恶意请求和滥用，保护服务器资源。

## 当前配置

### 默认配置

配置位置：[packages/backend/src/server.ts](../packages/backend/src/server.ts#L104-L107)

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})
```

### 配置参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `max` | 100 | 时间窗口内允许的最大请求数 |
| `timeWindow` | 1 minute | 时间窗口大小（1分钟） |

### 限制规则

- **默认限制**：每个 IP 地址每分钟最多 100 个请求
- **超出限制响应**：HTTP 429 Too Many Requests
- **重试机制**：客户端需等待时间窗口重置后重试

## 工作原理

### 请求计数

1. Fastify 为每个客户端 IP 地址维护一个请求计数器
2. 每个请求到达时，计数器递增
3. 时间窗口重置时，计数器清零

### 响应头

速率限制插件会在响应中添加以下头部：

| 响应头 | 说明 |
|--------|------|
| `x-ratelimit-limit` | 时间窗口内允许的最大请求数 |
| `x-ratelimit-remaining` | 当前时间窗口内剩余的请求数 |
| `x-ratelimit-reset` | 时间窗口重置的时间戳 |

### 超出限制时的响应

当请求超过限制时，服务器返回：

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 60 seconds"
}
```

## 自定义配置

### 修改默认限制

编辑 `packages/backend/src/server.ts` 文件：

```typescript
app.register(rateLimit, {
  max: 200,              // 增加到每分钟 200 个请求
  timeWindow: '1 minute'
})
```

### 不同环境配置

可以通过环境变量配置速率限制：

```typescript
app.register(rateLimit, {
  max: process.env.RATE_LIMIT_MAX 
    ? parseInt(process.env.RATE_LIMIT_MAX) 
    : 100,
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute'
})
```

然后在 `.env` 文件中设置：

```bash
# 开发环境 - 较宽松的限制
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=1 minute

# 生产环境 - 较严格的限制
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
```

### 针对特定路由配置

可以为不同路由设置不同的速率限制：

```typescript
// 全局配置
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})

// 认证路由 - 更严格的限制
app.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  keyGenerator: (request) => `auth:${request.ip}`
}, { prefix: '/api/auth' })

// 公开 API - 更宽松的限制
app.register(rateLimit, {
  max: 1000,
  timeWindow: '1 minute'
}, { prefix: '/api/public' })
```

## 生产环境建议配置

### 推荐配置

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  cache: 10000,                    // 缓存 10000 个客户端
  allowList: ['127.0.0.1'],        // 白名单 IP
  redis: process.env.REDIS_URL,    // 使用 Redis 存储（分布式环境）
  skipOnError: true,               // Redis 错误时跳过限制
  nameSpace: 'webnote-rate-limit'  // Redis 命名空间
})
```

### 环境变量配置

```bash
# .env.production
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
RATE_LIMIT_CACHE=10000
REDIS_URL=redis://localhost:6379
```

### 白名单配置

对于内部服务或监控端点，可以配置白名单：

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  allowList: [
    '127.0.0.1',           // 本地回环
    '::1',                 // IPv6 本地回环
    '10.0.0.0/8',          // 内网 IP 段
    '172.16.0.0/12',       // 内网 IP 段
    '192.168.0.0/16'       // 内网 IP 段
  ]
})
```

## 监控与日志

### 查看速率限制日志

速率限制事件会记录在 Fastify 日志中：

```bash
# 查看后端日志
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/out.log | grep rate"

# 或使用 PM2 日志
ssh root@120.26.50.152 "pm2 logs webnote-backend | grep rate"
```

### 监控指标

建议监控以下指标：

1. **429 响应数量**：监控被限制的请求数量
2. **速率限制触发频率**：识别潜在的攻击或滥用
3. **IP 分布**：识别异常的 IP 地址

### 添加监控钩子

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  onExceeded: (request) => {
    app.log.warn({
      ip: request.ip,
      url: request.url,
      userAgent: request.headers['user-agent']
    }, 'Rate limit exceeded')
  }
})
```

## 常见问题解答

### 1. 为什么我的请求被限制了？

**可能原因**：
- 短时间内发送了过多请求
- 共享 IP 地址（如公司网络、VPN）
- 前端代码存在循环请求

**解决方法**：
- 检查前端代码，避免不必要的重复请求
- 实现请求队列和节流
- 联系管理员添加 IP 到白名单

### 2. 如何临时禁用速率限制？

**开发环境**：

```typescript
if (process.env.NODE_ENV !== 'production') {
  // 开发环境不启用速率限制
  // 不注册 rateLimit 插件
} else {
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  })
}
```

**注意**：生产环境强烈建议保持速率限制启用。

### 3. 速率限制会影响 WebSocket 连接吗？

不会。速率限制仅对 HTTP 请求生效，WebSocket 连接不受影响。

### 4. 如何为不同用户设置不同的限制？

可以通过自定义 `keyGenerator` 实现：

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    // 认证用户使用用户 ID
    const userId = (request as any).user?.id
    if (userId) {
      return `user:${userId}`
    }
    // 未认证用户使用 IP
    return `ip:${request.ip}`
  }
})
```

### 5. 分布式环境如何处理速率限制？

使用 Redis 作为共享存储：

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis: redis,
  nameSpace: 'webnote-rate-limit'
})
```

### 6. 如何查看当前速率限制状态？

检查响应头：

```bash
curl -I http://localhost:3000/api/health

# 响应头示例
x-ratelimit-limit: 100
x-ratelimit-remaining: 99
x-ratelimit-reset: 1705312345
```

### 7. 速率限制和 CORS 有什么关系？

它们是独立的功能：
- **CORS**：控制哪些来源可以访问 API
- **速率限制**：控制请求频率

两者共同保护 API 安全。

## 最佳实践

### 1. 合理设置限制值

| 场景 | 建议值 | 说明 |
|------|--------|------|
| 公开 API | 60-100/分钟 | 防止滥用 |
| 认证 API | 10-20/分钟 | 防止暴力破解 |
| 内部 API | 1000+/分钟 | 内部服务调用 |
| 文件上传 | 10-20/分钟 | 减少服务器负载 |

### 2. 前端配合

前端应实现：
- 请求节流（throttle）
- 请求防抖（debounce）
- 429 错误自动重试（带退避策略）

```typescript
// 前端示例
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options)
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || 60
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      continue
    }
    return response
  }
  throw new Error('Max retries exceeded')
}
```

### 3. 文档化限制

在 API 文档中明确说明速率限制：
- 限制值
- 时间窗口
- 响应格式
- 重试策略

### 4. 监控和告警

设置告警规则：
- 429 错误率超过阈值
- 特定 IP 触发限制次数过多
- 速率限制服务异常

## 相关资源

- [Fastify Rate Limit 文档](https://github.com/fastify/fastify-rate-limit)
- [API 安全最佳实践](https://owasp.org/www-project-api-security/)
- [HTTP 429 状态码规范](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)

---

**文档版本**: 1.0  
**创建日期**: 2026-02-21  
**最后更新**: 2026-02-21
