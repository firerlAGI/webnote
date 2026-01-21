/**
 * 测试数据生成工具
 * 用于批量生成测试数据（笔记、文件夹、复盘）
 */

import { prisma, logger } from '../setup';
import {
  generateTestTitle,
} from '../config/production-test.config';

// ============================================================================
// 类型定义
// ============================================================================

interface GeneratedNote {
  id: number;
  title: string;
  content: string;
  folderId: number | null;
}

interface GeneratedFolder {
  id: number;
  name: string;
}

interface GeneratedReview {
  id: number;
  date: string;
  mood: number | null;
  achievements: string | null;
  improvements: string | null;
  plans: string | null;
}

// ============================================================================
// 测试数据生成器类
// ============================================================================

export class TestDataGenerator {
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
  }

  // 生成单个测试笔记
  async generateNote(
    folderId: number | null,
    options: {
      title?: string;
      content?: string;
      isPinned?: boolean;
    } = {}
  ): Promise<GeneratedNote> {
    const note = await prisma.note.create({
      data: {
        user_id: this.userId,
        folder_id: folderId,
        title: options.title || generateTestTitle('Note', Math.floor(Math.random() * 1000)),
        content: options.content || this.generateRandomContent(),
        is_pinned: options.isPinned ?? false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const generatedNote: GeneratedNote = {
      id: note.id,
      title: note.title,
      content: note.content,
      folderId: note.folder_id,
    };

    return generatedNote;
  }

  // 批量生成测试笔记
  async generateNotes(
    folderId: number | null,
    count: number,
    options?: {
      prefix?: string;
      contentLength?: { min: number; max: number };
      pinnedCount?: number;
    }
  ): Promise<GeneratedNote[]> {
    const notes: GeneratedNote[] = [];
    const { prefix = 'Note', contentLength, pinnedCount = 0 } = options || {};

    logger.info(`开始批量生成 ${count} 个笔记...`);

    for (let i = 0; i < count; i++) {
      const isPinned = i < pinnedCount;
      const note = await this.generateNote(folderId, {
        title: generateTestTitle(prefix, i + 1),
        content: contentLength
          ? this.generateRandomContent(contentLength.min, contentLength.max)
          : undefined,
        isPinned,
      });

      notes.push(note);

      // 每100个输出一次进度
      if ((i + 1) % 100 === 0) {
        logger.info(`已生成 ${i + 1}/${count} 个笔记`);
      }
    }

    logger.info(`✅ 成功生成 ${count} 个笔记`);
    return notes;
  }

  // 生成测试文件夹
  async generateFolder(
    options: {
      name?: string;
    } = {}
  ): Promise<GeneratedFolder> {
    const folder = await prisma.folder.create({
      data: {
        user_id: this.userId,
        name: options.name || generateTestTitle('Folder', Math.floor(Math.random() * 100)),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const generatedFolder: GeneratedFolder = {
      id: folder.id,
      name: folder.name,
    };

    return generatedFolder;
  }

  // 批量生成测试文件夹
  async generateFolders(
    count: number,
    options?: {
      prefix?: string;
    }
  ): Promise<GeneratedFolder[]> {
    const folders: GeneratedFolder[] = [];
    const { prefix = 'Folder' } = options || {};

    logger.info(`开始批量生成 ${count} 个文件夹...`);

    for (let i = 0; i < count; i++) {
      const folder = await this.generateFolder({
        name: generateTestTitle(prefix, i + 1),
      });
      folders.push(folder);
    }

    logger.info(`✅ 成功生成 ${count} 个文件夹`);
    return folders;
  }

  // 生成测试复盘
  async generateReview(
    options: {
      date?: Date;
      mood?: number;
      achievements?: string;
      improvements?: string;
      plans?: string;
    } = {}
  ): Promise<GeneratedReview> {
    const date = options.date || new Date();
    const mood = options.mood ?? Math.floor(Math.random() * 5) + 1;

    const review = await prisma.review.create({
      data: {
        user_id: this.userId,
        date,
        mood,
        achievements: options.achievements || this.generateRandomAchievements(),
        improvements: options.improvements || this.generateRandomImprovements(),
        plans: options.plans || this.generateRandomPlans(),
        content: generateTestTitle('Review', Math.floor(Math.random() * 1000)),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const generatedReview: GeneratedReview = {
      id: review.id,
      date: review.date.toISOString(),
      mood: review.mood,
      achievements: review.achievements!,
      improvements: review.improvements!,
      plans: review.plans!,
    };

    return generatedReview;
  }

  // 批量生成测试复盘
  async generateReviews(
    count: number,
    options?: {
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<GeneratedReview[]> {
    const reviews: GeneratedReview[] = [];
    const { dateRange } = options || {};

    logger.info(`开始批量生成 ${count} 个复盘...`);

    for (let i = 0; i < count; i++) {
      let date = new Date();
      if (dateRange) {
        const timeRange = dateRange.end.getTime() - dateRange.start.getTime();
        date = new Date(dateRange.start.getTime() + Math.random() * timeRange);
      }

      const review = await this.generateReview({
        date,
      });

      reviews.push(review);

      if ((i + 1) % 10 === 0) {
        logger.info(`已生成 ${i + 1}/${count} 个复盘`);
      }
    }

    logger.info(`✅ 成功生成 ${count} 个复盘`);
    return reviews;
  }

  // 生成随机内容
  private generateRandomContent(minLength: number = 100, maxLength: number = 1000): string {
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const lorem = [
      '这是测试内容，用于验证数据同步功能。',
      'WebNote 是一个强大的笔记应用，支持离线同步。',
      '数据同步是核心功能之一，确保多设备数据一致。',
      '测试内容包括：标题、内容、标签、文件夹等。',
      '性能测试需要大量数据来验证系统稳定性。',
      '并发测试模拟多用户同时操作的场景。',
      '冲突解决策略确保数据一致性。',
      '离线模式让用户在没有网络时也能使用。',
      'WebSocket 提供实时同步能力。',
      'HTTP 降级保证兼容性。',
      '缓存策略提升性能。',
      '三级缓存架构：Memory、IndexedDB、LocalStorage。',
    ];

    let content = '';
    while (content.length < length) {
      content += lorem[Math.floor(Math.random() * lorem.length)] + '\n';
    }

    return content.substring(0, length);
  }

  // 生成随机成就
  private generateRandomAchievements(): string {
    const achievements = [
      '完成了核心功能开发',
      '优化了数据库性能',
      '完成了单元测试',
      '修复了多个bug',
      '重构了代码结构',
      '添加了新功能',
      '优化了用户体验',
      '完成了文档编写',
    ];
    return achievements[Math.floor(Math.random() * achievements.length)];
  }

  // 生成随机改进
  private generateRandomImprovements(): string {
    const improvements = [
      '需要优化代码注释',
      '提升测试覆盖率',
      '改进错误处理',
      '优化查询性能',
      '完善文档',
      '增强安全性',
      '改进UI/UX',
      '重构冗余代码',
    ];
    return improvements[Math.floor(Math.random() * improvements.length)];
  }

  // 生成随机计划
  private generateRandomPlans(): string {
    const plans = [
      '继续开发新功能',
      '进行性能优化',
      '补充测试用例',
      '重构旧代码',
      '更新文档',
      '进行安全审计',
      '优化数据库索引',
      '改进错误日志',
    ];
    return plans[Math.floor(Math.random() * plans.length)];
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 为指定用户创建数据生成器
 */
export async function createTestDataGenerator(userId: number): Promise<TestDataGenerator> {
  const generator = new TestDataGenerator(userId);
  return generator;
}

/**
 * 生成完整的测试数据集（包括文件夹、笔记、复盘）
 */
export async function generateCompleteTestData(
  userId: number,
  options: {
    folderCount?: number;
    notesPerFolder?: number;
    reviewCount?: number;
  } = {}
) {
  const {
    folderCount = 5,
    notesPerFolder = 20,
    reviewCount = 10,
  } = options;

  logger.info('开始生成完整测试数据集...');
  const startTime = Date.now();

  const generator = await createTestDataGenerator(userId);

  // 生成文件夹
  const folders = await generator.generateFolders(folderCount, { prefix: 'Test Folder' });

  // 在每个文件夹中生成笔记
  for (const folder of folders) {
    await generator.generateNotes(folder.id, notesPerFolder, {
      prefix: `Note in ${folder.name}`,
      pinnedCount: Math.floor(Math.random() * 3),
    });
  }

  // 生成复盘
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30天前
  await generator.generateReviews(reviewCount, {
    dateRange: { start: startDate, end: endDate },
  });

  const duration = Date.now() - startTime;

  logger.info('✅ 完整测试数据集生成完成！');
  logger.info(`   用时: ${(duration / 1000).toFixed(2)}s`);
  logger.info(`   文件夹: ${folders.length}`);
  logger.info(`   笔记: ${folderCount * notesPerFolder}`);
  logger.info(`   复盘: ${reviewCount}`);

  return {
    folders: folders.length,
    notes: folderCount * notesPerFolder,
    reviews: reviewCount,
  };
}
