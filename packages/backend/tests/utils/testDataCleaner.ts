/**
 * 测试数据清理工具
 * 用于删除测试生成的数据
 */

import { prisma, logger } from '../setup';
import { PRODUCTION_TEST_CONFIG } from '../config/production-test.config';

// ============================================================================
// 清理统计
// ============================================================================

interface CleanupStats {
  notes: number;
  folders: number;
  reviews: number;
  total: number;
}

// ============================================================================
// 测试数据清理器类
// ============================================================================

export class TestDataCleaner {
  private userId: number;
  private dryRun: boolean;
  private stats: CleanupStats = {
    notes: 0,
    folders: 0,
    reviews: 0,
    total: 0,
  };

  constructor(userId: number, dryRun: boolean = false) {
    this.userId = userId;
    this.dryRun = dryRun;
  }

  // 清理所有测试数据
  async cleanupAllTestData(): Promise<CleanupStats> {
    logger.info('开始清理测试数据...');
    logger.info(`   用户ID: ${this.userId}`);
    logger.info(`   模式: ${this.dryRun ? '模拟运行（不删除）' : '实际删除'}`);
    
    const startTime = Date.now();

    try {
      // 1. 清理测试笔记
      await this.cleanupTestNotes();
      
      // 2. 清理测试复盘
      await this.cleanupTestReviews();
      
      // 3. 清理测试文件夹
      await this.cleanupTestFolders();

      const duration = Date.now() - startTime;
      this.stats.total = this.stats.notes + this.stats.folders + this.stats.reviews;

      logger.info('✅ 测试数据清理完成！');
      logger.info(`   用时: ${(duration / 1000).toFixed(2)}s`);
      logger.info(`   笔记: ${this.stats.notes}`);
      logger.info(`   文件夹: ${this.stats.folders}`);
      logger.info(`   复盘: ${this.stats.reviews}`);
      logger.info(`   总计: ${this.stats.total}`);

      return this.stats;
    } catch (error) {
      logger.error('❌ 清理测试数据失败:', error);
      throw error;
    }
  }

  // 清理测试笔记
  private async cleanupTestNotes(): Promise<void> {
    logger.info('清理测试笔记...');

    // 查询所有测试笔记
    const testNotes = await prisma.note.findMany({
      where: {
        user_id: this.userId,
        title: {
          startsWith: PRODUCTION_TEST_CONFIG.DATA_PREFIX,
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    logger.info(`找到 ${testNotes.length} 个测试笔记`);

    if (this.dryRun) {
      this.stats.notes = testNotes.length;
      return;
    }

    // 删除笔记
    const deleteResult = await prisma.note.deleteMany({
      where: {
        user_id: this.userId,
        title: {
          startsWith: PRODUCTION_TEST_CONFIG.DATA_PREFIX,
        },
      },
    });

    this.stats.notes = deleteResult.count;
    logger.info(`✅ 已删除 ${deleteResult.count} 个测试笔记`);
  }

  // 清理测试复盘
  private async cleanupTestReviews(): Promise<void> {
    logger.info('清理测试复盘...');

    // 查询所有测试复盘
    const testReviews = await prisma.review.findMany({
      where: {
        user_id: this.userId,
        content: {
          startsWith: PRODUCTION_TEST_CONFIG.DATA_PREFIX,
        },
      },
      select: {
        id: true,
        content: true,
      },
    });

    logger.info(`找到 ${testReviews.length} 个测试复盘`);

    if (this.dryRun) {
      this.stats.reviews = testReviews.length;
      return;
    }

    // 删除复盘
    const deleteResult = await prisma.review.deleteMany({
      where: {
        user_id: this.userId,
        content: {
          startsWith: PRODUCTION_TEST_CONFIG.DATA_PREFIX,
        },
      },
    });

    this.stats.reviews = deleteResult.count;
    logger.info(`✅ 已删除 ${deleteResult.count} 个测试复盘`);
  }

  // 清理测试文件夹
  private async cleanupTestFolders(): Promise<void> {
    logger.info('清理测试文件夹...');

    // 查询所有测试文件夹
    const testFolders = await prisma.folder.findMany({
      where: {
        user_id: this.userId,
        name: {
          startsWith: PRODUCTION_TEST_CONFIG.DATA_PREFIX,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info(`找到 ${testFolders.length} 个测试文件夹`);

    if (this.dryRun) {
      this.stats.folders = testFolders.length;
      return;
    }

    // 删除文件夹
    const deleteResult = await prisma.folder.deleteMany({
      where: {
        user_id: this.userId,
        name: {
          startsWith: PRODUCTION_TEST_CONFIG.DATA_PREFIX,
        },
      },
    });

    this.stats.folders = deleteResult.count;
    logger.info(`✅ 已删除 ${deleteResult.count} 个测试文件夹`);
  }

  // 获取清理统计
  getStats(): CleanupStats {
    return { ...this.stats };
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 为指定用户创建数据清理器
 */
export function createTestDataCleaner(userId: number, dryRun: boolean = false): TestDataCleaner {
  return new TestDataCleaner(userId, dryRun);
}

/**
 * 清理指定用户的所有测试数据
 */
export async function cleanupUserData(
  userId: number,
  dryRun: boolean = false
): Promise<CleanupStats> {
  const cleaner = createTestDataCleaner(userId, dryRun);
  return await cleaner.cleanupAllTestData();
}

/**
 * 清理所有测试用户的数据
 */
export async function cleanupAllTestUsersData(
  userIds: number[],
  dryRun: boolean = false
): Promise<{ [userId: number]: CleanupStats }> {
  const results: { [userId: number]: CleanupStats } = {};

  for (const userId of userIds) {
    logger.info(`\n处理用户 ${userId}...`);
    results[userId] = await cleanupUserData(userId, dryRun);
  }

  return results;
}

/**
 * 预览将要清理的数据（不执行删除）
 */
export async function previewCleanup(userId: number): Promise<CleanupStats> {
  const cleaner = createTestDataCleaner(userId, true);
  return await cleaner.cleanupAllTestData();
}

/**
 * 生成清理报告
 */
export function generateCleanupReport(stats: CleanupStats, userId: number): string {
  const report = `
========================================
测试数据清理报告
========================================
用户ID: ${userId}
----------------------------------------
清理统计:
  笔记: ${stats.notes}
  文件夹: ${stats.folders}
  复盘: ${stats.reviews}
----------------------------------------
总计: ${stats.total} 条数据
========================================
`;

  return report;
}
