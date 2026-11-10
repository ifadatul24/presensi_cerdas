LUEPRINT SISTEM PERANGKAT LUNAK

**Judul Penelitian:** Rancang Bangun Aplikasi Presensi Cerdas Multi-Platform dengan Pelacakan Objek Bergerak Menggunakan Pendekatan Video-Based Face Recognition

---

## 1. PENDAHULUAN
Dokumen ini merupakan spesifikasi rancangan (blueprint) untuk pengembangan sistem presensi sekolah terintegrasi. Sistem ini memanfaatkan kecerdasan buatan (Artificial Intelligence) dalam bidang Computer Vision untuk mendeteksi dan mengenali wajah siswa dalam kondisi bergerak (in-motion) tanpa harus berhenti di depan mesin presensi. Sistem diimplementasikan dalam ekosistem multi-platform (Web, Android, iOS) yang menghubungkan perangkat edge (kamera), server backend, dan aplikasi pengguna.

## 2. ARSITEKTUR SISTEM
Sistem dibangun menggunakan pendekatan arsitektur Three-Layer untuk memastikan modularitas dan skalabilitas:

1. **Presentation Layer (Klien):** Aplikasi Mobile (Siswa/Orang Tua), Web Dashboard (Admin/Guru).
2. **Business & API Layer (Backend):** RESTful API atau GraphQL yang menjembatani klien dengan basis data dan menangani logika bisnis (validasi, notifikasi, rekapitulasi).
3. **Data & AI Layer (Core Engine):**
   * Message Broker (Kafka/RabbitMQ) untuk menangani antrean data video.
   * AI Pipeline (YOLOv8 + Deep SORT + ArcFace) untuk pemrosesan citra.
   * Database Relasional untuk menyimpan data operasional dan vektor array wajah.

## 3. DAFTAR FITUR SISTEM

### 3.1. Modul Core Engine (Sistem AI)
* **Video Stream Capture:** Modul penangkap feed video secara kontinu dari berbagai node kamera IP RTSP (Real-Time Streaming Protocol).
* **Dynamic Face Detection & Tracking:** Pendeteksian wajah real-time (YOLOv8) dan pelacakan id objek sementara (Deep SORT).
* **Best-Frame Extraction:** Penyeleksian frame otomatis yang mengeliminasi gambar blur dan memilih pose frontal terbaik.
* **Face Matching & Verification:** Pencocokan matriks vektor wajah (ArcFace) dengan tingkat akurasi tinggi (cosine similarity).
* **Liveness Detection (Opsional):** Anti-spoofing untuk menolak presensi menggunakan foto 2D atau layar gawai.

### 3.2. Modul Administrator (Web Dashboard)
* **Executive Dashboard:** Visualisasi statistik kehadiran, keterlambatan, dan tingkat absensi harian/bulanan.
* **Manajemen Master Data (CRUD):** Pengelolaan entitas Siswa, Guru, Kelas, dan Tahun Ajaran.
* **Manajemen Node Kamera:** Registrasi IP Camera, pemetaan lokasi (misal: "Gerbang Utara"), dan health-check status perangkat.
* **Face Enrollment Studio:** Antarmuka pendaftaran sampel wajah siswa baru.
* **Reporting & Export:** Modul ekspor rekapitulasi data ke format Excel (XLSX), PDF, atau integrasi API ke sistem Dapodik.

### 3.3. Modul Guru & Tenaga Kependidikan (Web / Tablet)
* **Live Class Monitor:** Pemantauan status presensi siswa secara langsung berdasarkan jadwal kelas saat ini.
* **Manual Override:** Antarmuka untuk mengubah status presensi secara manual jika terjadi anomali pengenalan wajah.
* **Approval Management:** Persetujuan atau penolakan permohonan izin/sakit siswa.

### 3.4. Modul Orang Tua & Siswa (Mobile App)
* **Real-time Push Notifications:** Peringatan instan (FCM/APNs) saat siswa terdeteksi masuk atau keluar area sekolah.
* **Attendance History:** Tampilan kalender riwayat kehadiran dan akumulasi persentase.
* **Digital Leave Request:** Formulir pengajuan izin tidak masuk, dilengkapi fitur unggah dokumen (surat dokter/izin).

## 4. ALUR PROSES BISNIS (SOP)

### Alur Kerja AI (Face Recognition Pipeline)
1. **Streaming:** Kamera gerbang mengirimkan aliran video 15-30 FPS ke server AI.
2. **Detection:** Model YOLOv8 mendeteksi seluruh koordinat kotak pembatas (bounding box) wajah pada frame.
3. **Tracking:** Algoritma Deep SORT membaca kotak pembatas dan mengaitkannya dengan objek dari frame sebelumnya untuk memberi ID sementara (contoh: ID-99).
4. **Extraction:** Saat ID-99 berada dalam posisi paling optimal, sistem mengambil 1 frame dan melakukan cropping.
5. **Encoding & Matching:** ArcFace mengubah gambar crop wajah menjadi vektor array numerik, lalu membandingkannya dengan database dalam memori.
6. **Trigger:** Jika kecocokan > 85%, sistem mengirim muatan (payload) ke Backend API berisi `user_id`, `camera_id`, dan waktu.

### Alur Kerja Presensi Aplikasi
1. Backend API menerima muatan dari AI Pipeline.
2. Sistem mengecek tabel schedules untuk menentukan status "Hadir Tepat Waktu" atau "Terlambat".
3. Sistem menyimpan data ke tabel `attendance_logs`.
4. Sistem memicu Push Notification ke device token aplikasi mobile orang tua dari `user_id` yang bersangkutan.

## 5. STRUKTUR DATA KOMPREHENSIF (SKEMA DATABASE)

| Nama Tabel | Kolom / Atribut | Relasi / Tipe Data | Deskripsi |
| :--- | :--- | :--- | :--- |
| **users** | id (PK), nomor_induk, nama, role, password_hash, status | UUID, ENUM (Siswa/Guru/Admin) | Data induk pengguna aplikasi. |
| **face_encodings** | id (PK), user_id (FK), vector_data, created_at | FK ke users, FLOAT / JSON | Matriks angka representasi wajah. |
| **camera_nodes** | id (PK), lokasi, ip_address, arah | UUID, ENUM (In/Out) | Data titik pemasangan CCTV. |
| **schedules** | id (PK), mapel, jam_mulai, jam_selesai, kelas_id, guru_id | UUID, TIME, FK | Jadwal batas waktu kehadiran. |
| **attendance_logs** | id (PK), user_id (FK), camera_id (FK), waktu, status, confidence, img_url | FK ke users & camera_nodes, TIMESTAMP | Catatan transaksi setiap wajah dikenali. |
| **leave_requests** | id (PK), user_id (FK), tgl_mulai, tgl_selesai, alasan, bukti_url, status_izin | FK ke users, DATE, ENUM | Data pengajuan ketidakhadiran. |

## 6. REKOMENDASI TEKNOLOGI (TECH STACK)
* **Computer Vision (Edge/Server AI):** Python, PyTorch / OpenCV, YOLOv8 (Ultralytics), Deep SORT, ArcFace (InsightFace).
* **Backend Services:** Node.js (NestJS / Express) atau Golang.
* **Database:** PostgreSQL (Mendukung tipe data array `FLOAT[]` untuk vektor) atau Milvus (Vector Database khusus) dipadukan dengan Redis (untuk caching).
* **Frontend (Admin/Guru):** React.js atau Vue.js (Web Browser).
* **Mobile App (Ortu/Siswa):** Flutter atau React Native.
* **Komunikasi Antar Layanan:** REST API, WebSocket (untuk Live Monitor), dan RabbitMQ / Apache Kafka (Penanganan antrean data dari AI ke Backend).