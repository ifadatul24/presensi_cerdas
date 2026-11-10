import { useState, useEffect } from 'react';
import { 
  Users, Video, CheckCircle2, Clock, 
  FileText, Camera, ShieldCheck, ChevronRight, Activity, 
  UserCheck, Sparkles, Plus, Search
} from 'lucide-react';

interface AttendanceLog {
  id: string;
  nama: string;
  nomor_induk: string;
  nama_kelas: string;
  waktu: string;
  status: 'TEPAT_WAKTU' | 'TERLAMBAT' | 'PULANG' | 'MANUAL_OVERRIDE';
  confidence: number;
  camera_name: string;
  img_url?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'live' | 'enrollment' | 'students' | 'cameras' | 'leave'>('dashboard');
  const [stats] = useState({
    totalSiswa: 450,
    hadirTepatWaktu: 382,
    hadirTerlambat: 28,
    izinSakit: 14,
    alpa: 26,
    persentaseKehadiran: 91,
    kameraOnline: 4,
    totalKamera: 4
  });

  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([
    {
      id: '1',
      nama: 'Ahmad Rizky Pratama',
      nomor_induk: '0061234561',
      nama_kelas: 'X RPL 1',
      waktu: '06:48:12',
      status: 'TEPAT_WAKTU',
      confidence: 0.94,
      camera_name: 'Gerbang Masuk Utama 1'
    },
    {
      id: '2',
      nama: 'Siti Nurhaliza',
      nomor_induk: '0061234562',
      nama_kelas: 'X RPL 1',
      waktu: '06:51:04',
      status: 'TEPAT_WAKTU',
      confidence: 0.89,
      camera_name: 'Gerbang Masuk Utama 1'
    },
    {
      id: '3',
      nama: 'Bagus Setiawan',
      nomor_induk: '0061234563',
      nama_kelas: 'XI RPL 1',
      waktu: '07:18:45',
      status: 'TERLAMBAT',
      confidence: 0.91,
      camera_name: 'Gerbang Masuk Utama 2'
    }
  ]);

  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket Simulation / Real Connection
  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${window.location.host}/ws/live`);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'NEW_ATTENDANCE' && payload.data) {
            const newLog: AttendanceLog = {
              id: payload.data.id || String(Date.now()),
              nama: payload.data.user.nama,
              nomor_induk: payload.data.user.nomor_induk,
              nama_kelas: payload.data.user.kelas,
              waktu: new Date(payload.data.waktu).toLocaleTimeString('id-ID'),
              status: payload.data.status,
              confidence: payload.data.confidence,
              camera_name: payload.data.camera.nama,
              img_url: payload.data.img_url
            };
            setLiveLogs(prev => [newLog, ...prev.slice(0, 19)]);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };
    } catch (e) {
      console.warn('WebSocket connection not available in local mode');
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 tracking-tight flex items-center gap-2">
              PRESENSI CERDAS
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200/60">
                AI Video-Based
              </span>
            </h1>
            <p className="text-xs text-slate-500">In-Motion Multi-Platform Face Recognition System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
            <span>{wsConnected ? 'Live Stream Terhubung' : 'Standby Mode'}</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              AD
            </div>
            <div className="text-left text-xs">
              <p className="font-semibold text-slate-700">Administrator</p>
              <p className="text-slate-400">admin@sekolah.sch.id</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar Nav */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Navigasi Utama</div>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            Executive Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('live')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'live' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Video className="w-4 h-4" />
            Live Monitor Gerbang
            <span className="ml-auto text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
          </button>

          <button 
            onClick={() => setActiveTab('enrollment')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'enrollment' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Face Enrollment Studio
          </button>

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-4 mb-2">Manajemen</div>
          <button 
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Master Data Siswa
          </button>

          <button 
            onClick={() => setActiveTab('cameras')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'cameras' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-4 h-4" />
            Node Kamera RTSP
          </button>

          <button 
            onClick={() => setActiveTab('leave')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'leave' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Pengajuan Izin / Sakit
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Executive Attendance Dashboard</h2>
                <p className="text-slate-500 text-sm mt-0.5">Monitoring kehadiran real-time hari ini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hadir Tepat Waktu</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.hadirTepatWaktu}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-1">Siswa masuk sebelum 07:15</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Terlambat</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.hadirTerlambat}</p>
                  <p className="text-xs text-amber-600 font-medium mt-1">Presensi di atas toleransi</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Izin & Sakit</span>
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.izinSakit}</p>
                  <p className="text-xs text-sky-600 font-medium mt-1">Telah disetujui wali kelas</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tingkat Kehadiran</span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-indigo-600 mt-2">{stats.persentaseKehadiran}%</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Total {stats.totalSiswa} Siswa Terdaftar</p>
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <Video className="w-5 h-5 text-indigo-600" />
                    Aliran Presensi Masuk Terbaru
                  </h3>
                  <button 
                    onClick={() => setActiveTab('live')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    Buka Full Live Monitor <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs">
                        <th className="pb-3">Siswa</th>
                        <th className="pb-3">Kelas</th>
                        <th className="pb-3">Waktu Deteksi</th>
                        <th className="pb-3">Kamera Node</th>
                        <th className="pb-3">Confidence AI</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {liveLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="py-3">
                            <p className="font-bold text-slate-800">{log.nama}</p>
                            <p className="text-xs text-slate-400">{log.nomor_induk}</p>
                          </td>
                          <td className="py-3 text-slate-600">{log.nama_kelas}</td>
                          <td className="py-3 font-mono text-xs text-slate-600">{log.waktu}</td>
                          <td className="py-3 text-slate-500 text-xs">{log.camera_name}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
                              {(log.confidence * 100).toFixed(1)}% Match
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              log.status === 'TEPAT_WAKTU' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : log.status === 'TERLAMBAT'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {log.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Live Class & Gate Monitor</h2>
                  <p className="text-slate-500 text-sm">Pemantauan visual aliran presensi siswa bergerak dari IP Camera.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                    STREAMING ACTIVE
                  </span>
                </div>
              </div>

              {/* Video Mock Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 relative aspect-video flex flex-col justify-between p-4">
                  <div className="flex justify-between items-center text-white z-10">
                    <span className="text-xs font-mono bg-black/60 px-2 py-1 rounded">CAM-01: GERBANG UTAMA MASUK</span>
                    <span className="text-xs bg-emerald-500/80 px-2 py-1 rounded font-bold">25 FPS (YOLOv8)</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-xs">
                    <div className="text-center">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-40 text-indigo-400 animate-pulse" />
                      <p>In-Motion Face Tracker Active</p>
                      <p className="text-[10px] text-slate-600 mt-1">Deep SORT Object ID: Tracking Enabled</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono z-10 bg-black/40 p-1.5 rounded">
                    <span>RTSP: rtsp://192.168.1.101:554/live</span>
                    <span>Laplacian Filter: OK (&gt;80.0)</span>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 relative aspect-video flex flex-col justify-between p-4">
                  <div className="flex justify-between items-center text-white z-10">
                    <span className="text-xs font-mono bg-black/60 px-2 py-1 rounded">CAM-02: GERBANG KELUAR</span>
                    <span className="text-xs bg-emerald-500/80 px-2 py-1 rounded font-bold">25 FPS</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-xs">
                    <div className="text-center">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-40 text-emerald-400" />
                      <p>In-Motion Exit Gate Tracker</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono z-10 bg-black/40 p-1.5 rounded">
                    <span>RTSP: rtsp://192.168.1.102:554/live</span>
                    <span>Status: STANDBY</span>
                  </div>
                </div>
              </div>

              {/* Real-time Event Feed */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>Feed Deteksi Wajah Instan</span>
                  <span className="text-xs font-normal text-slate-500">Maksimum 20 log terakhir</span>
                </h3>
                <div className="space-y-3">
                  {liveLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                          {log.nama.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{log.nama}</p>
                          <p className="text-xs text-slate-500">{log.nomor_induk} &bull; {log.nama_kelas} &bull; {log.camera_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-1 ${
                          log.status === 'TEPAT_WAKTU' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.status.replace('_', ' ')}
                        </span>
                        <p className="text-xs font-mono text-slate-400">{log.waktu} | {(log.confidence * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrollment' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Face Enrollment Studio</h2>
                <p className="text-slate-500 text-sm">Pendaftaran biometrik sampel wajah siswa ke dalam representasi vektor ArcFace (512 dimensi).</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Pilih Siswa</label>
                    <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-indigo-500">
                      <option>Ahmad Rizky Pratama (0061234561) - X RPL 1</option>
                      <option>Siti Nurhaliza (0061234562) - X RPL 1</option>
                      <option>Bagus Setiawan (0061234563) - XI RPL 1</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mode Pendaftaran</label>
                    <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-indigo-500">
                      <option>Webcam Live Capture (3 Sudut Pose)</option>
                      <option>Unggah Berkas Foto Beresolusi Tinggi</option>
                    </select>
                  </div>
                </div>

                {/* Camera Viewfinder */}
                <div className="border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/40 p-8 text-center flex flex-col items-center justify-center min-h-[260px]">
                  <div className="w-20 h-20 rounded-full bg-white shadow-md flex items-center justify-center text-indigo-600 mb-3 border border-indigo-100">
                    <Camera className="w-10 h-10" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Posisikan Wajah Menghadap Kamera</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">Pastikan pencahayaan cukup dan tidak menggunakan masker atau kacamata hitam.</p>
                  <button className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-200 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Ambil Sampel & Ekstrak Vektor
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="font-bold text-slate-700">Parameter Kualitas Biometrik:</p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-slate-600">
                    <span>Pose Frontal: <strong className="text-emerald-600">Terpenuhi</strong></span>
                    <span>Blur Score: <strong className="text-emerald-600">&gt; 120 (Sangat Tajam)</strong></span>
                    <span>Dimensi Vektor: <strong className="text-indigo-600">512 Float</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Master Data Siswa</h2>
                  <p className="text-slate-500 text-sm">Daftar siswa, kelas, dan status registrasi biometrik wajah.</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm">
                  <Plus className="w-4 h-4" /> Tambah Siswa Baru
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input 
                      type="text" 
                      placeholder="Cari nama atau NISN siswa..."
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-indigo-500"
                    />
                  </div>
                  <select className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50">
                    <option>Semua Kelas</option>
                    <option>X RPL 1</option>
                    <option>XI RPL 1</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs">
                        <th className="pb-3">NISN</th>
                        <th className="pb-3">Nama Lengkap</th>
                        <th className="pb-3">Kelas</th>
                        <th className="pb-3">Status Biometrik</th>
                        <th className="pb-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="py-3 font-mono text-xs">0061234561</td>
                        <td className="py-3 font-semibold text-slate-800">Ahmad Rizky Pratama</td>
                        <td className="py-3 text-slate-600">X RPL 1</td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar (3 Sampel)
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button className="text-xs text-indigo-600 hover:underline font-semibold">Kelola Vektor</button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="py-3 font-mono text-xs">0061234562</td>
                        <td className="py-3 font-semibold text-slate-800">Siti Nurhaliza</td>
                        <td className="py-3 text-slate-600">X RPL 1</td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar (3 Sampel)
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button className="text-xs text-indigo-600 hover:underline font-semibold">Kelola Vektor</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cameras' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Node Kamera IP (RTSP)</h2>
                  <p className="text-slate-500 text-sm">Registrasi alamat IP dan URL streaming RTSP kamera gerbang sekolah.</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm">
                  <Plus className="w-4 h-4" /> Daftarkan Kamera Baru
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Gerbang Masuk Utama 1</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">ONLINE</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 font-mono">
                    <p>IP Address: 192.168.1.101</p>
                    <p>Arah: MASUK (IN)</p>
                    <p className="truncate">RTSP: rtsp://192.168.1.101:554/live</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Gerbang Keluar 1</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">ONLINE</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 font-mono">
                    <p>IP Address: 192.168.1.102</p>
                    <p>Arah: KELUAR (OUT)</p>
                    <p className="truncate">RTSP: rtsp://192.168.1.102:554/live</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Persetujuan Izin / Sakit</h2>
                <p className="text-slate-500 text-sm">Daftar permohonan izin dari aplikasi mobile orang tua / siswa.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs">
                        <th className="pb-3">Siswa</th>
                        <th className="pb-3">Kategori</th>
                        <th className="pb-3">Periode</th>
                        <th className="pb-3">Alasan</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="py-3">
                          <p className="font-bold text-slate-800">Ahmad Rizky Pratama</p>
                          <p className="text-xs text-slate-400">X RPL 1</p>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700">SAKIT</span>
                        </td>
                        <td className="py-3 text-xs text-slate-600">09 Nov 2026 - 10 Nov 2026</td>
                        <td className="py-3 text-xs text-slate-600">Demam dan istirahat dokter</td>
                        <td className="py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">PENDING</span>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold">Setujui</button>
                          <button className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold">Tolak</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
