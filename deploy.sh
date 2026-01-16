#!/bin/bash

set -e

SERVER="root@120.26.50.152"

echo "开始部署WebNote到服务器..."

# 1. 创建环境变量文件
echo "步骤1: 创建环境变量文件..."
cat > /tmp/.env << 'ENVEOF'
DATABASE_URL="postgresql://webnote_user:webnote_password_2024@localhost:5432/webnote_db"
JWT_SECRET="ZDcBREshdbNykoHA+D//r6cvXJIdn7x4FeG2B5qDwhw="
PORT=3000
NODE_ENV=production
ENVEOF

scp /tmp/.env $SERVER:/var/www/webnote/backend/.env
echo "✓ 环境变量文件已上传"

# 2. 上传前端文件
echo "步骤2: 上传前端文件..."
scp -r deploy/web/dist/* $SERVER:/var/www/webnote/web/
echo "✓ 前端文件已上传"

# 3. 配置Nginx
echo "步骤3: 配置Nginx..."
scp deploy/nginx.conf $SERVER:/tmp/webnote.conf
ssh $SERVER "sudo mv /tmp/webnote.conf /etc/nginx/conf.d/webnote.conf && sudo nginx -t"
echo "✓ Nginx配置已更新"

# 4. 运行数据库迁移
echo "步骤4: 运行数据库迁移..."
ssh $SERVER "cd /var/www/webnote/backend && npx prisma migrate deploy"
echo "✓ 数据库迁移已完成"

# 5. 启动PM2服务
echo "步骤5: 启动PM2服务..."
ssh $SERVER "cd /var/www/webnote/backend && pm2 start server.js --name webnote-backend"
echo "✓ PM2服务已启动"

# 6. 重载Nginx
echo "步骤6: 重载Nginx..."
ssh $SERVER "sudo systemctl reload nginx"
echo "✓ Nginx已重载"

echo ""
echo "部署完成！"
echo "访问地址: http://120.26.50.152"
echo "API地址: http://120.26.50.152/api"
