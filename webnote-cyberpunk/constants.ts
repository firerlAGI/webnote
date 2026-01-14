import { Folder, Note, DailyReview } from './types';

export const MOCK_FOLDERS: Folder[] = [
  { id: '1', name: '主缓冲池_Buffer', icon: 'hard-drive' },
  { id: '2', name: '阿尔法计划_Alpha', icon: 'folder-code' },
  { id: '3', name: '加密档案_Logs', icon: 'lock' },
];

export const MOCK_NOTES: Note[] = [
  {
    id: 'n1',
    title: '系统重写协议_v9',
    content: '# 重写序列\n\n1. 绕过 ICE 防火墙。\n2. 注入数据载荷。\n3. **切勿** 触发警报系统。',
    folderId: '1',
    isPinned: true,
    updatedAt: '2077-01-12T14:22:00Z',
    tags: ['黑客', '紧急']
  },
  {
    id: 'n2',
    title: '神经链路校准日志',
    content: '校准偏移量达到 0.05ms。需要调整同步率以避免突触过热。',
    folderId: '2',
    isPinned: false,
    updatedAt: '2077-01-10T09:15:00Z',
    tags: ['维护']
  },
  {
    id: 'n3',
    title: '荒坂塔会议纪要',
    content: '他们察觉到了入侵痕迹。启动静默协议。',
    folderId: '3',
    isPinned: false,
    updatedAt: '2077-01-09T18:45:00Z',
    tags: ['情报']
  }
];

export const MOCK_REVIEWS: DailyReview[] = [
  { id: 'r1', date: '2077-01-13', mood: 8, productivity: 9, content: '效率极高。成功破解子网。', tags: ['胜利'] },
  { id: 'r2', date: '2077-01-12', mood: 4, productivity: 5, content: '神经反馈导致头痛，效率下降。', tags: ['健康'] },
  { id: 'r3', date: '2077-01-11', mood: 6, productivity: 7, content: '例行系统维护，波澜不惊。', tags: ['工作'] },
  { id: 'r4', date: '2077-01-10', mood: 7, productivity: 8, content: '升级了义体内存模块。', tags: ['升级'] },
];