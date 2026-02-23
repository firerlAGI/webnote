# Checklist

## 阶段 1: 本地缓存层

- [x] IndexedDB 数据库初始化成功
- [x] notes 存储结构正确创建
- [x] folders 存储结构正确创建
- [x] reviews 存储结构正确创建
- [x] syncQueue 存储结构正确创建
- [x] CacheService 笔记 CRUD 操作正常
- [x] CacheService 文件夹 CRUD 操作正常
- [x] CacheService 复盘 CRUD 操作正常
- [x] 数据版本比较逻辑正确
- [x] 增量更新机制工作正常

## 阶段 2: 同步客户端

- [x] WebSocket 连接成功建立
- [x] WebSocket 断开后自动重连
- [x] 心跳机制正常工作
- [x] 消息正确序列化和反序列化
- [x] HTTP 轮询降级正常触发
- [x] 轮询间隔正确调整
- [x] SyncManager 状态机转换正确
- [x] WebSocket 和 HTTP 自动切换正常
- [x] 同步队列正确管理

## 阶段 3: 离线支持

- [x] 离线操作正确存储到队列
- [x] 操作序列化正确
- [x] 操作去重逻辑正确
- [x] online/offline 事件正确监听
- [x] 网络质量检测正常
- [x] 离线队列批量上传成功
- [x] 冲突合并逻辑正确

## 阶段 4: DataContext 集成

- [x] DataContext 正确集成 SyncManager
- [x] DataContext 正确集成 CacheService
- [x] 数据读取优先从本地缓存获取
- [x] 数据写入先本地后同步
- [x] 同步状态正确暴露
- [x] SyncContext 正确提供同步状态
- [x] SyncContext 正确提供同步控制方法

## 阶段 5: UI 组件

- [x] SyncIndicator 正确显示同步状态
- [x] SyncIndicator 正确显示待同步数量
- [x] OfflineBanner 正确显示离线提示
- [x] ConflictDialog 正确显示冲突详情
- [x] ConflictDialog 冲突解决选项正常工作

## 阶段 6: 功能验证

- [ ] 用户登录后自动开始同步
- [ ] 创建笔记后正确同步到服务器
- [ ] 修改笔记后正确同步到服务器
- [ ] 删除笔记后正确同步到服务器
- [ ] 离线时可以创建笔记
- [ ] 离线时可以修改笔记
- [ ] 离线时可以删除笔记
- [ ] 恢复连接后自动同步离线操作
- [ ] 多设备间数据正确同步
- [ ] 冲突正确检测和解决
