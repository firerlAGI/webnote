#!/bin/bash

set -e

SERVER="root@120.26.50.152"
REMOTE_DIR="/var/www/webnote"
BACKEND_DIR="$REMOTE_DIR/backend"
WEB_DIR="$REMOTE_DIR/web"

echo "=========================================="
echo "  开始部署 WebNote 到服务器"
echo "=========================================="
echo ""

# 1. 检查环境配置
echo "步骤1: 检查环境配置..."
if [ ! -f "deploy/backend/.env.production" ]; then
    echo "  ⚠️  警告: .env.production 文件不存在"
    echo "  请先配置 deploy/backend/.env.production 文件"
    echo "  必须设置: JWT_SECRET（至少32个字符的强密钥）"
    echo "  必须设置: ALLOWED_ORIGINS（包含生产环境域名）"
    exit 1
fi

# 检查 JWT_SECRET 是否为默认值
if grep -q "CHANGE-THIS-TO-A-SECURE-RANDOM-STRING" deploy/backend/.env.production; then
    echo "  ⚠️  警告: JWT_SECRET 仍为默认值"
    echo "  请先修改 deploy/backend/.env.production 中的 JWT_SECRET"
    exit 1
fi

echo "  ✓ 环境配置检查通过"
echo ""

# 2. 上传后端文件
echo "步骤2: 上传后端文件..."
echo "  - 上传后端代码..."
scp -r deploy/backend/* $SERVER:$BACKEND_DIR/
echo "  ✓ 后端文件已上传"
echo ""

# 3. 在服务器上安装依赖
echo "步骤3: 安装后端依赖..."
ssh $SERVER "cd $BACKEND_DIR && npm install --production"
echo "  ✓ 依赖已安装"
echo ""

# 4. 生成 Prisma Client
echo "步骤4: 生成 Prisma Client..."
ssh $SERVER "cd $BACKEND_DIR && npx prisma generate"
echo "  ✓ Prisma Client 已生成"
echo ""

# 5. 运行数据库迁移
echo "步骤5: 运行数据库迁移..."
ssh $SERVER "cd $BACKEND_DIR && npx prisma migrate deploy"
echo "  ✓ 数据库迁移已完成"
echo ""

# 6. 上传前端文件
echo "步骤6: 上传前端文件..."
ssh $SERVER "mkdir -p $WEB_DIR"
scp -r deploy/web/dist/* $SERVER:$WEB_DIR/
echo "  ✓ 前端文件已上传"
echo ""

# 7. 配置 Nginx
echo "步骤7: 配置 Nginx..."
scp deploy/nginx.conf $SERVER:/tmp/webnote.conf
ssh $SERVER "sudo mv /tmp/webnote.conf /etc/nginx/conf.d/webnote.conf && sudo nginx -t"
echo "  ✓ Nginx 配置已更新"
echo ""

# 8. 停止旧服务（如果存在）
echo "步骤8: 停止旧服务..."
ssh $SERVER "pm2 delete webnote-backend || true"
echo "  ✓ 旧服务已停止"
echo ""

# 9. 启动 PM2 服务
echo "步骤9: 启动 PM2 服务..."
ssh $SERVER "cd $BACKEND_DIR && pm2 start dist/server.js --name webnote-backend"
echo "  ✓ PM2 服务已启动"
echo ""

# 10. 保存 PM2 配置
echo "步骤10: 保存 PM2 配置..."
ssh $SERVER "pm2 save"
echo "  ✓ PM2 配置已保存"
echo ""

# 11. 重载 Nginx
echo "步骤11: 重载 Nginx..."
ssh $SERVER "sudo systemctl reload nginx"
echo "  ✓ Nginx 已重载"
echo ""

# 12. 检查服务状态
echo "步骤12: 检查服务状态..."
echo "  PM2 状态:"
ssh $SERVER "pm2 status"
echo ""
echo "  Nginx 状态:"
ssh $SERVER "sudo systemctl status nginx --no-pager -l"
echo ""

echo "=========================================="
echo "  ✅ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://120.26.50.152"
echo "API 地址: http://120.26.50.152/api"
echo "健康检查: http://120.26.50.152/health"
echo ""
echo "查看日志:"
echo "  PM2: ssh $SERVER 'pm2 logs webnote-backend'"
echo "  Nginx: ssh $SERVER 'sudo tail -f /var/log/nginx/access.log'"
echo ""
