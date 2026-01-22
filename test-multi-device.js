import http from 'http';

const API_BASE = 'http://localhost:3000';

async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testMultiDeviceLogin() {
  console.log('开始测试多设备登录同步功能...\n');

  const timestamp = Date.now();
  const userEmail = `multidevice_${timestamp}@example.com`;
  const userPassword = 'test123456';
  
  let device1Token = null;
  let device2Token = null;
  let userId = null;
  let createdNoteId = null;
  let createdReviewId = null;
  const createdNoteContent = {
    title: '设备1创建的笔记',
    content: '这是设备1创建的笔记内容，用于测试多设备同步。\n包含多行文本和特殊符号！@#$%'
  };
  const createdReviewContent = {
    date: new Date().toISOString().split('T')[0],
    content: '这是设备1创建的复盘内容。\n今天心情很好！',
    mood: 8
  };

  try {
    // ============ 设备1操作 ============
    console.log('='.repeat(60));
    console.log('【设备1】开始操作...');
    console.log('='.repeat(60));

    // 1. 设备1注册用户
    console.log('\n[设备1] 1. 注册新用户...');
    const registerData = {
      username: `multidevice_user_${timestamp}`,
      email: userEmail,
      password: userPassword
    };

    const registerRes = await makeRequest('POST', '/api/auth/register', registerData);
    if (registerRes.status !== 201) {
      throw new Error(`注册失败: ${JSON.stringify(registerRes.data)}`);
    }
    console.log('✓ 用户注册成功');
    console.log(`  用户名: ${registerData.username}`);
    console.log(`  邮箱: ${userEmail}`);

    device1Token = registerRes.data.data.token;
    userId = registerRes.data.data.user.id;

    // 2. 设备1创建笔记
    console.log('\n[设备1] 2. 创建笔记...');
    const createNoteRes = await makeRequest('POST', '/api/notes', createdNoteContent, device1Token);
    if (createNoteRes.status !== 201) {
      throw new Error(`创建笔记失败: ${JSON.stringify(createNoteRes.data)}`);
    }
    console.log('✓ 笔记创建成功');
    console.log(`  笔记ID: ${createNoteRes.data.data.id}`);
    console.log(`  标题: ${createNoteRes.data.data.title}`);
    createdNoteId = createNoteRes.data.data.id;

    // 3. 设备1创建复盘
    console.log('\n[设备1] 3. 创建复盘...');
    const createReviewRes = await makeRequest('POST', '/api/reviews', createdReviewContent, device1Token);
    if (createReviewRes.status !== 201) {
      throw new Error(`创建复盘失败: ${JSON.stringify(createReviewRes.data)}`);
    }
    console.log('✓ 复盘创建成功');
    console.log(`  复盘ID: ${createReviewRes.data.data.id}`);
    console.log(`  日期: ${createdReviewContent.date}`);
    createdReviewId = createReviewRes.data.data.id;

    // 4. 设备1查询所有笔记
    console.log('\n[设备1] 4. 查询所有笔记...');
    const notesRes1 = await makeRequest('GET', '/api/notes', null, device1Token);
    if (notesRes1.status !== 200) {
      throw new Error(`获取笔记列表失败: ${JSON.stringify(notesRes1.data)}`);
    }
    console.log('✓ 设备1笔记列表获取成功');
    console.log(`  笔记数量: ${notesRes1.data.data.pagination.total}`);

    // 5. 设备1查询所有复盘
    console.log('\n[设备1] 5. 查询所有复盘...');
    const reviewsRes1 = await makeRequest('GET', '/api/reviews', null, device1Token);
    if (reviewsRes1.status !== 200) {
      throw new Error(`获取复盘列表失败: ${JSON.stringify(reviewsRes1.data)}`);
    }
    console.log('✓ 设备1复盘列表获取成功');
    console.log(`  复盘数量: ${reviewsRes1.data.data.pagination.total}`);

    // ============ 模拟设备切换 ============
    console.log('\n' + '='.repeat(60));
    console.log('【模拟设备切换】用户在设备2上使用相同邮箱登录');
    console.log('='.repeat(60));

    // ============ 设备2操作 ============
    console.log('\n[设备2] 1. 使用相同凭证登录...');
    const loginData = {
      email: userEmail,
      password: userPassword
    };

    const loginRes = await makeRequest('POST', '/api/auth/login', loginData);
    if (loginRes.status !== 200) {
      throw new Error(`登录失败: ${JSON.stringify(loginRes.data)}`);
    }
    console.log('✓ 设备2登录成功');
    console.log(`  用户ID: ${loginRes.data.data.user.id}`);
    console.log(`  用户名: ${loginRes.data.data.user.username}`);

    device2Token = loginRes.data.data.token;

    // 验证两个设备的用户ID是否相同
    console.log('\n[验证] 比较两个设备的用户ID...');
    if (loginRes.data.data.user.id !== userId) {
      throw new Error(`错误：设备2的用户ID(${loginRes.data.data.user.id})与设备1(${userId})不一致！`);
    }
    console.log('✓ 两个设备的用户ID一致');

    // 验证两个设备的token是否不同
    console.log('\n[验证] 比较两个设备的Token...');
    if (device1Token === device2Token) {
      console.log('⚠  两个设备的Token相同（可能不是问题，但值得注意）');
    } else {
      console.log('✓ 两个设备的Token不同（符合预期）');
    }

    // 6. 设备2查询所有笔记
    console.log('\n[设备2] 2. 查询所有笔记...');
    const notesRes2 = await makeRequest('GET', '/api/notes', null, device2Token);
    if (notesRes2.status !== 200) {
      throw new Error(`获取笔记列表失败: ${JSON.stringify(notesRes2.data)}`);
    }
    console.log('✓ 设备2笔记列表获取成功');
    console.log(`  笔记数量: ${notesRes2.data.data.pagination.total}`);

    // 7. 设备2查询所有复盘
    console.log('\n[设备2] 3. 查询所有复盘...');
    const reviewsRes2 = await makeRequest('GET', '/api/reviews', null, device2Token);
    if (reviewsRes2.status !== 200) {
      throw new Error(`获取复盘列表失败: ${JSON.stringify(reviewsRes2.data)}`);
    }
    console.log('✓ 设备2复盘列表获取成功');
    console.log(`  复盘数量: ${reviewsRes2.data.data.pagination.total}`);

    // ============ 数据一致性验证 ============
    console.log('\n' + '='.repeat(60));
    console.log('【数据一致性验证】');
    console.log('='.repeat(60));

    // 验证笔记数量
    console.log('\n[验证] 笔记数量一致性...');
    if (notesRes1.data.data.pagination.total !== notesRes2.data.data.pagination.total) {
      throw new Error(`错误：笔记数量不一致！设备1: ${notesRes1.data.data.pagination.total}, 设备2: ${notesRes2.data.data.pagination.total}`);
    }
    console.log('✓ 笔记数量一致');

    // 验证复盘数量
    console.log('\n[验证] 复盘数量一致性...');
    if (reviewsRes1.data.data.pagination.total !== reviewsRes2.data.data.pagination.total) {
      throw new Error(`错误：复盘数量不一致！设备1: ${reviewsRes1.data.data.pagination.total}, 设备2: ${reviewsRes2.data.data.pagination.total}`);
    }
    console.log('✓ 复盘数量一致');

    // 验证设备2能否获取设备1创建的笔记
    console.log('\n[验证] 设备2能否获取设备1创建的笔记...');
    const noteRes2 = await makeRequest('GET', `/api/notes/${createdNoteId}`, null, device2Token);
    if (noteRes2.status !== 200) {
      throw new Error(`设备2无法获取笔记！状态码: ${noteRes2.status}`);
    }
    console.log('✓ 设备2成功获取设备1创建的笔记');
    console.log(`  笔记标题: ${noteRes2.data.data.title}`);
    console.log(`  内容长度: ${noteRes2.data.data.content.length} 字符`);

    // 验证笔记内容是否一致
    if (noteRes2.data.data.content !== createdNoteContent.content) {
      throw new Error('笔记内容不一致！');
    }
    console.log('✓ 笔记内容完全一致');

    // 验证设备2能否获取设备1创建的复盘
    console.log('\n[验证] 设备2能否获取设备1创建的复盘...');
    const reviewRes2 = await makeRequest('GET', `/api/reviews/${createdReviewId}`, null, device2Token);
    if (reviewRes2.status !== 200) {
      throw new Error(`设备2无法获取复盘！状态码: ${reviewRes2.status}`);
    }
    console.log('✓ 设备2成功获取设备1创建的复盘');
    const reviewDate = reviewRes2.data.data.date;
    const reviewDateString = typeof reviewDate === 'string' ? reviewDate.split('T')[0] : reviewDate.toISOString().split('T')[0];
    console.log(`  复盘日期: ${reviewDateString}`);
    console.log(`  情绪评分: ${reviewRes2.data.data.mood}`);

    // 验证复盘内容是否一致
    if (reviewRes2.data.data.content !== createdReviewContent.content) {
      throw new Error('复盘内容不一致！');
    }
    console.log('✓ 复盘内容完全一致');

    // 8. 设备2创建新笔记
    console.log('\n[设备2] 4. 创建新笔记...');
    const device2NoteData = {
      title: '设备2创建的笔记',
      content: '这是设备2创建的笔记内容，用于测试双向同步。'
    };
    const device2NoteRes = await makeRequest('POST', '/api/notes', device2NoteData, device2Token);
    if (device2NoteRes.status !== 201) {
      throw new Error(`设备2创建笔记失败: ${JSON.stringify(device2NoteRes.data)}`);
    }
    console.log('✓ 设备2笔记创建成功');
    console.log(`  笔记ID: ${device2NoteRes.data.data.id}`);

    // 9. 验证设备1能否看到设备2创建的笔记
    console.log('\n[验证] 设备1能否看到设备2创建的笔记...');
    const notesRes1Again = await makeRequest('GET', '/api/notes', null, device1Token);
    if (notesRes1Again.status !== 200) {
      throw new Error(`获取笔记列表失败: ${JSON.stringify(notesRes1Again.data)}`);
    }
    console.log('✓ 设备1笔记列表获取成功');
    console.log(`  笔记数量: ${notesRes1Again.data.data.pagination.total}（之前为${notesRes1.data.data.pagination.total}）`);

    if (notesRes1Again.data.data.pagination.total !== notesRes1.data.data.pagination.total + 1) {
      throw new Error('设备1未看到设备2创建的笔记！');
    }
    console.log('✓ 设备1成功看到设备2创建的笔记');

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试通过！');
    console.log('='.repeat(60));
    console.log('\n测试结论：');
    console.log('✓ 用户使用相同邮箱在不同设备登录后，能够访问相同的数据');
    console.log('✓ 设备1创建的数据，设备2可以访问');
    console.log('✓ 设备2创建的数据，设备1也能看到');
    console.log('✓ 数据内容完全一致');
    console.log('✓ 支持双向同步');
    console.log('\n这证明 WebNote 的多设备同步功能正常工作！');

  } catch (error) {
    console.error('\n❌ 测试失败：');
    console.error(error.message);
    process.exit(1);
  }
}

testMultiDeviceLogin();
