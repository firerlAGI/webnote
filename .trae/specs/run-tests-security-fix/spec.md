# 运行测试和安全修复 Spec

## Why

项目当前测试覆盖率不足（单元测试 30%，集成/E2E 测试 0%），且存在安全隐患（未配置 HTTPS、JWT_SECRET 强度不足、缺少速率限制配置）。需要运行现有测试并修复发现的问题，同时加强安全配置。

## What Changes

- 运行后端单元测试并修复失败的测试用例
- 运行前端功能测试并验证核心功能
- 增强 JWT_SECRET 配置（生成 32+ 字符强密钥）
- 配置生产环境 HTTPS（Let's Encrypt）
- 添加速率限制配置和文档
- 修复测试中发现的安全问题

## Impact

- Affected specs: 安全配置、测试覆盖
- Affected code: 
  - `packages/backend/src/server.ts` - 服务器配置
  - `packages/backend/vitest.config.ts` - 测试配置
  - `deploy/nginx.conf` - Nginx 配置
  - `deploy/backend/.env` - 环境变量

## ADDED Requirements

### Requirement: 测试执行与修复

系统 SHALL 运行所有现有测试并确保通过率达到可接受水平。

#### Scenario: 后端单元测试
- **WHEN** 执行 `pnpm --filter backend test`
- **THEN** 所有测试用例应通过，或失败用例应有明确的修复计划

#### Scenario: 前端功能测试
- **WHEN** 执行 Playwright 测试
- **THEN** 核心功能（认证、笔记、复盘）应正常工作

### Requirement: JWT 密钥安全增强

系统 SHALL 使用强密钥进行 JWT 签名。

#### Scenario: 密钥强度验证
- **WHEN** 检查 JWT_SECRET 配置
- **THEN** 密钥长度应 >= 32 字符，包含大小写字母、数字和特殊字符

#### Scenario: 密钥生成
- **WHEN** 部署到生产环境
- **THEN** 应自动生成或提示配置强密钥

### Requirement: HTTPS 配置

系统 SHALL 在生产环境启用 HTTPS。

#### Scenario: SSL 证书配置
- **WHEN** 访问生产环境
- **THEN** 应使用 HTTPS 协议，证书有效

#### Scenario: HTTP 重定向
- **WHEN** 用户通过 HTTP 访问
- **THEN** 应自动重定向到 HTTPS

### Requirement: 速率限制文档

系统 SHALL 提供速率限制的配置说明。

#### Scenario: 速率限制配置
- **WHEN** 查看部署文档
- **THEN** 应包含速率限制的配置方法和默认值说明

## MODIFIED Requirements

### Requirement: 部署脚本安全检查

部署脚本 SHALL 在部署前检查安全配置是否合规。

- 添加 JWT_SECRET 强度检查
- 添加 HTTPS 配置提示
- 添加速率限制配置提示

## REMOVED Requirements

无移除的需求。
