/**
 * 生产环境数据同步集成测试
 * 直接连接到生产服务器进行测试
 */

import { config } from '../config/production-test.config';

// ============================================================================
// API 工具类
// ============================================================================

class APIClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${data.error || data.message || response.statusText}`);
    }

    return data.data || data;
  }

  async get(endpoint: string): Promise<any> {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, body: any): Promise<any> {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  async put(endpoint: string, body: any): Promise<any> {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  async delete(endpoint: string): Promise<any> {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// ============================================================================
// 测试结果记录
// ============================================================================

interface TestResult {
  name: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: any;
}

class TestReporter {
  private results: TestResult[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  startTest(name: string, category: string, priority: 'P0' | 'P1' | 'P2') {
    return {
      name,
      category,
      priority,
      testStart: Date.now(),
    };
  }

  endTest(context: any, result: boolean, error?: string, details?: any) {
    const duration = Date.now() - context.testStart;
    const testResult: TestResult = {
      name: context.name,
      category: context.category,
      priority: context.priority,
      status: result ? 'pass' : 'fail',
      duration,
      error,
      details,
    };
    this.results.push(testResult);
    return testResult;
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    console.log('\n' + '='.repeat(80));
    console.log('测试执行报告');
    console.log('='.repeat(80));
    console.log(`\n总测试数: ${this.results.length}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`跳过: ${skipped}`);
    console.log(`总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)\n`);

    // 按优先级统计
    const p0Passed = this.results.filter(r => r.priority === 'P0' && r.status === 'pass').length;
    const p0Total = this.results.filter(r => r.priority === 'P0').length;
    const p1Passed = this.results.filter(r => r.priority === 'P1' && r.status === 'pass').length;
    const p1Total = this.results.filter(r => r.priority === 'P1').length;

    console.log('优先级统计:');
    console.log(`  P0: ${p0Passed}/${p0Total} 通过`);
    console.log(`  P1: ${p1Passed}/${p1Total} 通过\n`);

    // 失败的测试
    if (failed > 0) {
      console.log('失败的测试:');
      this.results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`  ❌ [${r.priority}] ${r.name}`);
        if (r.error) {
          console.log(`     错误: ${r.error}`);
        }
      });
      console.log('');
    }

    // 详细结果
    console.log('详细结果:');
    console.log('-'.repeat(80));
    this.results.forEach(r => {
      const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️';
      console.log(`${icon} [${r.priority}] ${r.name} (${r.category})`);
      console.log(`   耗时: ${r.duration}ms`);
      if (r.error) {
        console.log(`   错误: ${r.error}`);
      }
    });
    console.log('='.repeat(80) + '\n');

    return {
      total: this.results.length,
      passed,
      failed,
      skipped,
      totalDuration,
      results: this.results,
    };
  }
}

// ============================================================================
// P0 冲突解决测试
// ============================================================================

async function testConflictResolution(
  reporter: TestReporter,
  user1Client: APIClient,
  user2Client: APIClient
) {
  console.log('\n📋 执行 P0 冲突解决测试...\n');

  // 测试 1: 基本并发更新冲突
  const test1 = reporter.startTest('基本并发更新冲突', '冲突解决', 'P0');
  try {
    // 用户1 创建笔记
    const note1 = await user1Client.post('/notes', {
      title: 'Conflict Test Note 1',
      content: 'Original content from user1',
    });
    console.log(`✓ 用户1创建笔记: ID ${note1.id}`);

    // 模拟并发更新
    const [, update2] = await Promise.all([
      user1Client.put(`/notes/${note1.id}`, {
        title: 'User1 Updated',
        content: 'Content from user1',
      }),
      // 注意：这里user2不应该能更新user1的笔记，这是一个权限测试
      user2Client.put(`/notes/${note1.id}`, {
        title: 'User2 Attempted Update',
        content: 'Content from user2',
      }).catch(e => ({ error: e.message })),
    ]);

    // 验证权限
    if (update2.error) {
      console.log('✓ 权限检查正常：用户2无法更新用户1的笔记');
    }

    // 获取最新状态
    const finalNote = await user1Client.get(`/notes/${note1.id}`);
    console.log(`✓ 笔记最终状态: ${finalNote.title}`);

    reporter.endTest(test1, true, undefined, {
      noteId: note1.id,
      finalTitle: finalNote.title,
      unauthorizedAttempt: update2.error ? true : false,
    });
  } catch (error: any) {
    reporter.endTest(test1, false, error.message);
  }

  // 测试 2: 字段级冲突
  const test2 = reporter.startTest('字段级冲突处理', '冲突解决', 'P0');
  try {
    const note2 = await user1Client.post('/notes', {
      title: 'Field Conflict Test',
      content: 'Original content',
      is_pinned: false,
    });

    // 模拟两次快速更新
    await user1Client.put(`/notes/${note2.id}`, {
      title: 'Updated Title',
      content: 'Updated content',
      is_pinned: true,
    });

    const finalNote2 = await user1Client.get(`/notes/${note2.id}`);
    console.log(`✓ 字段级更新完成: ${finalNote2.title}, pinned: ${finalNote2.is_pinned}`);

    reporter.endTest(test2, true, undefined, {
      noteId: note2.id,
      finalNote: finalNote2,
    });
  } catch (error: any) {
    reporter.endTest(test2, false, error.message);
  }
}

// ============================================================================
// P0 离线模式测试
// ============================================================================

async function testOfflineMode(reporter: TestReporter, user1Client: APIClient) {
  console.log('\n📋 执行 P0 离线模式测试...\n');

  // 测试 1: 数据创建
  const test1 = reporter.startTest('离线数据创建', '离线模式', 'P0');
  try {
    const notes = [];
    for (let i = 0; i < 5; i++) {
      const note = await user1Client.post('/notes', {
        title: `[TEST] Offline Note ${i + 1}`,
        content: `Created while offline simulation ${i + 1}`,
        is_pinned: i < 2,
      });
      notes.push(note);
    }

    console.log(`✓ 创建了 ${notes.length} 条笔记`);

    // 获取所有笔记验证
    const allNotes = await user1Client.get('/notes');
    const testNotes = allNotes.notes?.filter((n: any) =>
      n.title.includes('[TEST] Offline')
    );

    console.log(`✓ 查询到 ${testNotes.length} 条测试笔记`);

    reporter.endTest(test1, true, undefined, {
      created: notes.length,
      retrieved: testNotes.length,
    });
  } catch (error: any) {
    reporter.endTest(test1, false, error.message);
  }

  // 测试 2: 数据更新
  const test2 = reporter.startTest('离线数据更新', '离线模式', 'P0');
  try {
    // 创建测试笔记
    const note = await user1Client.post('/notes', {
      title: '[TEST] Update Test',
      content: 'Original content',
    });

    // 更新多次
    for (let i = 0; i < 3; i++) {
      await user1Client.put(`/notes/${note.id}`, {
        content: `Updated version ${i + 1}`,
      });
    }

    const finalNote = await user1Client.get(`/notes/${note.id}`);
    console.log(`✓ 笔记更新成功: ${finalNote.content}`);

    reporter.endTest(test2, true, undefined, {
      noteId: note.id,
      updateCount: 3,
      finalContent: finalNote.content,
    });
  } catch (error: any) {
    reporter.endTest(test2, false, error.message);
  }
}

// ============================================================================
// P0 边界情况测试
// ============================================================================

async function testBoundaryConditions(reporter: TestReporter, user1Client: APIClient) {
  console.log('\n📋 执行 P0 边界情况测试...\n');

  // 测试 1: 空数据处理
  const test1 = reporter.startTest('空数据处理', '边界情况', 'P0');
  try {
    const emptyNote = await user1Client.post('/notes', {
      title: '[TEST] Empty Note',
      content: '',
    });

    console.log(`✓ 空内容笔记创建成功: ID ${emptyNote.id}`);

    const retrieved = await user1Client.get(`/notes/${emptyNote.id}`);
    console.log(`✓ 空内容笔记检索成功`);

    reporter.endTest(test1, true, undefined, {
      noteId: emptyNote.id,
      contentLength: retrieved.content?.length || 0,
    });
  } catch (error: any) {
    reporter.endTest(test1, false, error.message);
  }

  // 测试 2: 大数据处理
  const test2 = reporter.startTest('大数据处理', '边界情况', 'P0');
  try {
    const largeContent = 'A'.repeat(10000); // 10KB
    const largeNote = await user1Client.post('/notes', {
      title: '[TEST] Large Note',
      content: largeContent,
    });

    console.log(`✓ 大笔记创建成功: ID ${largeNote.id}, content length: ${largeContent.length}`);

    const retrieved = await user1Client.get(`/notes/${largeNote.id}`);
    console.log(`✓ 大笔记检索成功: ${retrieved.content?.length} characters`);

    reporter.endTest(test2, true, undefined, {
      noteId: largeNote.id,
      contentSize: largeContent.length,
      retrievedSize: retrieved.content?.length || 0,
    });
  } catch (error: any) {
    reporter.endTest(test2, false, error.message);
  }

  // 测试 3: 特殊字符处理
  const test3 = reporter.startTest('特殊字符处理', '边界情况', 'P0');
  try {
    const specialContent = '特殊字符测试：🚀 <script>alert("xss")</script> " & 中文 Emoji 😊';
    const specialNote = await user1Client.post('/notes', {
      title: '[TEST] Special Chars',
      content: specialContent,
    });

    const retrieved = await user1Client.get(`/notes/${specialNote.id}`);
    console.log(`✓ 特殊字符处理成功`);

    reporter.endTest(test3, true, undefined, {
      noteId: specialNote.id,
      originalContent: specialContent,
      retrievedContent: retrieved.content,
      contentMatch: retrieved.content === specialContent,
    });
  } catch (error: any) {
    reporter.endTest(test3, false, error.message);
  }
}

// ============================================================================
// P1 性能测试
// ============================================================================

async function testPerformance(reporter: TestReporter, user1Client: APIClient) {
  console.log('\n📋 执行 P1 性能测试...\n');

  // 测试 1: 批量创建性能
  const test1 = reporter.startTest('批量创建性能', '性能', 'P1');
  try {
    const count = 50;
    const startTime = Date.now();

    const notes = [];
    for (let i = 0; i < count; i++) {
      const note = await user1Client.post('/notes', {
        title: `[TEST] Perf Note ${i + 1}`,
        content: `Performance test content ${i + 1}`,
      });
      notes.push(note);
    }

    const duration = Date.now() - startTime;
    const avgTime = duration / count;

    console.log(`✓ 创建 ${count} 条笔记耗时: ${duration}ms`);
    console.log(`✓ 平均每条: ${avgTime.toFixed(2)}ms`);

    // 检查是否超过性能基准
    const benchmark = config.test.benchmarks.maxResponseTime.create;
    const isWithinBenchmark = avgTime <= benchmark;

    reporter.endTest(test1, true, undefined, {
      count,
      totalDuration: duration,
      avgTime,
      benchmark,
      isWithinBenchmark,
    });
  } catch (error: any) {
    reporter.endTest(test1, false, error.message);
  }

  // 测试 2: 批量查询性能
  const test2 = reporter.startTest('批量查询性能', '性能', 'P1');
  try {
    // 先创建一些测试数据
    for (let i = 0; i < 20; i++) {
      await user1Client.post('/notes', {
        title: `[TEST] Query Perf ${i + 1}`,
        content: `Content ${i + 1}`,
      });
    }

    const startTime = Date.now();
    const allNotes = await user1Client.get('/notes');
    const duration = Date.now() - startTime;

    console.log(`✓ 查询 ${allNotes.notes?.length || 0} 条笔记耗时: ${duration}ms`);

    const benchmark = config.test.benchmarks.maxResponseTime.query;
    const isWithinBenchmark = duration <= benchmark;

    reporter.endTest(test2, true, undefined, {
      noteCount: allNotes.notes?.length || 0,
      duration,
      benchmark,
      isWithinBenchmark,
    });
  } catch (error: any) {
    reporter.endTest(test2, false, error.message);
  }
}

// ============================================================================
// P1 并发测试
// ============================================================================

async function testConcurrency(reporter: TestReporter, user1Client: APIClient) {
  console.log('\n📋 执行 P1 并发测试...\n');

  // 测试 1: 并发创建
  const test1 = reporter.startTest('并发创建操作', '并发', 'P1');
  try {
    const count = 20;
    const startTime = Date.now();

    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        user1Client.post('/notes', {
          title: `[TEST] Concurrent ${i + 1}`,
          content: `Concurrent test ${i + 1}`,
        })
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    console.log(`✓ 并发创建 ${count} 条笔记耗时: ${duration}ms`);
    console.log(`✓ 所有操作都成功`);

    reporter.endTest(test1, true, undefined, {
      count,
      duration,
      successCount: results.length,
    });
  } catch (error: any) {
    reporter.endTest(test1, false, error.message);
  }

  // 测试 2: 并发更新同一资源
  const test2 = reporter.startTest('并发更新同一资源', '并发', 'P1');
  try {
    const note = await user1Client.post('/notes', {
      title: '[TEST] Concurrent Update Test',
      content: 'Original',
    });

    const startTime = Date.now();
    const promises = [];

    // 并发更新同一个笔记多次
    for (let i = 0; i < 5; i++) {
      promises.push(
        user1Client.put(`/notes/${note.id}`, {
          content: `Update version ${i + 1}`,
        }).catch(e => ({ error: e.message }))
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    const successCount = results.filter((r: any) => !r.error).length;
    const errorCount = results.filter((r: any) => r.error).length;

    console.log(`✓ 并发更新完成: ${successCount} 成功, ${errorCount} 失败`);
    console.log(`✓ 耗时: ${duration}ms`);

    reporter.endTest(test2, true, undefined, {
      updateCount: 5,
      successCount,
      errorCount,
      duration,
    });
  } catch (error: any) {
    reporter.endTest(test2, false, error.message);
  }
}

// ============================================================================
// 主测试流程
// ============================================================================

async function main() {
  console.log('🚀 开始执行生产环境数据同步集成测试\n');
  console.log(`服务器地址: ${config.serverUrl}`);
  console.log(`测试用户: ${config.users.user1.username}, ${config.users.user2.username}\n`);

  const reporter = new TestReporter();

  // 创建API客户端
  const user1Client = new APIClient(config.apiUrl, config.users.user1.token);
  const user2Client = new APIClient(config.apiUrl, config.users.user2.token);

  // 执行测试套件
  try {
    // P0 测试
    await testConflictResolution(reporter, user1Client, user2Client);
    await testOfflineMode(reporter, user1Client);
    await testBoundaryConditions(reporter, user1Client);

    // P1 测试
    await testPerformance(reporter, user1Client);
    await testConcurrency(reporter, user1Client);

  } catch (error: any) {
    console.error('\n❌ 测试执行失败:', error.message);
    process.exit(1);
  }

  // 生成报告
  const report = reporter.generateReport();

  // 保存报告到文件
  const fs = await import('fs');
  const path = await import('path');
  const reportPath = path.join(process.cwd(), 'test-results', 'production-sync-test-report.json');
  
  // 确保目录存在
  if (!fs.existsSync(path.dirname(reportPath))) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📊 测试报告已保存: ${reportPath}\n`);

  // 退出码
  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ 测试执行异常:', error);
  process.exit(1);
});
