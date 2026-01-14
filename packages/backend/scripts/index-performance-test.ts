/**
 * WebNote Database Index Performance Test
 * T3-BE-06: Database Index Optimization
 *
 * This script tests the performance of database queries before and after index optimization.
 *
 * Usage:
 *   npm run test:db-performance
 *
 * Environment:
 *   NODE_ENV=test
 *   DATABASE_URL=postgresql://user:password@host:5432/database
 */

import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

interface TestResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  success: boolean;
  error?: string;
}

interface TestReport {
  timestamp: Date;
  database: string;
  tests: TestResult[];
  summary: {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    totalIterations: number;
  };
}

class DatabasePerformanceTester {
  private prisma: PrismaClient;
  private results: TestResult[] = [];
  private warmupIterations = 3;
  private testIterations = 20;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run all performance tests
   */
  async runTests(): Promise<TestReport> {
    console.log('='.repeat(80));
    console.log('WebNote Database Performance Test');
    console.log('='.repeat(80));
    console.log('');

    // Get database info
    const databaseInfo = await this.getDatabaseInfo();
    console.log(`Database: ${databaseInfo.database}`);
    console.log(`Version: ${databaseInfo.version}`);
    console.log(`Size: ${databaseInfo.size}`);
    console.log('');

    // Run warmup queries
    console.log('Running warmup queries...');
    await this.runWarmup();
    console.log('');

    // Run tests
    console.log('Running performance tests...');
    console.log('');

    await this.testNoteListQuery();
    await this.testNoteSearchQuery();
    await this.testNoteFolderQuery();
    await this.testNotePinnedQuery();
    await this.testReviewListQuery();
    await this.testReviewMoodQuery();
    await this.testBackupListQuery();
    await this.testSyncQuery();

    // Generate report
    const report = this.generateReport(databaseInfo.database);
    this.printReport(report);

    return report;
  }

  /**
   * Get database information
   */
  private async getDatabaseInfo(): Promise<any> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        current_database() as database,
        version() as version
    `;

    const sizeResult = await this.prisma.$queryRaw<any[]>`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) as size
    `;

    return {
      database: result[0].database,
      version: result[0].version.split(',')[0],
      size: sizeResult[0].size
    };
  }

  /**
   * Run warmup queries
   */
  private async runWarmup(): Promise<void> {
    for (let i = 0; i < this.warmupIterations; i++) {
      await this.prisma.note.findMany({ take: 1 });
      await this.prisma.review.findMany({ take: 1 });
      await this.prisma.backup.findMany({ take: 1 });
    }
  }

  /**
   * Test note list query
   */
  private async testNoteListQuery(): Promise<void> {
    const name = 'Note List Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.note.findMany({
        where: { user_id: 1 },
        orderBy: { updated_at: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test note search query
   */
  private async testNoteSearchQuery(): Promise<void> {
    const name = 'Note Search Query (ILIKE)';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.note.findMany({
        where: {
          user_id: 1,
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { content: { contains: 'test', mode: 'insensitive' } }
          ]
        },
        orderBy: { updated_at: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test note folder query
   */
  private async testNoteFolderQuery(): Promise<void> {
    const name = 'Note Folder Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.note.findMany({
        where: { user_id: 1, folder_id: 1 },
        orderBy: { updated_at: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test note pinned query
   */
  private async testNotePinnedQuery(): Promise<void> {
    const name = 'Note Pinned Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.note.findMany({
        where: { user_id: 1, is_pinned: true },
        orderBy: { updated_at: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test review list query
   */
  private async testReviewListQuery(): Promise<void> {
    const name = 'Review List Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.review.findMany({
        where: { user_id: 1 },
        orderBy: { date: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test review mood query
   */
  private async testReviewMoodQuery(): Promise<void> {
    const name = 'Review Mood Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.review.findMany({
        where: { user_id: 1, mood: 5 },
        orderBy: { date: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test backup list query
   */
  private async testBackupListQuery(): Promise<void> {
    const name = 'Backup List Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.backup.findMany({
        where: { user_id: 1 },
        orderBy: { created_at: 'desc' },
        take: 20
      });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Test sync query
   */
  private async testSyncQuery(): Promise<void> {
    const name = 'Sync Query';
    console.log(`Testing: ${name}`);

    const times: number[] = [];

    for (let i = 0; i < this.testIterations; i++) {
      const start = performance.now();
      await this.prisma.note.findMany({ where: { user_id: 1 } });
      await this.prisma.folder.findMany({ where: { user_id: 1 } });
      await this.prisma.review.findMany({ where: { user_id: 1 } });
      const end = performance.now();
      times.push(end - start);
    }

    this.addTestResult(name, times);
  }

  /**
   * Add test result
   */
  private addTestResult(name: string, times: number[]): void {
    const sorted = [...times].sort((a, b) => a - b);
    const totalTime = times.reduce((sum, time) => sum + time, 0);

    const result: TestResult = {
      name,
      iterations: times.length,
      totalTime,
      avgTime: totalTime / times.length,
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      p95Time: sorted[Math.floor(sorted.length * 0.95)],
      success: true
    };

    this.results.push(result);

    console.log(`  Average: ${result.avgTime.toFixed(2)}ms`);
    console.log(`  Min: ${result.minTime.toFixed(2)}ms`);
    console.log(`  Max: ${result.maxTime.toFixed(2)}ms`);
    console.log(`  P95: ${result.p95Time.toFixed(2)}ms`);
    console.log('');
  }

  /**
   * Generate test report
   */
  private generateReport(database: string): TestReport {
    return {
      timestamp: new Date(),
      database,
      tests: this.results,
      summary: {
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        failedTests: this.results.filter(r => !r.success).length,
        totalIterations: this.results.reduce((sum, r) => sum + r.iterations, 0)
      }
    };
  }

  /**
   * Print test report
   */
  private printReport(report: TestReport): void {
    console.log('='.repeat(80));
    console.log('Test Summary');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`Database: ${report.database}`);
    console.log('');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Successful: ${report.summary.successfulTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Total Iterations: ${report.summary.totalIterations}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('Detailed Results');
    console.log('='.repeat(80));
    console.log('');

    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   Min: ${result.minTime.toFixed(2)}ms`);
      console.log(`   Max: ${result.maxTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);
      console.log(`   Iterations: ${result.iterations}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('Performance Analysis');
    console.log('='.repeat(80));
    console.log('');

    // Calculate improvement targets
    const searchTest = this.results.find(r => r.name === 'Note Search Query (ILIKE)');
    if (searchTest) {
      const improvement = searchTest.avgTime > 300 ? 85 : 50;
      const targetTime = searchTest.avgTime * (1 - improvement / 100);
      console.log(`Search Query:`);
      console.log(`  Current: ${searchTest.avgTime.toFixed(2)}ms`);
      console.log(`  Target: ${targetTime.toFixed(2)}ms (${improvement}% improvement)`);
      console.log('');
    }

    const listTest = this.results.find(r => r.name === 'Note List Query');
    if (listTest) {
      const targetTime = listTest.avgTime * 0.5;
      console.log(`List Query:`);
      console.log(`  Current: ${listTest.avgTime.toFixed(2)}ms`);
      console.log(`  Target: ${targetTime.toFixed(2)}ms (50% improvement)`);
      console.log('');
    }

    console.log('='.repeat(80));
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const tester = new DatabasePerformanceTester();

  try {
    const report = await tester.runTests();

    // Save report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.summary.failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { DatabasePerformanceTester, TestReport, TestResult };
