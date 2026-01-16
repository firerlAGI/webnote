#!/bin/bash

# 部署后验证脚本
# 用途: 验证部署是否成功，检查所有服务状态
# 使用: ./scripts/post-deploy-verification.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SERVER="root@120.26.50.152"
SERVER_IP="120.26.50.152"
API_URL="http://$SERVER_IP/api"
FRONTEND_URL="http://$SERVER_IP"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  部署后验证脚本${NC}"
echo -e "${BLUE}  服务器: $SERVER${NC}"
echo -e "${BLUE}  时间: $(date)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 计数器
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 检查函数
check_service() {
    local name=$1
    local command=$2
    local expected=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${BLUE}[${TOTAL_CHECKS}] 检查: $name${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ 通过${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ 失败${NC}"
        echo -e "${YELLOW}期望: $expected${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# 远程执行函数
remote_exec() {
    ssh "$SERVER" "$1"
}

echo -e "${YELLOW}========== 系统服务检查 ==========${NC}"
echo ""

# 1. 检查PM2服务状态
check_service "PM2服务运行状态" \
    "remote_exec 'pm2 status | grep -q webnote-backend && pm2 status | grep webnote-backend | grep -q online'" \
    "webnote-backend进程应为online状态"

echo ""

# 2. 检查Nginx服务状态
check_service "Nginx服务运行状态" \
    "remote_exec 'sudo systemctl is-active nginx | grep -q active'" \
    "Nginx应处于active状态"

echo ""

# 3. 检查PostgreSQL服务状态
check_service "PostgreSQL服务运行状态" \
    "remote_exec 'sudo systemctl is-active postgresql | grep -q active'" \
    "PostgreSQL应处于active状态"

echo ""

echo -e "${YELLOW}========== 端口监听检查 ==========${NC}"
echo ""

# 4. 检查后端API端口(3000)
check_service "后端API端口(3000)监听" \
    "remote_exec 'sudo netstat -tulpn | grep -q :3000'" \
    "3000端口应被监听"

echo ""

# 5. 检查HTTP端口(80)
check_service "HTTP端口(80)监听" \
    "remote_exec 'sudo netstat -tulpn | grep -q :80'" \
    "80端口应被监听"

echo ""

# 6. 检查PostgreSQL端口(5432)
check_service "PostgreSQL端口(5432)监听" \
    "remote_exec 'sudo netstat -tulpn | grep -q :5432'" \
    "5432端口应被监听"

echo ""

echo -e "${YELLOW}========== 应用文件检查 ==========${NC}"
echo ""

# 7. 检查后端目录存在
check_service "后端目录存在" \
    "remote_exec '[ -d /var/www/webnote/backend ]'" \
    "/var/www/webnote/backend目录应存在"

echo ""

# 8. 检查前端目录存在
check_service "前端目录存在" \
    "remote_exec '[ -d /var/www/webnote/web ]'" \
    "/var/www/webnote/web目录应存在"

echo ""

# 9. 检查后端构建产物
check_service "后端构建产物存在" \
    "remote_exec '[ -f /var/www/webnote/backend/dist/server.js ]'" \
    "dist/server.js文件应存在"

echo ""

# 10. 检查前端构建产物
check_service "前端构建产物存在" \
    "remote_exec '[ -f /var/www/webnote/web/dist/index.html ]'" \
    "dist/index.html文件应存在"

echo ""

# 11. 检查环境变量文件
check_service "环境变量文件存在" \
    "remote_exec '[ -f /var/www/webnote/backend/.env ]'" \
    ".env文件应存在"

echo ""

# 12. 检查环境变量配置
check_service "环境变量配置正确" \
    "remote_exec 'grep -q DATABASE_URL /var/www/webnote/backend/.env && grep -q JWT_SECRET /var/www/webnote/backend/.env && grep -q PORT=3000 /var/www/webnote/backend/.env'" \
    ".env应包含DATABASE_URL, JWT_SECRET和PORT配置"

echo ""

echo -e "${YELLOW}========== 数据库检查 ==========${NC}"
echo ""

# 13. 检查数据库连接
check_service "数据库可连接" \
    "remote_exec 'sudo -u postgres psql -d webnote_db -c SELECT 1 &> /dev/null'" \
    "应能成功连接到webnote_db数据库"

echo ""

# 14. 检查数据库表结构
DB_TABLES=$(remote_exec "sudo -u postgres psql -d webnote_db -t -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'' 2>/dev/null || echo 0'")
if [ "$DB_TABLES" -gt 0 ]; then
    echo -e "${GREEN}✅ 数据库表检查: 通过 (发现 $DB_TABLES 个表)${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ 数据库表检查: 失败 (未发现任何表)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""

echo -e "${YELLOW}========== Nginx配置检查 ==========${NC}"
echo ""

# 15. 检查Nginx配置文件
check_service "Nginx配置文件存在" \
    "remote_exec '[ -f /etc/nginx/sites-available/webnote ]'" \
    "Nginx配置文件应存在"

echo ""

# 16. 检查Nginx配置已启用
check_service "Nginx配置已启用" \
    "remote_exec '[ -L /etc/nginx/sites-enabled/webnote ]'" \
    "Nginx配置符号链接应存在"

echo ""

# 17. 检查Nginx配置语法
check_service "Nginx配置语法正确" \
    "remote_exec 'sudo nginx -t &> /dev/null'" \
    "Nginx配置应无语法错误"

echo ""

echo -e "${YELLOW}========== API健康检查 ==========${NC}"
echo ""

# 18. 检查后端API健康端点
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" --connect-timeout 10 || echo "000")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ 后端API健康检查: 通过 (HTTP $response)${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ 后端API健康检查: 失败 (HTTP $response)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""

# 19. 检查前端页面可访问
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/" --connect-timeout 10 || echo "000")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ 前端页面检查: 通过 (HTTP $response)${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ 前端页面检查: 失败 (HTTP $response)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""

echo -e "${YELLOW}========== 备份检查 ==========${NC}"
echo ""

# 20. 检查备份目录存在
check_service "备份目录存在" \
    "remote_exec '[ -d /var/backups/webnote ]'" \
    "备份目录应存在"

echo ""

# 21. 检查备份文件数量
BACKUP_COUNT=$(remote_exec "ls -1 /var/backups/webnote/ 2>/dev/null | wc -l || echo 0")
if [ "$BACKUP_COUNT" -ge 0 ]; then
    echo -e "${GREEN}✅ 备份文件检查: 通过 (发现 $BACKUP_COUNT 个备份)${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ 备份文件检查: 失败${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""

# 22. 检查备份权限
check_service "备份目录权限正确" \
    "remote_exec '[ -r /var/backups/webnote ] && [ -w /var/backups/webnote ]'" \
    "备份目录应可读写"

echo ""

echo -e "${YELLOW}========== 日志检查 ==========${NC}"
echo ""

# 23. 检查PM2日志
check_service "PM2日志目录存在" \
    "remote_exec '[ -d /var/www/webnote/backend/logs ]'" \
    "PM2日志目录应存在"

echo ""

# 24. 检查应用日志权限
check_service "应用日志权限正确" \
    "remote_exec '[ -r /var/log/nginx ] && [ -w /var/log/nginx ]'" \
    "Nginx日志目录应可读写"

echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  验证结果汇总${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "总检查数: $TOTAL_CHECKS"
echo -e "${GREEN}通过: $PASSED_CHECKS${NC}"
echo -e "${RED}失败: $FAILED_CHECKS${NC}"
echo ""

# 计算成功率
if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo -e "成功率: ${SUCCESS_RATE}%"
else
    SUCCESS_RATE=0
    echo -e "成功率: 0%"
fi
echo ""

# 判断验证结果
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✅ 所有检查通过！${NC}"
    echo -e "${GREEN}  部署验证成功${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "访问地址:"
    echo "  - 前端: $FRONTEND_URL"
    echo "  - 后端API: $API_URL"
    echo ""
    exit 0
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  ⚠️  部分检查失败${NC}"
    echo -e "${YELLOW}  但成功率 >= 80%${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    echo "建议: 部署基本成功，但建议检查失败的项"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ❌ 验证失败${NC}"
    echo -e "${RED}  成功率 < 80%${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "建议: 请检查失败的检查项，可能需要回滚部署"
    echo ""
    echo "回滚命令:"
    echo "  ssh $SERVER"
    echo "  cd /var/www/webnote"
    echo "  ls /var/backups/webnote/"
    echo "  # 选择最新的备份进行恢复"
    exit 1
fi
