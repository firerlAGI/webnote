# Checklist

## 代码修改检查

- [x] DataContext.tsx 接收 userId 参数
- [x] DataContext.tsx 实现 clearData 方法
- [x] DataContext.tsx 添加 userId 变化监听
- [x] App.tsx 正确传递 userId 给 DataProvider
- [x] App.tsx handleLogout 正确清除用户状态

## 功能验证检查

- [x] 用户A登录后创建笔记可见
- [x] 用户A登出后数据被清除
- [x] 用户B登录后看不到用户A的数据
- [x] 用户B创建笔记只属于用户B
- [x] 用户切换时数据正确刷新

## 安全检查

- [x] 不同用户数据完全隔离
- [x] 登出后 localStorage 正确清除
- [x] 登出后内存中的数据正确清除
