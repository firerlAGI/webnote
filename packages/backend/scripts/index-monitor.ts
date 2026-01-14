/**
 * WebNote Database Index Monitor
 * T3-BE-06: Database Index Optimization
 *
 * This script monitors database index usage and performance metrics.
 *
 * Usage:
 *   npm run monitor:index
 */

import { PrismaClient } from '@prisma/client';

interface IndexStats {
  schemaname: string;
  tablename: string;
  indexname: string;
  indexSize: string;
  indexScans: number;
  tuplesRead: number;
  tuplesFetched: number;
  usageLevel: string;
  indexdef: string;
}

interface TableStats {
  schemaname: string;
  tablename: string;
  totalSize: string;
  tableSize: string;
  indexesSize: string;
  rowCount: number;
  sequentialScans: number;
  indexScans: number;
  indexHitPercentage: number;
}

interface MonitoringReport {
  timestamp: Date;
  indexStats: IndexStats[];
  tableStats: TableStats[];
  unusedIndexes: IndexStats[];
  lowUsageIndexes: IndexStats[];
  recommendations: string[];
}

class IndexMonitor {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run monitoring and generate report
   */
  async monitor(): Promise<MonitoringReport> {
    console.log('='.repeat(80));
    console.log('WebNote Database Index Monitoring Report');
    console.log('='.repeat(80));
    console.log('');

    const indexStats = await this.getIndexStats();
    const tableStats = await this.getTableStats();
    const unusedIndexes = this.filterUnusedIndexes(indexStats);
    const lowUsageIndexes = this.filterLowUsageIndexes(indexStats);
    const recommendations = this.generateRecommendations(indexStats, tableStats, unusedIndexes, lowUsageIndexes);

    const report: MonitoringReport = {
      timestamp: new Date(),
      indexStats,
      tableStats,
      unusedIndexes,
      lowUsageIndexes,
      recommendations
    };

    this.printReport(report);

    return report;
  }

  /**
   * Get index statistics
   */
  private async getIndexStats(): Promise<IndexStats[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        idx_scan AS index_scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched,
        CASE
          WHEN idx_scan = 0 THEN 'UNUSED'
          WHEN idx_scan < 10 THEN 'LOW_USAGE'
          WHEN idx_scan < 100 THEN 'MEDIUM_USAGE'
          ELSE 'HIGH_USAGE'
        END AS usage_level,
        indexdef
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan ASC
    `;

    return result.map((row: any) => ({
      schemaname: row.schemaname,
      tablename: row.tablename,
      indexname: row.indexname,
      indexSize: row.index_size,
      indexScans: row.index_scans,
      tuplesRead: row.tuples_read,
      tuplesFetched: row.tuples_fetched,
      usageLevel: row.usage_level,
      indexdef: row.indexdef
    }));
  }

  /**
   * Get table statistics
   */
  private async getTableStats(): Promise<TableStats[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        t.schemaname,
        t.tablename,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(t.schemaname||'.'||t.tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename) - pg_relation_size(t.schemaname||'.'||t.tablename)) AS indexes_size,
        n_live_tup AS row_count,
        t.seq_scan AS sequential_scans,
        t.idx_scan AS index_scans,
        CASE
          WHEN t.seq_scan = 0 THEN 100
          ELSE ROUND((t.idx_scan::FLOAT / (t.seq_scan + t.idx_scan)) * 100, 2)
        END AS index_hit_percentage
      FROM pg_stat_user_tables t
      WHERE t.schemaname = 'public'
      ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC
    `;

    return result.map((row: any) => ({
      schemaname: row.schemaname,
      tablename: row.tablename,
      totalSize: row.total_size,
      tableSize: row.table_size,
      indexesSize: row.indexes_size,
      rowCount: row.row_count,
      sequentialScans: row.sequential_scans,
      indexScans: row.index_scans,
      indexHitPercentage: row.index_hit_percentage
    }));
  }

  /**
   * Filter unused indexes
   */
  private filterUnusedIndexes(indexStats: IndexStats[]): IndexStats[] {
    return indexStats.filter(
      index =>
        index.usageLevel === 'UNUSED' &&
        !index.indexname.includes('_pkey')
    );
  }

  /**
   * Filter low usage indexes
   */
  private filterLowUsageIndexes(indexStats: IndexStats[]): IndexStats[] {
    return indexStats.filter(
      index =>
        index.usageLevel === 'LOW_USAGE' &&
        !index.indexname.includes('_pkey')
    );
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    indexStats: IndexStats[],
    tableStats: TableStats[],
    unusedIndexes: IndexStats[],
    lowUsageIndexes: IndexStats[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for unused indexes
    if (unusedIndexes.length > 0) {
      recommendations.push(
        `发现 ${unusedIndexes.length} 个未使用的索引。建议删除以减少存储和写入开销：`
      );
      unusedIndexes.forEach((index, i) => {
        recommendations.push(
          `  ${i + 1}. ${index.indexname} on ${index.tablename} (${index.indexSize})`
        );
        recommendations.push(
          `     SQL: DROP INDEX CONCURRENTLY IF EXISTS ${index.indexname};`
        );
      });
    }

    // Check for low usage indexes
    if (lowUsageIndexes.length > 0) {
      recommendations.push('');
      recommendations.push(
        `发现 ${lowUsageIndexes.length} 个低使用率的索引。建议评估是否需要保留：`
      );
      lowUsageIndexes.forEach((index, i) => {
        recommendations.push(
          `  ${i + 1}. ${index.indexname} on ${index.tablename} (${index.indexSize}, ${index.indexScans} scans)`
        );
      });
    }

    // Check for low index hit percentage
    const lowHitTables = tableStats.filter(t => t.indexHitPercentage < 50);
    if (lowHitTables.length > 0) {
      recommendations.push('');
      recommendations.push('以下表的索引命中率较低，建议检查查询优化：');
      lowHitTables.forEach(table => {
        recommendations.push(
          `  - ${table.tablename}: ${table.indexHitPercentage}% (${table.sequentialScans} seq scans, ${table.indexScans} idx scans)`
        );
      });
    }

    // Check for high sequential scans
    const highSeqScanTables = tableStats.filter(t => t.sequentialScans > 100);
    if (highSeqScanTables.length > 0) {
      recommendations.push('');
      recommendations.push('以下表有大量顺序扫描，建议添加或优化索引：');
      highSeqScanTables.forEach(table => {
        recommendations.push(
          `  - ${table.tablename}: ${table.sequentialScans} sequential scans`
        );
      });
    }

    // Maintenance recommendations
    recommendations.push('');
    recommendations.push('维护建议：');
    recommendations.push('  - 定期运行 ANALYZE 更新统计信息');
    recommendations.push('  - 定期运行 VACUUM ANALYZE 清理死元组');
    recommendations.push('  - 监控索引使用情况，及时删除未使用的索引');
    recommendations.push('  - 监控查询性能，识别慢查询');

    return recommendations;
  }

  /**
   * Print monitoring report
   */
  private printReport(report: MonitoringReport): void {
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log('');

    // Index Statistics
    console.log('='.repeat(80));
    console.log('Index Statistics');
    console.log('='.repeat(80));
    console.log('');

    report.indexStats.forEach((index, i) => {
      console.log(`${i + 1}. ${index.indexname}`);
      console.log(`   Table: ${index.tablename}`);
      console.log(`   Size: ${index.indexSize}`);
      console.log(`   Scans: ${index.indexScans}`);
      console.log(`   Tuples Read: ${index.tuplesRead}`);
      console.log(`   Tuples Fetched: ${index.tuplesFetched}`);
      console.log(`   Usage Level: ${index.usageLevel}`);
      console.log('');
    });

    // Table Statistics
    console.log('='.repeat(80));
    console.log('Table Statistics');
    console.log('='.repeat(80));
    console.log('');

    report.tableStats.forEach((table, i) => {
      console.log(`${i + 1}. ${table.tablename}`);
      console.log(`   Total Size: ${table.totalSize}`);
      console.log(`   Table Size: ${table.tableSize}`);
      console.log(`   Indexes Size: ${table.indexesSize}`);
      console.log(`   Row Count: ${table.rowCount}`);
      console.log(`   Sequential Scans: ${table.sequentialScans}`);
      console.log(`   Index Scans: ${table.indexScans}`);
      console.log(`   Index Hit %: ${table.indexHitPercentage}%`);
      console.log('');
    });

    // Unused Indexes
    if (report.unusedIndexes.length > 0) {
      console.log('='.repeat(80));
      console.log('Unused Indexes');
      console.log('='.repeat(80));
      console.log('');

      report.unusedIndexes.forEach((index, i) => {
        console.log(`${i + 1}. ${index.indexname} on ${index.tablename}`);
        console.log(`   Size: ${index.indexSize}`);
        console.log(`   Definition: ${index.indexdef}`);
        console.log('');
      });
    }

    // Low Usage Indexes
    if (report.lowUsageIndexes.length > 0) {
      console.log('='.repeat(80));
      console.log('Low Usage Indexes');
      console.log('='.repeat(80));
      console.log('');

      report.lowUsageIndexes.forEach((index, i) => {
        console.log(`${i + 1}. ${index.indexname} on ${index.tablename}`);
        console.log(`   Size: ${index.indexSize}`);
        console.log(`   Scans: ${index.indexScans}`);
        console.log('');
      });
    }

    // Recommendations
    console.log('='.repeat(80));
    console.log('Recommendations');
    console.log('='.repeat(80));
    console.log('');

    report.recommendations.forEach(rec => {
      console.log(rec);
    });

    console.log('');
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
  const monitor = new IndexMonitor();

  try {
    const report = await monitor.monitor();

    // Save report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'index-monitor-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);

    // Exit with warning code if there are unused indexes
    process.exit(report.unusedIndexes.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error monitoring indexes:', error);
    process.exit(1);
  } finally {
    await monitor.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { IndexMonitor, MonitoringReport, IndexStats, TableStats };
