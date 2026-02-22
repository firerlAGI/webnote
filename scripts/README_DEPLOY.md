# WebNote 部署指南

## 快速开始

### 一键部署（推荐）

```bash
# 赋予执行权限
chmod +x scripts/deploy.sh

# 执行部署
./scripts/deploy.sh
```

部署脚本会自动完成以下步骤：
1. 本地构建项目
2. 打包必要文件
3. 上传到服务器 (120.26.50.152)
4. 在服务器上执行部署
5. 运行数据库迁移
6. 重启服务
7. 健康检查
8. 显示服务日志

### 手动部署

如果需要手动部署，请参考 `packages/backend/scripts/DEPLOYMENT_GUIDE.md`

## 前置要求

### 本地环境
- Node.js 18.x+
- pnpm 包管理器
- SSH 访问权限

### 服务器环境
需要以下软件已安装：
- Node.js 18.x+
- PostgreSQL 14+
- Nginx
- PM2

首次部署前，需要在服务器上运行初始化：

```bash
ssh root@120.26.50.152

# 安装必要软件
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git
npm install -g pm2 pnpm

# 配置PostgreSQL
sudo -u postgres psql
CREATE DATABASE webnote;
CREATE USER webnote_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE webnote TO webnote_user;
\q
```

## 配置文件

### 1. 后端环境变量

在服务器上创建 `/var/www/webnote/backend/.env`：

```bash
ssh root@120.26.50.152

cd /var/www/webnote/backend
cat > .env << EOF
# 数据库配置
DATABASE_URL="postgresql://webnote_user:your_secure_password@localhost:5432/webnote"

# JWT密钥
JWT_SECRET="$(openssl rand -base64 32)"

# 服务器配置
PORT=3000
NODE_ENV=production

# CORS配置
ALLOWED_ORIGINS="http://120.26.50.152,https://120.26.50.152"
EOF

chmod 600 .env
```

### 2. Nginx 配置

```bash
# 创建Nginx配置
sudo nano /etc/nginx/sites-available/webnote
```

添加以下内容：

```nginx
server {
    listen 80;
    server_name 120.26.50.152;

    # 前端静态文件
    location / {
        root /var/www/webnote/web/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # 后端API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 10M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/webnote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. PM2 配置

在服务器上创建 `/var/www/webnote/backend/ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'webnote-backend',
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

## 部署流程

### 使用一键部署脚本

```bash
# 1. 确保所有更改已提交
git add .
git commit -m "准备部署"
git push

# 2. 执行部署脚本
./scripts/deploy.sh

# 3. 脚本会自动：
#    - 构建所有包
#    - 打并上传到服务器
#    - 备份现有版本
#    - 部署新版本
#    - 运行数据库迁移
#    - 重启服务
#    - 健康检查
```

### 部署脚本选项

```bash
# 部署到开发环境（默认）
./scripts/deploy.sh dev

# 部署到生产环境
./scripts/deploy.sh prod
```

## 验证部署

### 1. 检查服务状态

```bash
# SSH到服务器
ssh root@120.26.50.152

# 检查PM2服务
pm2 status

# 检查Nginx服务
sudo systemctl status nginx

# 检查PostgreSQL服务
sudo systemctl status postgresql

# 检查端口监听
sudo netstat -tulpn | grep -E ':(3000|80|443|5432)'
```

### 2. 测试API

```bash
# 测试健康检查
curl http://120.26.50.152/api/health

# 测试注册
curl -X POST http://120.26.50.152/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# 测试登录
curl -X POST http://120.26.50.152/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 3. 访问应用

- **前端**: http://120.26.50.152
- **后端API**: http://120.26.50.152/api

## 常用命令

### 查看日志

```bash
# PM2日志
ssh root@120.26.50.152 "pm2 logs webnote-backend --lines 100"

# 实时日志
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# Nginx日志
ssh root@120.26.50.152 "tail -f /var/log/nginx/access.log"
ssh root@120.26.50.152 "tail -f /var/log/nginx/error.log"
```

### 服务管理

```bash
# 重启后端
ssh root@120.26.50.152 "pm2 restart webnote-backend"

# 停止后端
ssh root@120.26.50.152 "pm2 stop webnote-backend"

# 重载Nginx
ssh root@120.26.50.152 "sudo systemctl reload nginx"

# 重启PostgreSQL
ssh root@120.26.50.152 "sudo systemctl restart postgresql"
```

### 数据库操作

```bash
# 连接到数据库
ssh root@120.26.50.152
sudo -u postgres psql -d webnote

# 查看所有表
\dt

# 查看用户
SELECT * FROM users;

# 退出
\q
```

## 故障排除

### 后端无法启动

```bash
# 检查端口占用
ssh root@120.26.50.152 "sudo lsof -i :3000"

# 检查环境变量
ssh root@120.26.50.152 "cat /var/www/webnote/backend/.env"

# 查看错误日志
ssh root@120.26.50.152 "pm2 logs webnote-backend --err"
```

### 数据库连接失败

```bash
# 测试数据库连接
ssh root@120.26.50.152 "sudo -u postgres psql -h localhost -U webnote_user -d webnote"

# 检查PostgreSQL状态
ssh root@120.26.50.152 "sudo systemctl status postgresql"

# 查看PostgreSQL日志
ssh root@120.26.50.152 "sudo tail -f /var/log/postgresql/postgresql-14-main.log"
```

### Nginx 502错误

```bash
# 检查后端是否运行
ssh root@120.26.50.152 "pm2 status"

# 测试后端端口
curl http://120.26.50.152:3000/api/health

# 检查Nginx配置
ssh root@120.26.50.152 "sudo nginx -t"
```

### 前端页面404

```bash
# 检查构建目录
ssh root@120.26.50.152 "ls -la /var/www/webnote/web/dist"

# 检查Nginx配置的root路径
ssh root@120.26.50.152 "grep root /etc/nginx/sites-enabled/webnote"
```

## 备份和恢复

### 数据库备份

```bash
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD='your_password' pg_dump -h localhost -U webnote_user -d webnote | gzip > /var/backups/webnote/db_$BACKUP_DATE.sql.gz
find /var/backups/webnote -name "db_*.sql.gz" -mtime +7 -delete
ENDSSH
```

### 恢复数据库

```bash
ssh root@120.26.50.152 << 'ENDSSH'
gunzip -c /var/backups/webnote/db_20240114_120000.sql.gz | sudo -u postgres psql -d webnote
ENDSSH
```

### 应用备份

```bash
ssh root@120.26.50.152 << 'ENDSSH'
mkdir -p /var/backups/webnote
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /var/backups/webnote/app_$BACKUP_DATE.tar.gz -C /var/www webnote --exclude=node_modules --exclude=uploads
ENDSSH
```

## HTTPS 配置

### 方案说明

由于项目使用 IP 地址访问（120.26.50.152），Let's Encrypt 不支持 IP 地址证书，因此采用自签名证书方案。

**适用场景**：
- 内部测试环境
- 开发环境
- 不需要公开信任的场景

**注意事项**：
- 自签名证书会导致浏览器显示安全警告
- 这是正常现象，点击"高级"->"继续访问"即可
- 如需公开信任的证书，请使用域名 + Let's Encrypt

### 自动配置（推荐）

```bash
# 1. 设置密码环境变量
export DEPLOY_PASSWORD='REDACTED_PASSWORD'

# 2. 运行配置脚本
chmod +x scripts/setup-https.sh
./scripts/setup-https.sh
```

脚本会自动完成：
1. 检查并安装 OpenSSL
2. 创建证书目录
3. 生成自签名 SSL 证书（有效期 365 天）
4. 配置 Nginx HTTPS
5. 配置 HTTP 到 HTTPS 重定向
6. 重启 Nginx 服务
7. 验证 HTTPS 配置

### 手动配置

如果需要手动配置，请按以下步骤操作：

#### 1. SSH 到服务器

```bash
ssh root@120.26.50.152
```

#### 2. 创建证书目录

```bash
sudo mkdir -p /etc/ssl/webnote
sudo chmod 700 /etc/ssl/webnote
```

#### 3. 生成自签名证书

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/webnote/webnote.key \
  -out /etc/ssl/webnote/webnote.crt \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=WebNote/OU=IT/CN=120.26.50.152"

sudo chmod 600 /etc/ssl/webnote/webnote.key
sudo chmod 644 /etc/ssl/webnote/webnote.crt
```

#### 4. 配置 Nginx

```bash
# 复制 HTTPS 配置
sudo cp deploy/nginx-https.conf /etc/nginx/sites-available/webnote

# 创建软链接
sudo ln -sf /etc/nginx/sites-available/webnote /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

#### 5. 更新后端环境变量

```bash
# 编辑后端环境变量
nano /var/www/webnote/backend/.env

# 添加 HTTPS 地址到 ALLOWED_ORIGINS
ALLOWED_ORIGINS="http://120.26.50.152,https://120.26.50.152"

# 重启后端服务
pm2 restart webnote-backend
```

### 验证 HTTPS 配置

```bash
# 测试 HTTPS 连接
curl -k https://120.26.50.152/health

# 测试 HTTP 重定向
curl -I http://120.26.50.152

# 查看证书信息
openssl x509 -in /etc/ssl/webnote/webnote.crt -text -noout
```

### 证书续期

自签名证书有效期为 365 天，到期前需要重新生成：

```bash
# 方法1: 重新运行配置脚本
./scripts/setup-https.sh

# 方法2: 手动重新生成
ssh root@120.26.50.152
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/webnote/webnote.key \
  -out /etc/ssl/webnote/webnote.crt \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=WebNote/OU=IT/CN=120.26.50.152"
sudo systemctl restart nginx
```

### 故障排除

#### HTTPS 无法访问

```bash
# 检查 Nginx 状态
ssh root@120.26.50.152 "sudo systemctl status nginx"

# 检查端口监听
ssh root@120.26.50.152 "sudo netstat -tulpn | grep -E ':(80|443)'"

# 查看 Nginx 错误日志
ssh root@120.26.50.152 "tail -f /var/log/nginx/error.log"
```

#### 证书文件不存在

```bash
# 检查证书文件
ssh root@120.26.50.152 "ls -la /etc/ssl/webnote/"

# 重新生成证书
./scripts/setup-https.sh
```

#### 浏览器安全警告

这是正常现象，自签名证书不被公共 CA 信任。解决方法：
1. 点击浏览器中的"高级"
2. 点击"继续访问"或"接受风险并继续"
3. 或将证书添加到系统信任列表（仅限内部使用）

### 使用域名 + Let's Encrypt（推荐用于生产环境）

如果有域名，建议使用 Let's Encrypt 获取公开信任的证书：

```bash
# 1. 配置域名解析
# 将域名 A 记录指向 120.26.50.152

# 2. 安装 Certbot
ssh root@120.26.50.152
sudo apt install -y certbot python3-certbot-nginx

# 3. 获取证书
sudo certbot --nginx -d your-domain.com

# 4. 测试自动续期
sudo certbot renew --dry-run
```

Certbot 会自动：
- 获取 Let's Encrypt 证书
- 配置 Nginx 使用 HTTPS
- 设置 HTTP 到 HTTPS 重定向
- 配置自动续期（证书有效期 90 天）

## 监控

### 系统监控

```bash
# CPU和内存
ssh root@120.26.50.152 "htop"

# 磁盘使用
ssh root@120.26.50.152 "df -h"

# 网络连接
ssh root@120.26.50.152 "ss -tulpn"
```

### 日志监控

```bash
# 应用日志
ssh root@120.26.50.152 "pm2 logs webnote-backend"

# 系统日志
ssh root@120.26.50.152 "journalctl -u nginx -f"
```

## 更新应用

当需要更新应用时：

```bash
# 方法1: 使用部署脚本
./scripts/deploy.sh

# 方法2: 手动更新
git pull origin main
pnpm install
./scripts/deploy.sh
```

## 速率限制配置

### 当前配置

WebNote 后端使用 `@fastify/rate-limit` 插件实现 API 速率限制：

- **默认限制**：每个 IP 每分钟最多 100 个请求
- **超出限制**：返回 HTTP 429 Too Many Requests

### 查看当前配置

```bash
# 查看速率限制配置
ssh root@120.26.50.152 "grep -A 5 'rateLimit' /var/www/webnote/backend/dist/server.js"
```

### 修改速率限制

1. 编辑本地配置文件 `packages/backend/src/server.ts`：

```typescript
app.register(rateLimit, {
  max: 200,              // 修改为每分钟 200 个请求
  timeWindow: '1 minute'
})
```

2. 重新部署：

```bash
./scripts/deploy.sh
```

### 环境变量配置（推荐）

可以通过环境变量动态配置：

```bash
# 在服务器上设置环境变量
ssh root@120.26.50.152

cd /var/www/webnote/backend
nano .env

# 添加以下内容
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
```

### 白名单配置

对于内部服务，可以配置 IP 白名单：

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  allowList: ['127.0.0.1', '::1']  // 本地回环地址
})
```

### 监控速率限制

```bash
# 查看被限制的请求日志
ssh root@120.26.50.152 "grep '429' /var/www/webnote/backend/logs/out.log"

# 实时监控
ssh root@120.26.50.152 "tail -f /var/www/webnote/backend/logs/out.log | grep -E '(429|rate)'"
```

### 测试速率限制

```bash
# 测试健康检查端点的速率限制
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://120.26.50.152/api/health
done

# 应该看到前 100 个请求返回 200，后续请求返回 429
```

详细配置请参考 [速率限制配置文档](../docs/RateLimitConfig.md)

## 性能优化

### 后端优化

```bash
# 在ecosystem.config.js中增加实例数
module.exports = {
  apps: [{
    instances: 'max', // 使用所有CPU核心
    exec_mode: 'cluster'
  }]
};
```

### 前端优化

```bash
# 构建时启用生产模式优化
cd packages/web
NODE_ENV=production npm run build
```

### Nginx优化

```nginx
# 在Nginx配置中添加
gzip on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
```

## 安全建议

1. **防火墙配置**
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

2. **SSH密钥认证**
```bash
# 在服务器上禁用密码登录
sudo nano /etc/ssh/sshd_config
# 设置: PasswordAuthentication no
sudo systemctl restart sshd
```

3. **数据库安全**
```bash
# 只允许本地连接
sudo nano /etc/postgresql/14/main/pg_hba.conf
# 只保留本地和localhost连接
```

4. **定期更新**
```bash
sudo apt update && sudo apt upgrade -y
```

## 支持

如遇问题，请检查：
1. 服务器日志：`/var/log/`
2. 应用日志：`/var/www/webnote/backend/logs/`
3. PM2日志：`pm2 logs webnote-backend`

详细文档请参考 `packages/backend/scripts/DEPLOYMENT_GUIDE.md`
