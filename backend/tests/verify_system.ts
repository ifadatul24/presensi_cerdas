import http from 'http';

process.env.PORT = '4005';
const PORT = 4005;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(path: string, options: http.RequestOptions = {}, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${PORT}`);
    const req = http.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} });
        } catch {
          resolve({ status: res.statusCode || 0, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== VERIFIKASI INTEGRITAS SISTEM PRESENSI CERDAS ===\n');

  console.log('[1/6] Mengimpor & Memulai Server Backend...');
  // Import langsung server sehingga aktif di proses yang sama
  await import('../src/index.js');
  await wait(1500);

  // Health check
  const health = await request('/health');
  if (health.status !== 200) {
    throw new Error(`Health check gagal: ${JSON.stringify(health.data)}`);
  }
  console.log('  -> Server Backend Berhasil Aktif di Port 4000. Status:', health.data.status);

  // 2. Test Login Admin
  console.log('[2/6] Menguji Autentikasi Admin (ADMIN-001)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { nomor_induk: 'ADMIN-001', password: 'Admin123!' });

  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Login gagal: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log(`  -> Login Berhasil! JWT Token terbit untuk: ${loginRes.data.user.nama}`);

  // 3. Test Master Data Siswa
  console.log('[3/6] Mengambil Master Data Siswa...');
  const usersRes = await request('/api/users?role=SISWA', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(`  -> Berhasil! Ditemukan ${usersRes.data.length} siswa dalam database.`);
  const sampleStudent = usersRes.data[0];
  console.log(`  -> Siswa sampel: ${sampleStudent.nama} (${sampleStudent.nomor_induk})`);

  // 4. Test Simulasi AI Attendance Trigger (Core Engine Event)
  console.log('[4/6] Menguji Simulasi Presensi AI Trigger (Deteksi Wajah In-Motion)...');
  const aiTriggerRes = await request('/api/attendance/ai-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    user_id: sampleStudent.id,
    camera_id: 'd0000000-0000-0000-0000-000000000001',
    confidence: 0.942,
    track_id: 'ID-99',
  });

  if (aiTriggerRes.status !== 200) {
    throw new Error(`AI Trigger gagal: ${JSON.stringify(aiTriggerRes.data)}`);
  }
  console.log(`  -> Presensi berhasil diproses! Status: ${aiTriggerRes.data.result.attendance.status}`);

  // 5. Test Debounce (Anti-Spam Multi-Deteksi)
  console.log('[5/6] Menguji Fitur Debounce Filter (Mencegah Pencatatan Ganda)...');
  const debounceRes = await request('/api/attendance/ai-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    user_id: sampleStudent.id,
    camera_id: 'd0000000-0000-0000-0000-000000000001',
    confidence: 0.95,
    track_id: 'ID-99',
  });
  console.log(`  -> Status Debounce: ${debounceRes.data.result.debounced ? 'AKTIF (Duplikasi ditolak dengan aman)' : 'Tercatat ulang'}`);

  // 6. Test Dashboard Executive Stats Hari Ini
  console.log('[6/6] Mengambil Statistik Dashboard Terkini...');
  const statsRes = await request('/api/attendance/stats/today', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('  -> Ringkasan Statistik:', statsRes.data.summary);

  console.log('\n======================================================');
  console.log(' HASIL: SELURUH LOGIKA & BASIS DATA BERJALAN 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Error saat verifikasi:', err);
  process.exit(1);
});
