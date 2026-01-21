# WebNote 部署鉴权配置指南

## 问题说明

在生产环境部署时，用户鉴权功能需要正确配置才能正常工作。主要涉及以下配置项：

1. **JWT_SECRET** - 用于生成和验证 JWT 令牌的密钥
2. **ALLOWED_ORIGINS** - 允许的跨域来源列表
3. **Nginx 配置** - 确保鉴权头被正确传递

## 配置步骤

### 1. 生成强密钥

在生产环境中，必须使用强密钥来保护 JWT 令牌。可以使用以下方法生成：

```bash
# 方法1: 使用 OpenSSL
openssl rand -base64 32

# 方法2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方法3: 使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

生成的密钥应该是至少 32 个字符的随机字符串。

### 2. 配置 .env 文件

编辑 `deploy/backend/.env.production` 文件（或直接编辑 `deploy/backend/.env`）：

```bash
# 数据库配置
DATABASE_URL="file:./dev.db"

# JWT 密钥（⚠️ 必须修改为上面生成的强密钥！）
JWT_SECRET="你的强密钥-至少32个字符"

# 允许的跨域来源（必须包含生产环境域名）
ALLOWED_ORIGINS="http://120.26.50.152,http://www.120.26.50.152"

# 服务器端口
PORT=3000

# 环境标识
NODE_ENV="production"
```

**重要提示：**
- `JWT_SECRET` 不能使用默认值，必须修改为强密钥
- `ALLOWED_ORIGINS` 必须包含生产环境域名
- 如果你有自定义域名，也需要添加到 `ALLOWED_ORIGINS`

### 3. Nginx 配置

Nginx 配置已自动包含 `Authorization` header 的传递规则：

```nginx
location /api {
    proxy_pass http://localhost:3000;
    # ... 其他配置 ...
    proxy_set_header Authorization $http_authorization;
}
```

这确保了前端的 JWT 令牌能够正确传递到后端。

### 4. 部署

使用更新后的部署脚本：

```bash
# 部署前会自动检查配置
bash deploy.sh
```

部署脚本会自动检查：
- `.env.production` 文件是否存在
- `JWT_SECRET` 是否仍为默认值

如果检查失败，部署会停止，提示你修复配置。

## 验证鉴权功能

部署完成后，可以通过以下步骤验证鉴权功能：

### 1. 测试用户注册

```bash
curl -X POST http://120.26.50.152/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

应该返回包含 `token` 的响应。

### 2. 测试受保护的 API

使用上面获取的 token 测试受保护的 API：

```bash
curl -X GET http://120.26.50.152/api/user/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

应该返回用户信息。

### 3. 测试无效令牌

```bash
curl -X GET http://120.26.50.152/api/user/me \
  -H "Authorization: Bearer invalid-token"
```

应该返回 401 错误。

## 常见问题

### Q1: 部署后无法登录

**可能原因：**
- JWT_SECRET 仍为默认值
- ALLOWED_ORIGINS 未包含生产环境域名

**解决方案：**
检查 `.env` 文件中的配置是否正确。

### Q2: 前端显示 "Unauthorized" 错误

**可能原因：**
- Token 未正确存储在 localStorage
- Token 已过期
- Nginx 未正确传递 Authorization header

**解决方案：**
1. 打开浏览器开发者工具，检查 localStorage 中是否有 `token`
2. 检查 Network 面板，确认请求中是否包含 `Authorization` header
3. 检查 Nginx 配置是否包含 `proxy_set_header Authorization $http_authorization;`

### Q3: CORS 错误

**可能原因：**
- ALLOWED_ORIGINS 未包含前端域名

**解决方案：**
在 `.env` 文件中添加前端域名到 `ALLOWED_ORIGINS`。

## 安全建议

1. **永远不要在代码中硬编码 JWT_SECRET**
   - 使用环境变量
   - 不要将 `.env` 文件提交到版本控制

2. **定期更换 JWT_SECRET**
   - 建议每 3-6 个月更换一次
   - 更换后所有用户的 token 会失效，需要重新登录

3. **使用 HTTPS**
   - 生产环境应使用 HTTPS
   - 防止 token 在传输过程中被截获

4. **设置合理的 token 过期时间**
   - 当前配置为永久有效（在 server.ts 中配置）
   - 建议设置合理的过期时间（如 7 天或 30 天）

5. **监控异常登录**
   - 记录失败的登录尝试
   - 设置速率限制防止暴力破解

## 相关文件

- `packages/backend/src/server.ts` - JWT 配置和中间件
- `packages/backend/src/api/routes.ts` - API 路由和鉴权逻辑
- `packages/web/src/api/index.ts` - 前端 API 客户端和拦截器
- `deploy/nginx.conf` - Nginx 配置
- `deploy/backend/.env` - 后端环境变量
- `deploy.sh` - 部署脚本

## 更多信息

- [JWT 官方文档](https://jwt.io/)
- [Fastify JWT 插件文档](https://github.com/fastify/fastify-jwt)
- [Nginx 代理文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
