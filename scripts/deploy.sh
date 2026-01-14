#!/bin/bash

# WebNote 一键部署脚本
# 用法: ./scripts/deploy.sh [环境: dev|prod]
# 默认: dev

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
ENV=${1:-dev}
SERVER="root@120.26.50.152"
REMOTE_DIR="/var/www/webnote"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WebNote 自动部署脚本${NC}"
echo -e "${GREEN}  环境: $ENV${NC}"
echo -e "${GREEN}  服务器: $SERVER${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 本地构建
echo -e "${YELLOW}[1/7] 本地构建...${NC}"
cd "$PROJECT_ROOT"

# 构建共享包
echo "  - 构建共享包..."
cd packages/shared
npm run build
cd ../..

# 构建后端
echo "  - 构建后端..."
cd packages/backend
npm run build
cd ../..

# 构建前端
echo "  - 构建前端..."
cd packages/web
npm run build
cd ../..

echo -e "${GREEN}✓ 本地构建完成${NC}"
echo ""

# 2. 打包
echo -e "${YELLOW}[2/7] 打包项目...${NC}"
cd "$PROJECT_ROOT"
TEMP_DIR="/tmp/webnote_$TIMESTAMP"
mkdir -p "$TEMP_DIR"

# 复制必要文件
echo "  - 复制后端文件..."
cp -r packages/backend/dist "$TEMP_DIR/backend"
cp -r packages/backend/prisma "$TEMP_DIR/backend"
cp packages/backend/package.json "$TEMP_DIR/backend"
cp -r packages/backend/uploads "$TEMP_DIR/backend" 2>/dev/null || mkdir -p "$TEMP_DIR/backend/uploads"

echo "  - 复制前端文件..."
cp -r packages/web/dist "$TEMP_DIR/web"

echo "  - 创建部署脚本..."
cat > "$TEMP_DIR/deploy-remote.sh" << 'EOF'
#!/bin/bash
set -e

REMOTE_DIR="/var/www/webnote"
BACKUP_DIR="/var/backups/webnote"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "停止服务..."
pm2 stop webnote-backend || true

echo "备份现有版本..."
mkdir -p "$BACKUP_DIR"
[ -d "$REMOTE_DIR/backend" ] && mv "$REMOTE_DIR/backend" "$BACKUP_DIR/backend_$TIMESTAMP"
[ -d "$REMOTE_DIR/web" ] && mv "$REMOTE_DIR/web" "$BACKUP_DIR/web_$TIMESTAMP"

echo "部署新版本..."
rm -rf "$REMOTE_DIR/backend"
rm -rf "$REMOTE_DIR/web"
mv /tmp/webnote_deploy/backend "$REMOTE_DIR/backend"
mv /tmp/webnote_deploy/web "$REMOTE_DIR/web"

echo "运行数据库迁移..."
cd "$REMOTE_DIR/backend"
npx prisma migrate deploy

echo "启动服务..."
pm2 restart webnote-backend || pm2 start ecosystem.config.js

echo "清理旧备份（保留最近7天）..."
find "$BACKUP_DIR" -name "backend_*" -mtime +7 -delete
find "$BACKUP_DIR" -name "web_*" -mtime +7 -delete

echo "重载Nginx..."
sudo systemctl reload nginx || echo "请手动重载Nginx"

echo "✓ 部署完成！"
EOF
chmod +x "$TEMP_DIR/deploy-remote.sh"

# 创建压缩包
echo "  - 创建压缩包..."
tar -czf /tmp/webnote_$TIMESTAMP.tar.gz -C /tmp webnote_$TIMESTAMP
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✓ 打包完成: /tmp/webnote_$TIMESTAMP.tar.gz${NC}"
echo ""

# 3. 上传到服务器
echo -e "${YELLOW}[3/7] 上传到服务器...${NC}"
scp /tmp/webnote_$TIMESTAMP.tar.gz "$SERVER:/tmp/"
echo -e "${GREEN}✓ 上传完成${NC}"
echo ""

# 4. 解压并执行部署
echo -e "${YELLOW}[4/7] 在服务器上执行部署...${NC}"
ssh "$SERVER" << 'ENDSSH'
set -e

echo "解压文件..."
cd /tmp
tar -xzf webnote_*.tar.gz
cd webnote_*

echo "执行部署脚本..."
bash deploy-remote.sh

echo "清理临时文件..."
cd /tmp
rm -rf webnote_*
rm -f webnote_*.tar.gz
ENDSSH

echo -e "${GREEN}✓ 服务器部署完成${NC}"
echo ""

# 5. 清理本地临时文件
echo -e "${YELLOW}[5/7] 清理本地临时文件...${NC}"
rm -f /tmp/webnote_$TIMESTAMP.tar.gz
echo -e "${GREEN}✓ 清理完成${NC}"
echo ""

# 6. 健康检查
echo -e "${YELLOW}[6/7] 健康检查...${NC}"
sleep 5

echo "  - 检查后端API..."
if curl -sf http://120.26.50.152/api/health > /dev/null; then
    echo -e "${GREEN}  ✓ 后端API正常${NC}"
else
    echo -e "${RED}  ✗ 后端API异常${NC}"
fi

echo "  - 检查前端页面..."
if curl -sf http://120.26.50.152/ > /dev/null; then
    echo -e "${GREEN}  ✓ 前端页面正常${NC}"
else
    echo -e "${RED}  ✗ 前端页面异常${NC}"
fi
echo ""

# 7. 显示日志
echo -e "${YELLOW}[7/7] 查看服务日志...${NC}"
echo "查看PM2日志（Ctrl+C退出）："
ssh "$SERVER" "pm2 logs webnote-backend --lines 50"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址:"
echo "  - 前端: http://120.26.50.152"
echo "  - 后端API: http://120.26.50.152/api"
echo ""
echo "常用命令:"
echo "  - 查看状态: ssh $SERVER 'pm2 status'"
echo "  - 查看日志: ssh $SERVER 'pm2 logs webnote-backend'"
echo "  - 重启服务: ssh $SERVER 'pm2 restart webnote-backend'"
echo "  - Nginx状态: ssh $SERVER 'sudo systemctl status nginx'"
echo ""
