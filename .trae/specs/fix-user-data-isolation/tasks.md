# Tasks

## 阶段 1: 修复 DataContext 用户状态感知

- [x] Task 1: 修改 DataContext 接收 userId 参数
  - [x] SubTask 1.1: 修改 DataProviderProps 接口，添加 userId: number | null 参数
  - [x] SubTask 1.2: 添加 prevUserIdRef 用于跟踪上一个用户ID
  - [x] SubTask 1.3: 实现 clearData 方法清除所有缓存数据
  - [x] SubTask 1.4: 添加 useEffect 监听 userId 变化，在变化时清除/刷新数据
  - [x] SubTask 1.5: 更新 DataContextType 接口，添加 clearData 方法

- [x] Task 2: 修改 App.tsx 传递用户状态
  - [x] SubTask 2.1: 将 user?.id 传递给 DataProvider 的 userId prop
  - [x] SubTask 2.2: 确保 handleLogout 正确设置 user 为 null

## 阶段 2: 验证修复

- [x] Task 3: 手动测试验证
  - [x] SubTask 3.1: 测试用户A登录创建数据后登出
  - [x] SubTask 3.2: 测试用户B登录，验证看不到用户A的数据
  - [x] SubTask 3.3: 测试用户切换场景，数据正确隔离

# Task Dependencies

- [Task 2] depends on [Task 1] - App.tsx 修改依赖 DataContext 修改完成
- [Task 3] depends on [Task 1, Task 2] - 测试验证依赖代码修改完成

# Parallelizable Work

- 无并行任务，需按顺序执行
