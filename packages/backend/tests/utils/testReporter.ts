/**
 * 测试报告生成器
 * 用于汇总测试结果并生成报告
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  errorMessage?: string;
}

export interface TestSuiteResult {
  name: string;
  testCases: TestCaseResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

export interface TestReport {
  executionTime: string;
  totalDuration: number;
  totalTestCases: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  passRate: number;
  suites: TestSuiteResult[];
  summary: {
    p0Tests: number;
    p1Tests: number;
    p2Tests: number;
    p0Passed: number;
    p1Passed: number;
    p2Passed: number;
  };
  issues: Array<{
    testCaseId: string;
    testCaseName: string;
    error: string;
    errorMessage: string;
  }>;
}

// ============================================================================
// 测试报告生成器类
// ============================================================================

export class TestReporter {
  private report: TestReport;
  private currentSuite: TestSuiteResult | null = null;
  private suiteStartTime: number = 0;

  constructor() {
    this.report = {
      executionTime: new Date().toISOString(),
      totalDuration: 0,
      totalTestCases: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      passRate: 0,
      suites: [],
      summary: {
        p0Tests: 0,
        p1Tests: 0,
        p2Tests: 0,
        p0Passed: 0,
        p1Passed: 0,
        p2Passed: 0,
      },
      issues: [],
    };
  }

  // 开始测试套件
  startSuite(name: string): void {
    this.currentSuite = {
      name,
      testCases: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0,
    };
    this.suiteStartTime = Date.now();
  }

  // 结束测试套件
  endSuite(): void {
    if (!this.currentSuite) return;

    this.currentSuite.duration = Date.now() - this.suiteStartTime;
    this.currentSuite.totalTests = this.currentSuite.testCases.length;
    this.currentSuite.passedTests = this.currentSuite.testCases.filter(
      (t) => t.status === 'passed'
    ).length;
    this.currentSuite.failedTests = this.currentSuite.testCases.filter(
      (t) => t.status === 'failed'
    ).length;
    this.currentSuite.skippedTests = this.currentSuite.testCases.filter(
      (t) => t.status === 'skipped'
    ).length;

    this.report.suites.push(this.currentSuite);
    this.currentSuite = null;
  }

  // 记录测试用例结果
  recordTestCase(result: TestCaseResult): void {
    if (!this.currentSuite) {
      throw new Error('No active test suite. Call startSuite() first.');
    }

    this.currentSuite.testCases.push(result);
  }

  // 生成最终报告
  generateReport(): TestReport {
    // 计算总计
    this.report.totalTestCases = this.report.suites.reduce(
      (sum, suite) => sum + suite.totalTests,
      0
    );
    this.report.totalPassed = this.report.suites.reduce(
      (sum, suite) => sum + suite.passedTests,
      0
    );
    this.report.totalFailed = this.report.suites.reduce(
      (sum, suite) => sum + suite.failedTests,
      0
    );
    this.report.totalSkipped = this.report.suites.reduce(
      (sum, suite) => sum + suite.skippedTests,
      0
    );
    this.report.totalDuration = this.report.suites.reduce(
      (sum, suite) => sum + suite.duration,
      0
    );
    this.report.passRate =
      this.report.totalTestCases > 0
        ? (this.report.totalPassed / this.report.totalTestCases) * 100
        : 0;

    // 计算优先级统计
    this.report.suites.forEach((suite) => {
      suite.testCases.forEach((testCase) => {
        this.report.summary[`${testCase.priority.toLowerCase()}Tests` as 'p0Tests' | 'p1Tests' | 'p2Tests']++;
        
        if (testCase.status === 'passed') {
          this.report.summary[`${testCase.priority.toLowerCase()}Passed` as 'p0Passed' | 'p1Passed' | 'p2Passed']++;
        }
      });
    });

    // 收集问题
    this.report.suites.forEach((suite) => {
      suite.testCases
        .filter((t) => t.status === 'failed')
        .forEach((testCase) => {
          this.report.issues.push({
            testCaseId: testCase.id,
            testCaseName: testCase.name,
            error: testCase.error || 'Unknown error',
            errorMessage: testCase.errorMessage || 'No error message',
          });
        });
    });

    return this.report;
  }

  // 生成Markdown报告
  generateMarkdownReport(): string {
    const report = this.generateReport();

    let markdown = `# 数据同步测试报告\n\n`;
    markdown += `**执行时间**: ${new Date(report.executionTime).toLocaleString('zh-CN')}\n`;
    markdown += `**总耗时**: ${(report.totalDuration / 1000).toFixed(2)}s\n\n`;

    // 总览
    markdown += `## 📊 测试总览\n\n`;
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总测试数 | ${report.totalTestCases} |\n`;
    markdown += `| 通过 | ${report.totalPassed} |\n`;
    markdown += `| 失败 | ${report.totalFailed} |\n`;
    markdown += `| 跳过 | ${report.totalSkipped} |\n`;
    markdown += `| 通过率 | ${report.passRate.toFixed(2)}% |\n\n`;

    // 优先级统计
    markdown += `## 🎯 优先级统计\n\n`;
    markdown += `| 优先级 | 总数 | 通过 | 通过率 |\n`;
    markdown += `|--------|------|------|--------|\n`;
    markdown += `| P0 | ${report.summary.p0Tests} | ${report.summary.p0Passed} | ` +
      `${((report.summary.p0Passed / report.summary.p0Tests) * 100 || 0).toFixed(2)}% |\n`;
    markdown += `| P1 | ${report.summary.p1Tests} | ${report.summary.p1Passed} | ` +
      `${((report.summary.p1Passed / report.summary.p1Tests) * 100 || 0).toFixed(2)}% |\n`;
    markdown += `| P2 | ${report.summary.p2Tests} | ${report.summary.p2Passed} | ` +
      `${((report.summary.p2Passed / report.summary.p2Tests) * 100 || 0).toFixed(2)}% |\n\n`;

    // 测试套件详情
    markdown += `## 📝 测试套件详情\n\n`;

    report.suites.forEach((suite) => {
      const statusEmoji = suite.failedTests === 0 ? '✅' : '❌';
      markdown += `### ${statusEmoji} ${suite.name}\n\n`;
      markdown += `- 总测试数: ${suite.totalTests}\n`;
      markdown += `- 通过: ${suite.passedTests}\n`;
      markdown += `- 失败: ${suite.failedTests}\n`;
      markdown += `- 跳过: ${suite.skippedTests}\n`;
      markdown += `- 耗时: ${(suite.duration / 1000).toFixed(2)}s\n\n`;

      if (suite.failedTests > 0) {
        markdown += `#### 失败的测试用例\n\n`;
        suite.testCases
          .filter((t) => t.status === 'failed')
          .forEach((testCase) => {
            markdown += `**${testCase.name}**\n\n`;
            markdown += `**错误**: ${testCase.error}\n\n`;
            if (testCase.errorMessage) {
              markdown += `\`\`\`\n${testCase.errorMessage}\n\`\`\`\n\n`;
            }
          });
      }
    });

    // 问题汇总
    if (report.issues.length > 0) {
      markdown += `## ⚠️ 问题汇总\n\n`;
      report.issues.forEach((issue, index) => {
        markdown += `### ${index + 1}. ${issue.testCaseName}\n\n`;
        markdown += `**错误**: ${issue.error}\n\n`;
        markdown += `\`\`\`\n${issue.errorMessage}\n\`\`\`\n\n`;
      });
    } else {
      markdown += `## ✅ 无问题\n\n所有测试通过！\n\n`;
    }

    // 结论
    markdown += `## 🎯 结论\n\n`;
    if (report.totalFailed === 0) {
      markdown += `✨ 所有测试通过！系统运行正常。\n\n`;
    } else if (report.passRate >= 90) {
      markdown += `⚠️ 有 ${report.totalFailed} 个测试失败，但整体通过率 (${report.passRate.toFixed(2)}%) 仍然很高。建议尽快修复失败的问题。\n\n`;
    } else {
      markdown += `❌ 有 ${report.totalFailed} 个测试失败，通过率仅为 ${report.passRate.toFixed(2)}%。需要立即修复关键问题。\n\n`;
    }

    return markdown;
  }

  // 保存报告到文件
  async saveReport(outputPath: string): Promise<void> {
    const markdown = this.generateMarkdownReport();
    const dir = path.dirname(outputPath);
    
    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 写入文件
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    
    console.log(`\n✅ 测试报告已保存到: ${outputPath}`);
  }

  // 打印报告摘要
  printSummary(): void {
    const report = this.generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试执行摘要');
    console.log('='.repeat(60));
    console.log(`总测试数: ${report.totalTestCases}`);
    console.log(`通过: ${report.totalPassed} (${report.passRate.toFixed(2)}%)`);
    console.log(`失败: ${report.totalFailed}`);
    console.log(`跳过: ${report.totalSkipped}`);
    console.log(`总耗时: ${(report.totalDuration / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));
    
    if (report.totalFailed > 0) {
      console.log(`\n❌ 发现 ${report.totalFailed} 个问题需要修复`);
    } else {
      console.log(`\n✅ 所有测试通过！`);
    }
    console.log('='.repeat(60) + '\n');
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建测试报告生成器
 */
export function createTestReporter(): TestReporter {
  return new TestReporter();
}

/**
 * 生成并保存测试报告
 */
export async function generateAndSaveReport(
  reporter: TestReporter,
  outputPath: string
): Promise<void> {
  await reporter.saveReport(outputPath);
  reporter.printSummary();
}
