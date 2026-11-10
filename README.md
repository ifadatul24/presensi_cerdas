# Presensi Cerdas Multi-Platform (Video-Based Face Recognition)

Sistem presensi cerdas nirsentuh berbasis pengenalan wajah siswa dalam kondisi bergerak (*in-motion walk-through*) menggunakan integrasi **YOLOv8**, **Deep SORT / ByteTrack**, dan **ArcFace (InsightFace)**.

> **100% Native & Standalone (Tanpa Wajib Docker):**  
> Sistem dapat langsung dijalankan di sistem operasi Windows tanpa perlu menginstal Docker, PostgreSQL server eksternal, atau RabbitMQ. Sistem otomatis menggunakan **SQLite** (termasuk kalkulasi Cosine Similarity 512-dimensi in-memory), antrean in-process, dan in-memory cache.

---

## 🏗️ Arsitektur Tiga Lapis (Three-Layer Architecture)

```
┌────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                   │
│   • Web Dashboard Admin & Guru (React + Vite)          │
│   • Mobile App Siswa & Orang Tua (Flutter)             │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST / WebSocket / FCM
┌──────────────────────────▼─────────────────────────────┐
│                 BUSINESS & API LAYER                   │
│   • Node.js Backend API (Express + TypeScript)         │
│   • WebSocket Live Broadcaster                         │
│   • Event Receiver (Direct HTTP & AMQP Fallback)       │
│   • Database: SQLite (Zero-Docker) / PostgreSQL        │
└──────────────────────────▲─────────────────────────────┘
                           │ Direct HTTP / Events
┌──────────────────────────┴─────────────────────────────┐
│                   DATA & AI LAYER                      │
│   • Edge / Server AI Engine (Python 3.12 + PyTorch)    │
│   • Video Ingestion: Langsung Webcam / File MP4 / RTSP │
│   • Face Detection (YOLOv8-Face)                       │
│   • Object Tracking (Deep SORT / Centroid Tracker)     │
│   • Anti-Blur Filtering (Laplacian Variance)           │
│   • Feature Extraction & Matching (ArcFace 512-dim)    │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Struktur Repositori

```text
presensi-cerdas/
├── blueprint_sistem_perangkat_lunak.md    # Dokumen spesifikasi blueprint
├── rencana_pengembangan.md                # Roadmap & panduan teknis fase 0-6
├── .env.example                           # Konfigurasi Standalone (DB_TYPE=sqlite)
│
├── backend/                               # REST API & WebSocket Service (Node.js/TS)
│   ├── database/
│   │   ├── presensi.sqlite                # Database lokal otomatis dibuat saat start
│   │   ├── schema.sql                     # DDL PostgreSQL jika beralih ke Postgres
│   │   └── migrate.ts                     # Runner migrasi
│   ├── src/
│   │   ├── config/                        # Konfigurasi & env loader
│   │   ├── database/                      # SQLite & pgvector unified adapter
│   │   ├── middlewares/                   # JWT & Role-Based Access Control
│   │   ├── routes/                        # Auth, Users, Cameras, Schedules, Attendance, Leave
│   │   ├── services/                      # Attendance Engine, Live WebSocket, Push Notif
│   │   └── index.ts                       # Entrypoint server (Port 4000)
│   └── package.json
│
├── ai-engine/                             # Computer Vision Pipeline (Python 3.12)
│   ├── app/
│   │   ├── config.py                      # Konfigurasi threshold, model, endpoint
│   │   ├── stream_capture.py              # Multi-threaded Video/RTSP Ingestion
│   │   ├── detector.py                    # Detektor wajah YOLOv8
│   │   ├── tracker.py                     # Pelacak objek bergerak
│   │   ├── best_frame.py                  # Anti motion-blur filter
│   │   ├── recognizer.py                  # ArcFace 512-dim embedding & Cosine Matching
│   │   ├── publisher.py                   # Pengirim deteksi langsung ke Backend
│   │   └── pipeline.py                    # Main loop pipeline end-to-end
│   ├── tools/
│   │   └── mock_rtsp_feed.py              # Simulator video / webcam
│   └── requirements.txt
│
├── web/                                   # Admin & Guru Web Dashboard (React + Tailwind)
│   ├── src/
│   │   ├── App.tsx                        # Dashboard, Live Monitor, Enrollment, Data Siswa
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── mobile/                                # Aplikasi Siswa & Orang Tua (Flutter)
    ├── lib/
    │   ├── screens/                       # Home screen & Pengajuan Izin
    │   └── main.dart
    └── pubspec.yaml
```

---

## ⚡ Panduan Menjalankan Sistem (Tanpa Docker)

### 1. Menjalankan Backend API
Buka terminal (PowerShell / Command Prompt):
```powershell
cd "d:\presensi cerdas\backend"
npm run dev
```
* **Status:** Database SQLite (`database/presensi.sqlite`) otomatis dibuat dan di-seed dengan akun Admin dan Siswa default.
* **HTTP API:** `http://localhost:4000/api`
* **WebSocket Live:** `ws://localhost:4000/ws/live`
* **Akun Default Admin:**
  * Nomor Induk: `ADMIN-001`
  * Password: `Admin123!`

---

### 2. Menjalankan Web Dashboard Admin & Guru
Buka terminal baru:
```powershell
cd "d:\presensi cerdas\web"
npm run dev
```
Akses di browser: **`http://localhost:3000`**
Fitur yang langsung dapat dicoba:
* **Executive Dashboard:** Visualisasi metrik kehadiran harian.
* **Live Monitor Gerbang:** Menerima feed deteksi wajah secara real-time via WebSocket.
* **Face Enrollment Studio:** Antarmuka pendaftaran biometrik sampel wajah siswa.
* **Master Data Siswa & Kamera IP:** Pengelolaan master data sekolah.

---

### 3. Menjalankan AI Engine (Video Face Recognition)
Buka terminal baru:
```powershell
cd "d:\presensi cerdas\ai-engine"
# Install dependencies ke Python lokal
& "C:\Users\nala8\AppData\Local\Programs\Python\Python312\python.exe" -m pip install -r requirements.txt

# Jalankan pipeline AI
& "C:\Users\nala8\AppData\Local\Programs\Python\Python312\python.exe" -m app.pipeline
```
*(Jika ingin menguji pipeline langsung menggunakan webcam laptop):*
```powershell
& "C:\Users\nala8\AppData\Local\Programs\Python\Python312\python.exe" tools/mock_rtsp_feed.py --source 0
```

---

### 4. Menjalankan Aplikasi Mobile (Flutter)
Jika memiliki Flutter SDK di perangkat:
```powershell
cd "d:\presensi cerdas\mobile"
flutter run
```
Aplikasi mobile menampilkan:
* Profil siswa & status biometrik wajah walk-through.
* Riwayat presensi harian per jam & nama gerbang.
* Formulir pengajuan izin/sakit digital dengan unggah bukti surat.
