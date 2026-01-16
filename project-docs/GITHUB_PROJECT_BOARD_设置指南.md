# GitHub Project Board 设置指南

## 📋 概述

本指南将帮助您在 GitHub 上创建一个实时项目看板，用于追踪 webnote 项目的开发进度。

## 🎯 已创建的 Issues

我们已经为项目的 6 个子项目创建了对应的 Issues：

| Issue # | 标题 | 状态 | 完成度 |
|----------|------|------|---------|
| #1 | 【T0】项目初始化与架构搭建 | 已完成 | 100% |
| #2 | 【T1】后端核心服务开发 | 已完成 | 100% |
| #3 | 【T2】前端网页应用核心功能 | 进行中 | 85% |
| #4 | 【T3】数据同步与存储优化 | 进行中 | 90% |
| #5 | 【T4】用户体验打磨 | 待开始 | 0% |
| #6 | 【T5】测试与验证 | 进行中 | 10% |
| #7 | 【T6】部署与监控 | 待开始 | 0% |

**Issues 链接**: https://github.com/firerlAGI/webnote/issues

## 🚀 创建 GitHub Project Board（手动操作）

### 步骤 1: 访问 Projects 页面

1. 访问：https://github.com/firerlAGI/webnote/projects
2. 点击右上角的 **"New project"** 按钮

### 步骤 2: 选择 Board 类型

1. 选择 **"Board"** 模板
2. 输入项目名称：`WebNote 开发进度追踪`
3. 选择可见性：**Public**（推荐，便于展示）或 **Private**
4. 点击 **"Create project"**

### 步骤 3: 配置项目列

创建后，你会看到默认的列。建议设置以下列：

1. **Backlog**（待办）
   - 存放还未开始的任务
   - 对应标签：`待开始`

2. **In Progress**（进行中）
   - 存放正在开发的任务
   - 对应标签：`进行中`

3. **Review**（审查中）
   - 存放待代码审查的任务
   - 对应标签：`已完成`但未部署

4. **Done**（已完成）
   - 存放已完成的任务
   - 对应标签：`已完成`

### 步骤 4: 添加 Issues 到 Project

有两种方式将 Issues 添加到 Project Board：

#### 方式 1: 通过 Project Board 界面

1. 在 Project Board 中，点击右上角的 **"+"** 按钮
2. 在搜索框中输入 Issue 编号（如 `#1`）或标题
3. 选择对应的 Issue
4. 将其拖拽到适当的列中

建议的初始分配：
- **Done** 列：#1 (T0)、#2 (T1)
- **In Progress** 列：#3 (T2)、#4 (T3)、#6 (T5)
- **Backlog** 列：#5 (T4)、#7 (T6)

#### 方式 2: 通过 Issue 页面

1. 访问每个 Issue 的页面（如 https://github.com/firerlAGI/webnote/issues/1）
2. 在右侧边栏找到 **"Projects"** 部分
3. 点击 **"Add to project"**
4. 选择刚创建的 "WebNote 开发进度追踪" 项目
5. 选择适当的列

### 步骤 5: 配置自动化（可选）

为了提高效率，可以配置自动化规则：

1. 在 Project Board 中，点击右上角的 **"⋮"**（三个点）
2. 选择 **"Settings"**
3. 滚动到 **"Automation"** 部分
4. 点击 **"Add a new automation"**

推荐的自动化规则：

**规则 1**: 当 Issue 被标记为 `进行中` 时，自动移到 "In Progress" 列
- **When**: An issue is labeled
- **Condition**: Label is `进行中`
- **Then**: Move to `In Progress`

**规则 2**: 当 Issue 被标记为 `已完成` 时，自动移到 "Done" 列
- **When**: An issue is labeled
- **Condition**: Label is `已完成`
- **Then**: Move to `Done`

**规则 3**: 当 Issue 被关闭时，自动移到 "Done" 列
- **When**: An issue is closed
- **Then**: Move to `Done`

## 📊 使用 Project Board 追踪进度

### 日常使用流程

1. **每日站会**（15-30分钟）
   - 查看 "In Progress" 列中的任务
   - 更新每个任务的进度（在 Issue 评论中）
   - 识别阻塞和风险
   - 决定是否需要调整优先级

2. **更新 Issue 状态**
   - 当任务开始时：添加 `进行中` 标签，移动到 "In Progress" 列
   - 当任务完成时：添加 `已完成` 标签，移动到 "Done" 列
   - 当遇到问题时：添加 `阻塞` 标签，在 Issue 中描述问题

3. **周度回顾**
   - 检查 "Done" 列中的任务
   - 更新项目进度追踪文档
   - 识别下周需要开始的任务

### 进度可视化

Project Board 提供了直观的进度视图：

- **列的分布**：快速了解各状态的任务数量
- **拖拽排序**：调整任务优先级
- **里程碑设置**：为重要任务设置截止日期
- **标签过滤**：按子项目（T0-T6）筛选任务

## 🔧 维护 Project Board

### 定期维护任务

1. **每周更新**（建议周五）
   - 检查所有任务的完成度
   - 更新 Issue 描述中的百分比
   - 添加新的子任务（如有）

2. **标签管理**
   - 确保每个 Issue 都有正确的状态标签
   - 及时移除过时的标签
   - 添加新的标签（如 `高优先级`、`阻塞`）

3. **Issue 清理**
   - 关闭已完成的 Issue（移动到 "Done" 后）
   - 归档不需要追踪的 Issue
   - 合并重复的 Issue

### 与文档同步

确保 Project Board 与以下文档保持同步：

1. **项目进度追踪.md** (`project-docs/项目进度追踪.md`)
   - 每周更新一次
   - 反映 Project Board 中的最新状态

2. **每日站会记录.md** (`project-docs/每日站会记录.md`)
   - 记录每日站会的讨论
   - 追踪决策和行动项

3. **子项目文档**（`project-docs/T0/`, `T1/`, `T2/` 等）
   - 更新技术细节和实现方案
   - 记录遇到的问题和解决方案

## 🎨 最佳实践

### Issue 标题规范

使用一致的命名格式：
```
【Tx】简短描述
```

例如：
- `【T2】实现响应式布局`
- `【T3】优化数据库查询性能`

### Issue 描述模板

```markdown
## 任务描述

[详细的任务描述]

### 完成状态: [状态] ([百分比]%)

### 任务清单:
- [x] 已完成的任务1
- [ ] 待完成的任务2

### 负责人: [负责人姓名]

### 时间线:
- 开始日期: YYYY-MM-DD
- 完成日期: YYYY-MM-DD

### 备注:
[额外的说明、技术细节、依赖关系等]
```

### 标签使用规范

- **子项目标签**: `T0`, `T1`, `T2`, `T3`, `T4`, `T5`, `T6`
- **状态标签**: `待开始`, `进行中`, `已完成`, `阻塞`
- **类型标签**: `bug`, `enhancement`, `documentation`, `deployment`
- **优先级标签**: `高优先级`, `中优先级`, `低优先级`

### 里程碑使用

为重要的项目里程碑创建 Milestone：

1. 点击 Project Board 中的 **"Milestones"**
2. 点击 **"New milestone"**
3. 输入标题和描述
4. 设置截止日期（可选）

推荐的里程碑：
- **核心功能开发完成**: 对应 T1 和 T2
- **数据同步实现**: 对应 T3
- **MVP 发布**: 所有核心功能完成

## 📈 进度报告

### 生成周报

使用 Project Board 数据生成周报：

```markdown
# 第 X 周进度报告

## 本周完成
- [x] 完成的任务1（Issue #X）
- [x] 完成的任务2（Issue #Y）

## 进行中
- [ ] 进行中的任务1（Issue #Z）- 50%
- [ ] 进行中的任务2（Issue #W）- 75%

## 下周计划
- [ ] 计划任务1（Issue #A）
- [ ] 计划任务2（Issue #B）

## 风险和问题
- 风险1: 描述
- 问题1: 描述及解决方案
```

## 🔗 相关资源

- **GitHub Issues**: https://github.com/firerlAGI/webnote/issues
- **GitHub Projects**: https://github.com/firerlAGI/webnote/projects
- **项目文档**: `project-docs/` 目录
- **开发规范**: `project-docs/开发规范.md`

## 💡 提示

1. **保持简洁**: 不要创建太多列，4-5 列是最佳实践
2. **及时更新**: 每天至少检查一次 Project Board
3. **使用标签**: 充分利用标签进行分类和筛选
4. **沟通优先**: 对于阻塞的任务，及时在 Issue 中沟通
5. **文档同步**: 确保 Project Board 的状态与项目文档保持一致

---

**文档版本**: 1.0
**创建日期**: 2026-01-15
**维护者**: 项目负责人
