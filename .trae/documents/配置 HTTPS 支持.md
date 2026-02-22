## HTTPS 配置计划

### 目标
为 WebNote 项目启用 HTTPS 加密，使用 Let's Encrypt 免费证书

### 实施步骤

#### 1. 准备 SSL 证书（服务器端）
- 在服务器上安装 Certbot
- 使用 Certbot 获取 Let's Encrypt 证书
- 设置自动续期

#### 2. 更新 Nginx 配置
- 修改 `/etc/nginx/sites-available/webnote` 或 `/etc/nginx/sites-enabled/webnote`
- 添加 HTTPS 监听端口（443）
- 配置 SSL 证书路径
- 添加 HTTP 到 HTTPS 的重定向
- 配置 SSL 安全头部（HSTS, 安全协议等）
- 优化 SSL 配置（现代密码套件）

#### 3. 更新后端配置
- 更新 `ALLOWED_ORIGINS` 环境变量，添加 HTTPS 地址
- 确保 CORS 配置支持 HTTPS 来源

#### 4. 更新前端配置
- 更新 API 基础 URL 为 HTTPS
- 更新 WebSocket URL 为 wss://
- 确保环境变量配置正确

#### 5. 更新部署脚本
- 修改 `scripts/deploy.sh`，包含 HTTPS 配置
- 更新 Nginx 配置模板

#### 6. 验证部署
- 测试 HTTPS 访问
- 测试 HTTP 到 HTTPS 重定向
- 验证 API 调用
- 验证 WebSocket 连接

### 关键配置变更

**Nginx 主要变更：**
- 添加 `listen 443 ssl;`
- 配置 `ssl_certificate` 和 `ssl_certificate_key`
- 添加 `return 301 https://$server_name$request_uri;` 重定向规则
- 配置 SSL 安全头部

**环境变量变更：**
- `ALLOWED_ORIGINS` 添加 `https://120.26.50.152`

**前端 API 配置：**
- 生产环境使用相对路径 `/api`（已支持 HTTPS）
- 确保 WebSocket 使用 wss:// 协议

### 优势
- 数据传输加密，提高安全性
- 提升用户信任度
- 满足现代 Web 安全标准
- 符合浏览器安全要求