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
ENABLE_HTTPS=${2:-false}
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

# JWT_SECRET 强度检查函数
check_jwt_secret_strength() {
    local secret="$1"
    local min_length=32
    
    # 检查长度
    if [ ${#secret} -lt $min_length ]; then
        echo -e "${RED}错误: JWT_SECRET 长度不足！${NC}"
        echo -e "${RED}  当前长度: ${#secret} 字符${NC}"
        echo -e "${RED}  最低要求: $min_length 字符${NC}"
        echo ""
        echo -e "${YELLOW}请使用以下方法生成强密钥：${NC}"
        echo -e "${YELLOW}  方法1 (Node.js): node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"${NC}"
        echo -e "${YELLOW}  方法2 (OpenSSL): openssl rand -base64 32${NC}"
        echo -e "${YELLOW}  方法3 (Python): python3 -c \"import secrets; print(secrets.token_urlsafe(32))\"${NC}"
        return 1
    fi
    
    # 检查是否为默认/弱密钥
    local weak_patterns=("your-secret-key" "change-in-production" "secret" "password" "123456" "webnote-production-secret-key-change-in-production-2024")
    for pattern in "${weak_patterns[@]}"; do
        if [[ "$secret" == *"$pattern"* ]]; then
            echo -e "${RED}错误: JWT_SECRET 包含弱密钥模式: '$pattern'${NC}"
            echo -e "${RED}  请生成一个加密安全的随机密钥${NC}"
            return 1
        fi
    done
    
    # 检查字符多样性
    local has_upper=$(echo "$secret" | grep -c '[A-Z]')
    local has_lower=$(echo "$secret" | grep -c '[a-z]')
    local has_digit=$(echo "$secret" | grep -c '[0-9]')
    local has_special=$(echo "$secret" | grep -c '[!@#$%^&*()_+\-=\[\]{};:,.<>?]')
    
    local complexity=0
    [ $has_upper -gt 0 ] && ((complexity++))
    [ $has_lower -gt 0 ] && ((complexity++))
    [ $has_digit -gt 0 ] && ((complexity++))
    [ $has_special -gt 0 ] && ((complexity++))
    
    if [ $complexity -lt 3 ]; then
        echo -e "${YELLOW}警告: JWT_SECRET 复杂度较低（建议包含大小写字母、数字和特殊字符）${NC}"
        echo -e "${YELLOW}  当前包含: ${has_upper}大写, ${has_lower}小写, ${has_digit}数字, ${has_special}特殊字符${NC}"
    fi
    
    echo -e "${GREEN}✓ JWT_SECRET 强度检查通过 (${#secret} 字符)${NC}"
    return 0
}

# 生产环境部署前检查
if [ "$ENV" = "prod" ]; then
    echo -e "${YELLOW}[0/7] 生产环境安全检查...${NC}"
    
    # 尝试从服务器获取当前 JWT_SECRET
    JWT_SECRET_VALUE=$(ssh $SERVER "grep '^JWT_SECRET=' $REMOTE_DIR/backend/.env 2>/dev/null | cut -d '=' -f2-" | tr -d '"' | tr -d "'")
    
    if [ -n "$JWT_SECRET_VALUE" ]; then
        if ! check_jwt_secret_strength "$JWT_SECRET_VALUE"; then
            echo -e "${RED}部署已终止，请更新 JWT_SECRET 后重试${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}警告: 无法从服务器获取 JWT_SECRET，将在部署后检查${NC}"
    fi
    echo ""
fi

# 1. 本地构建
echo -e "${YELLOW}[1/7] 本地构建...${NC}"
cd "$PROJECT_ROOT"

# 构建共享包
echo "  - 构建共享包..."
cd packages/shared
pnpm run build
cd ../..

# 构建后端
echo "  - 构建后端..."
cd packages/backend
pnpm run build
cd ../..

# 构建前端
echo "  - 构建前端..."
cd packages/web
pnpm run build
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
mkdir -p "$TEMP_DIR/backend"
cp -r packages/backend/dist "$TEMP_DIR/backend/"
cp -r packages/backend/prisma "$TEMP_DIR/backend/"
cp packages/backend/package.json "$TEMP_DIR/backend/"
cp -r packages/backend/uploads "$TEMP_DIR/backend/" 2>/dev/null || mkdir -p "$TEMP_DIR/backend/uploads"

echo "  - 复制共享包..."
mkdir -p "$TEMP_DIR/backend/shared"
cp -r packages/shared/dist "$TEMP_DIR/backend/shared/"
cp packages/shared/package.json "$TEMP_DIR/backend/shared/"

echo "  - 创建生产环境 package.json..."
cp scripts/production-backend-package.json "$TEMP_DIR/backend/package.json"

echo "  - 复制前端文件..."
cp -r packages/web/dist "$TEMP_DIR/web"

echo "  - 创建部署脚本..."
cat > "$TEMP_DIR/deploy-remote.sh" << 'EOF'
#!/bin/bash
set -e

REMOTE_DIR="/var/www/webnote"
BACKUP_DIR="/var/backups/webnote"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "停止服务..."
pm2 delete webnote-backend || true

echo "保存配置文件..."
if [ -f "$REMOTE_DIR/backend/.env" ]; then
    cp "$REMOTE_DIR/backend/.env" /tmp/webnote_env.bak
fi

echo "备份现有版本..."
mkdir -p "$BACKUP_DIR"
[ -d "$REMOTE_DIR/backend" ] && mv "$REMOTE_DIR/backend" "$BACKUP_DIR/backend_$TIMESTAMP"
[ -d "$REMOTE_DIR/web" ] && mv "$REMOTE_DIR/web" "$BACKUP_DIR/web_$TIMESTAMP"

echo "部署新版本..."
rm -rf "$REMOTE_DIR/backend"
rm -rf "$REMOTE_DIR/web"
rm -rf "$REMOTE_DIR/node_modules"
rm -f "$REMOTE_DIR/pnpm-lock.yaml"
cp -r "$DEPLOY_DIR/backend" "$REMOTE_DIR/backend"
cp -r "$DEPLOY_DIR/web" "$REMOTE_DIR/web"

echo "恢复配置文件..."
if [ -f /tmp/webnote_env.bak ]; then
    mv /tmp/webnote_env.bak "$REMOTE_DIR/backend/.env"
fi

# 检查 .env 是否使用了默认密码，如果是，尝试从备份恢复
if grep -q "your_secure_password" "$REMOTE_DIR/backend/.env" 2>/dev/null || [ ! -f "$REMOTE_DIR/backend/.env" ]; then
    echo "检测到无效或缺失的 .env 文件，尝试从历史备份中搜索有效配置..."
    
    FOUND=false
    # 列出所有备份目录，按时间倒序
    for BACKUP in $(ls -td "$BACKUP_DIR"/backend_* 2>/dev/null); do
        if [ -f "$BACKUP/.env" ]; then
            if ! grep -q "your_secure_password" "$BACKUP/.env"; then
                echo "找到有效配置：$BACKUP/.env"
                cp "$BACKUP/.env" "$REMOTE_DIR/backend/.env"
                FOUND=true
                break
            else
                 echo "跳过无效配置（默认密码）：$BACKUP/.env"
            fi
        fi
    done
    
    if [ "$FOUND" = "false" ]; then
        echo "警告：未找到包含非默认密码的有效 .env 备份！数据库连接可能会失败。"
    fi
fi

echo "检查环境变量文件..."
cd "$REMOTE_DIR/backend"
if [ ! -f .env ]; then
    echo "警告: .env 文件不存在，使用默认模板创建..."
    if [ "\$ENABLE_HTTPS" = "true" ]; then
        cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://webnote_user:your_secure_password@localhost:5432/webnote
JWT_SECRET=webnote-production-secret-key-change-in-production-2024
ALLOWED_ORIGINS=https://120.26.50.152,http://120.26.50.152,http://localhost:5173,http://localhost:3000
ENVEOF
    else
        cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://webnote_user:your_secure_password@localhost:5432/webnote
JWT_SECRET=webnote-production-secret-key-change-in-production-2024
ALLOWED_ORIGINS=http://120.26.50.152,http://localhost:5173,http://localhost:3000
ENVEOF
    fi
else
    echo "保留现有 .env 文件"
fi

# JWT_SECRET 强度检查
echo "检查 JWT_SECRET 强度..."
JWT_SECRET_VALUE=$(grep '^JWT_SECRET=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
MIN_LENGTH=32

if [ \${#JWT_SECRET_VALUE} -lt \$MIN_LENGTH ]; then
    echo "错误: JWT_SECRET 长度不足！"
    echo "  当前长度: \${#JWT_SECRET_VALUE} 字符"
    echo "  最低要求: \$MIN_LENGTH 字符"
    echo ""
    echo "请使用以下方法生成强密钥："
    echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    echo "  或"
    echo "  openssl rand -base64 32"
    echo ""
    echo "生成后，请手动更新 .env 文件中的 JWT_SECRET"
    exit 1
fi

# 检查弱密钥模式
WEAK_PATTERNS="your-secret-key change-in-production secret password 123456 webnote-production-secret-key-change-in-production-2024"
for pattern in \$WEAK_PATTERNS; do
    if [[ "\$JWT_SECRET_VALUE" == *"\$pattern"* ]]; then
        echo "错误: JWT_SECRET 包含弱密钥模式: '\$pattern'"
        echo "  请生成一个加密安全的随机密钥"
        exit 1
    fi
done

echo "✓ JWT_SECRET 强度检查通过 (\${#JWT_SECRET_VALUE} 字符)"

echo "安装后端依赖..."
pnpm install

echo "检查数据库配置..."
# 获取 DATABASE_URL，处理可能的引号
DB_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [[ "$DB_URL" == file:* ]]; then
    echo "检测到 SQLite 配置，保持 schema.prisma 不变..."
elif [[ "$DB_URL" == postgresql:* ]] || [[ "$DB_URL" == postgres:* ]]; then
    echo "检测到 PostgreSQL 配置，修改 schema.prisma..."
    sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma
else
    echo "警告：未知的数据库协议，尝试修改为 PostgreSQL..."
    sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma
fi

echo "生成 Prisma Client..."
pnpm prisma generate

echo "运行数据库迁移..."
pnpm prisma migrate deploy

echo "启动服务..."
pm2 restart webnote-backend || pm2 start pnpm --name webnote-backend -- start

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

# 检查expect是否安装
if ! command -v expect &> /dev/null; then
    echo -e "${RED}错误: 未安装expect命令${NC}"
    echo -e "${YELLOW}请运行: brew install expect${NC}"
    exit 1
fi

# 使用expect自动上传
# 尝试从本地 secrets 文件加载密码
if [ -f "$PROJECT_ROOT/scripts/.secrets" ]; then
    source "$PROJECT_ROOT/scripts/.secrets"
fi

# 检查密码是否设置
if [ -z "$DEPLOY_PASSWORD" ]; then
    echo -e "${YELLOW}警告: 未设置 DEPLOY_PASSWORD，将尝试使用 SSH 密钥登录${NC}"
fi

if [ -n "$DEPLOY_PASSWORD" ]; then
    PASSWORD="$DEPLOY_PASSWORD"
    expect << EOF
set timeout 300
spawn scp /tmp/webnote_$TIMESTAMP.tar.gz $SERVER:/tmp/
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "100%" {
        expect eof
    }
    timeout {
        puts "上传超时"
        exit 1
    }
}
EOF
else
    scp /tmp/webnote_$TIMESTAMP.tar.gz $SERVER:/tmp/
fi

echo -e "${GREEN}✓ 上传完成${NC}"
echo ""

# 4. 解压并执行部署
echo -e "${YELLOW}[4/7] 在服务器上执行部署...${NC}"

if [ -n "$DEPLOY_PASSWORD" ]; then
    # 使用expect自动执行远程部署
    expect << EOF
set timeout 600
spawn ssh $SERVER
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "*#*" {
        send "set -e\n"
        expect "*#*"
        send "echo '解压文件...'\n"
        expect "*#*"
        send "cd /tmp\n"
        expect "*#*"
        send "tar -xzf webnote_$TIMESTAMP.tar.gz\n"
        expect "*#*"
        send "cd webnote_$TIMESTAMP\n"
        expect "*#*"
        send "echo '执行部署脚本...'\n"
        expect "*#*"
        send "bash deploy-remote.sh\n"
        expect "*#*"
        send "echo '清理临时文件...'\n"
        expect "*#*"
        send "cd /tmp\n"
        expect "*#*"
        send "rm -rf webnote_$TIMESTAMP\n"
        expect "*#*"
        send "rm -f webnote_$TIMESTAMP.tar.gz\n"
        expect "*#*"
        send "exit\n"
        expect eof
    }
    timeout {
        puts "远程执行超时"
        exit 1
    }
}
EOF
else
    ssh $SERVER "cd /tmp && tar -xzf webnote_$TIMESTAMP.tar.gz && cd webnote_$TIMESTAMP && bash deploy-remote.sh && cd /tmp && rm -rf webnote_$TIMESTAMP && rm -f webnote_$TIMESTAMP.tar.gz"
fi

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
if curl -sf http://120.26.50.152:3000/health > /dev/null; then
    echo -e "${GREEN}  ✓ 后端API正常 (端口 3000)${NC}"
else
    echo -e "${YELLOW}  ⚠ 后端API端口 3000 无响应，尝试通过 Nginx 代理...${NC}"
    sleep 3
    if curl -sf http://120.26.50.152/api/health > /dev/null; then
        echo -e "${GREEN}  ✓ 后端API正常 (Nginx 代理)${NC}"
    else
        echo -e "${RED}  ✗ 后端API异常${NC}"
    fi
fi

echo "  - 检查前端页面..."
if curl -sf http://120.26.50.152/ > /dev/null; then
    echo -e "${GREEN}  ✓ 前端页面正常${NC}"
else
    echo -e "${RED}  ✗ 前端页面异常${NC}"
fi
echo ""

# 7. 显示日志
echo -e "${YELLOW}[7/7] 查看服务状态...${NC}"

if [ -n "$DEPLOY_PASSWORD" ]; then
    PASSWORD="$DEPLOY_PASSWORD"
    expect << EOF
set timeout 30
spawn ssh $SERVER "pm2 list"
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    eof
}
EOF
else
    ssh "$SERVER" "pm2 list"
fi

echo ""
echo "如需查看详细日志，请运行："
echo "ssh $SERVER 'pm2 logs webnote-backend'"
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
