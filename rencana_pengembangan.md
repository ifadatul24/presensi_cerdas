# Rencana Pengembangan Sistem Presensi Cerdas Multi-Platform
## Video-Based Face Recognition dengan Pelacakan Objek Bergerak

Dokumen ini merupakan panduan eksekusi teknis dan peta jalan (roadmap) pengembangan dari [blueprint_sistem_perangkat_lunak.md](blueprint_sistem_perangkat_lunak.md). Rencana ini membagi siklus hidup proyek ke dalam 6 fase terstruktur dengan estimasi durasi total 18 minggu (4.5 bulan).

---

## 1. Ringkasan Eksekutif & Sasaran Sistem

Sistem ini bertujuan untuk menggantikan presensi konvensional (fingerprint/tap card/kamera statis berhenti) menjadi presensi nirsentuh berbasis aliran video real-time (*walk-through / in-motion attendance*).

### Indikator Keberhasilan (Success Metrics)
* **Kecepatan Deteksi & Matching:** < 800 ms per wajah dari aliran video RTSP.
* **Throughput Kamera:** Mampu memproses 15–30 FPS dengan deteksi multi-objek (hingga 3-5 siswa melintas bersamaan).
* **Akurasi Pencocokan (Cosine Similarity):** Threshold $\ge 0.85$ dengan False Acceptance Rate (FAR) $< 0.1\%$.
* **Keandalan Push Notifikasi:** Notifikasi terkirim ke gawai orang tua < 2 detik setelah presensi tercatat.
* **Uptime Service:** $\ge 99\%$ pada jam operasional gerbang masuk dan pulang sekolah.

---

## 2. Arsitektur Komponen & Alur Komunikasi

```mermaid
flowchart TD
    subgraph Edge ["Perangkat Fisik / Edge"]
        CAM1["IP Camera Gerbang Masuk (RTSP)"]
        CAM2["IP Camera Gerbang Keluar (RTSP)"]
    end

    subgraph AIServer ["Core AI Engine Server (GPU accelerated)"]
        CAP["Stream Ingestion & Buffer (OpenCV/FFmpeg)"]
        YOLO["Face Detection (YOLOv8-Face)"]
        TRACK["Object Tracking (Deep SORT / ByteTrack)"]
        BEST["Best-Frame & Blur Filter (Laplacian/Pose)"]
        EMBED["Feature Extraction (ArcFace / InsightFace)"]
        VSEARCH["Vector Matching (In-Memory / pgvector)"]
        COOLDOWN["Cooldown / Debounce Filter"]
    end

    subgraph MessageBroker ["Event Streaming"]
        MQ["RabbitMQ / Apache Kafka\n(Queue: attendance_events)"]
    end

    subgraph BackendLayer ["Backend Services"]
        API["REST & WebSocket API Gateway (NestJS/Go)"]
        SCHED["Schedule & Attendance Validation Engine"]
        FCM["Firebase Cloud Messaging (FCM) Service"]
        DB[(PostgreSQL + pgvector)]
        CACHE[(Redis Cache & Session)]
    end

    subgraph PresentationLayer ["Client Applications"]
        DASH["Web Admin & Guru Dashboard\n(React/Next.js + Tailwind)"]
        MOB["Mobile App Ortu & Siswa\n(Flutter: Android & iOS)"]
    end

    CAM1 -->|RTSP Stream| CAP
    CAM2 -->|RTSP Stream| CAP
    CAP --> YOLO --> TRACK --> BEST --> EMBED --> VSEARCH --> COOLDOWN
    COOLDOWN -->|Publish Event (user_id, cam_id, time)| MQ
    MQ -->|Consume Event| SCHED
    SCHED -->|Write Attendance Log| DB
    SCHED -->|Cache State / Active Session| CACHE
    SCHED -->|Trigger Real-time WebSocket| DASH
    SCHED -->|Trigger Push Notification| FCM
    FCM -->|Push Alert| MOB
    DASH <-->|REST API / WebSockets| API
    MOB <-->|REST API| API
    API <--> DB
```

---

## 3. Peta Jalan & Fase Pengembangan (18 Minggu)

### FASE 0: Persiapan, Spesifikasi Detail & Setup Lingkungan (Minggu 1 – 2)
**Tujuan:** Membangun fondasi arsitektur, lingkungan kerja tim, dan kepastian spesifikasi hardware.
* **Aktivitas:**
  1. **Finalisasi Desain Database (DDL & Migrations):**
     * Pembuatan schema PostgreSQL lengkap: `users`, `face_encodings` (menggunakan extension `pgvector`), `camera_nodes`, `schedules`, `attendance_logs`, `leave_requests`.
     * Indexing strategi (HNSW / IVFFlat untuk vektor, B-Tree untuk `user_id` dan `waktu`).
  2. **API Contract (OpenAPI / Swagger):**
     * Definisi endpoint untuk Master Data, Presensi, Streaming WebSocket, dan Notifikasi.
  3. **Penyiapan Lingkungan Komputasi AI & DevOps:**
     * Setup workstation GPU dengan CUDA 12.x, cuDNN, PyTorch, dan Docker (NVIDIA Container Toolkit).
     * Setup IP Camera testbench (atau RTSP emulator menggunakan RTSP-Simple-Server / MediaMTX dan sampel video rekaman gerbang sekolah).
  4. **Struktur Repositori:**
     * Pembentukan struktur monorepo atau multi-repo (`ai-engine/`, `backend-api/`, `web-dashboard/`, `mobile-app/`).
* **Deliverables:**
  * Skema migrasi database & seed data awal.
  * Dokumen API Contract Swagger/Postman Collection.
  * Lingkungan Docker Compose siap pakai (PostgreSQL, Redis, RabbitMQ, MediaMTX).

---

### FASE 1: Core AI Pipeline & Tracking Engine (Minggu 3 – 5)
**Tujuan:** Mengembangkan pipeline Computer Vision yang stabil, akurat, dan memiliki performa real-time pada objek bergerak.
* **Aktivitas:**
  1. **RTSP Stream Ingestion & Multi-threading:**
     * Implementasi modul pembaca RTSP multi-threaded yang tahan terhadap network drop / reconnecting.
  2. **Face Detection (YOLOv8-Face):**
     * Integrasi pre-trained YOLOv8-Face model dengan tuning confidence threshold (misal: $\ge 0.60$).
  3. **Multi-Object Tracking (Deep SORT / ByteTrack):**
     * Mengikat setiap wajah yang terdeteksi dengan persistent `track_id` sepanjang durasi berada di frame kamera.
  4. **Best-Frame Selection Algorithm:**
     * Menghitung nilai ketajaman gambar menggunakan *Laplacian Variance* (menolak frame blur akibat gerakan cepat).
     * Evaluasi pose wajah (*yaw, pitch, roll*) untuk memastikan wajah menghadap ke depan (frontal pose).
     * Mengambil 1 crop terbaik per `track_id` saat ukuran bounding box optimal.
  5. **Feature Extraction & Verification (ArcFace):**
     * Ekstraksi embedding 512-dimensi menggunakan model ArcFace (InsightFace).
     * Pencocokan vektor ke database menggunakan *Cosine Similarity*:
       $$\text{Similarity}(\mathbf{A}, \mathbf{B}) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\|_2 \|\mathbf{B}\|_2}$$
     * Thresholding: kecocokan $\ge 0.85$.
  6. **Cooldown / Debounce Mechanism:**
     * Mencegah spam presensi untuk orang yang sama dalam jendela waktu tertentu (misal: 10 menit cooldown untuk gerbang yang sama).
* **Deliverables:**
  * Service Python AI Engine mandiri yang mampu membaca RTSP dan mencetak log deteksi JSON.
  * Laporan benchmark FPS dan akurasi pada berbagai kecepatan jalan siswa.

---

### FASE 2: Backend API, Message Broker & Integrasi Real-Time (Minggu 6 – 8)
**Tujuan:** Membangun lapisan logika bisnis terpusat, pengolahan antrean, dan notifikasi instan.
* **Aktivitas:**
  1. **Message Queue Ingestion (RabbitMQ):**
     * Worker consumer yang memproses payload dari AI Engine secara asynchronous tanpa membuat AI pipeline terhenti (*non-blocking*).
  2. **Attendance Logic Engine:**
     * Pengecekan terhadap tabel `schedules`:
       * Waktu masuk < `jam_mulai`: *Hadir Tepat Waktu*
       * Waktu masuk antara `jam_mulai` s.d. batas toleransi: *Terlambat*
       * Pengecekan status hari libur atau izin aktif.
     * Pencatatan log ke `attendance_logs` dan snapshot gambar wajah ke Object Storage (MinIO / AWS S3 / Local Storage).
  3. **Sistem Autentikasi & RBAC (Role-Based Access Control):**
     * Implementasi JWT + Refresh Token untuk Admin, Guru, Siswa, dan Orang Tua.
  4. **Modul Master Data CRUD:**
     * API Siswa, Guru, Kelas, Jadwal, Node Kamera, dan Tahun Ajaran.
  5. **Push Notification Service (FCM):**
     * Registrasi device token gawai mobile orang tua.
     * Pengiriman otomatis notifikasi saat anak terdeteksi masuk/keluar gerbang:
       *"Ananda [Nama] telah tiba di sekolah pada pukul 06.48 WIB (Gerbang Utama)."*
  6. **WebSocket Server:**
     * Emisi event kehadiran instan untuk konsumsi Web Live Monitor di ruang guru/admin.
* **Deliverables:**
  * Backend API siap pakai dengan dokumentasi Swagger.
  * Worker queue yang stabil menangani lonjakan data jam sibuk pagi hari.

---

### FASE 3: Web Dashboard Admin & Guru (Minggu 9 – 11)
**Tujuan:** Menyediakan antarmuka manajemen terpusat, monitoring visual, dan administrasi kehadiran.
* **Aktivitas:**
  1. **Setup Frontend:**
     * Template dashboard responsive (React / Next.js / Vite + Tailwind CSS + Lucide Icons).
  2. **Executive Dashboard:**
     * Visualisasi statistik (grafik kehadiran harian, perbandingan per kelas, persentase keterlambatan).
  3. **Face Enrollment Studio:**
     * Fitur pendaftaran biometrik siswa baru:
       * Mengambil 3-5 foto multi-angle via webcam atau upload foto berkualitas tinggi.
       * Memanggil AI API untuk memverifikasi kualitas foto dan mengekstrak vektor embedding ke database.
  4. **Node Camera Manager:**
     * Manajemen kamera IP (RTSP URL, nama lokasi, arah In/Out, status online/offline ping).
  5. **Live Class Monitor (Guru):**
     * Halaman monitor kelas yang ter-update otomatis via WebSocket menampilkan daftar siswa hadir/belum hadir/izin secara real-time.
     * Tombol *Manual Override* untuk guru/admin jika ada siswa yang lupa terdeteksi atau presensi manual.
  6. **Modul Perizinan & Rekapitulasi Laporan:**
     * Approval permohonan izin/sakit siswa.
     * Ekspor laporan bulanan/semester ke Excel (XLSX), PDF rekapitulasi, dan format Dapodik.
* **Deliverables:**
  * Aplikasi Web Dashboard yang siap dioperasikan admin sekolah dan guru.

---

### FASE 4: Mobile Application (Orang Tua & Siswa) (Minggu 12 – 14)
**Tujuan:** Memberikan kemudahan transparansi presensi dan saluran izin digital langsung dari genggaman orang tua/siswa.
* **Aktivitas:**
  1. **Setup Flutter Framework:**
     * Desain UI/UX modern, ramah pengguna, mendukung Android dan iOS.
     * State management (BLoC / Riverpod).
  2. **Autentikasi & Profil Siswa:**
     * Login menggunakan NISN / Akun Orang Tua.
     * Multi-anak (satu akun orang tua dapat memantau lebih dari satu anak jika bersaudara).
  3. **Integrasi Push Notification (FCM / APNs):**
     * Penanganan notifikasi di latar belakang (*background*), saat aplikasi mati (*terminated*), maupun saat aplikasi aktif (*foreground*).
  4. **Attendance History & Kalender:**
     * Tampilan kalender dengan indikator warna (Hijau: Tepat Waktu, Kuning: Terlambat, Merah: Alpa, Biru: Izin/Sakit).
     * Detail riwayat: jam terdeteksi, foto snapshot wajah, dan nama gerbang.
  5. **Digital Leave Request (Pengajuan Izin/Sakit):**
     * Form pemilihan tanggal mulai-selesai dan alasan.
     * Fitur kamera/galeri untuk unggah bukti surat dokter atau surat izin orang tua.
     * Status tracking (Pending, Approved, Rejected) secara real-time.
* **Deliverables:**
  * Build APK Android (dan IPA iOS) yang siap diuji coba secara internal (*closed beta testing*).

---

### FASE 5: Integrasi End-to-End, Optimasi AI & Uji Lapangan (Minggu 15 – 16)
**Tujuan:** Menguji keandalan sistem dalam skenario dunia nyata dengan kerumunan siswa dan berbagai kondisi lingkungan.
* **Aktivitas:**
  1. **Integrasi Menyeluruh:**
     * Simulasi aliran: CCTV Gerbang $\rightarrow$ AI Pipeline $\rightarrow$ RabbitMQ $\rightarrow$ Backend $\rightarrow$ Dashboard Live $\rightarrow$ Push Notifikasi Mobile.
  2. **Optimasi AI Inference:**
     * Konversi model YOLOv8 dan ArcFace ke format **TensorRT (FP16 / INT8)** untuk melipatgandakan throughput FPS pada GPU NVIDIA.
     * Penyesuaian frame-skipping dinamis jika tidak ada objek bergerak pada frame.
  3. **Pengujian Lapangan (Field Testing):**
     * Uji pada kondisi pencahayaan kontras (pagi hari *backlight*, mendung, bayangan).
     * Uji skenario berjalan beriringan (occlusion / saling menutupi sebagian).
     * Uji ketahanan terhadap foto palsu (*Liveness / Anti-spoofing test*).
  4. **Stress & Load Testing:**
     * Pengujian beban pada backend dengan simulasi 500-1000 event presensi dalam jendela 15 menit jam masuk sekolah.
* **Deliverables:**
  * Laporan hasil uji performa (Akurasi, FPS, Latensi end-to-end, Resource GPU/CPU).
  * Model AI teroptimasi TensorRT.

---

### FASE 6: Deployment, Pelatihan & Serah Terima (Minggu 17 – 18)
**Tujuan:** Implementasi produksi di lingkungan sekolah dan transfer pengetahuan ke pihak sekolah.
* **Aktivitas:**
  1. **Instalasi Infrastruktur Sekolah:**
     * Pemasangan dan kalibrasi sudut kamera IP di gerbang masuk/keluar.
     * Konfigurasi VLAN jaringan terisolasi untuk CCTV demi keamanan trafik RTSP.
     * Setup Server GPU On-Premise di server room sekolah.
  2. **Data Enrollment Massal:**
     * Sesi pendaftaran sampel wajah siswa per kelas menggunakan Face Enrollment Studio.
  3. **Pelatihan Pengguna (Training & SOP):**
     * Pelatihan untuk Admin Sekolah (konfigurasi kamera, jadwal, master data, ekspor).
     * Pelatihan untuk Guru (Live monitor dan manual override).
     * Sosialisasi dan distribusi panduan instalasi aplikasi mobile untuk Orang Tua.
  4. **Go-Live & Masa Pendampingan (Hypercare):**
     * Pengawalan operasional hari-1 hingga hari-14 go-live.
* **Deliverables:**
  * Sistem terpasang dan berjalan live di sekolah.
  * Buku Panduan Pengguna (User Manual) Admin, Guru, dan Orang Tua.
  * SOP Pemeliharaan Sistem dan Backup Data.

---

## 4. Matriks Alokasi Sumber Daya & Tim

| Peran | Tanggung Jawab Utama | Alokasi Waktu |
| :--- | :--- | :--- |
| **Lead Architect / PM** | Mengawasi roadmap, manajemen risiko, integrasi arsitektur, koordinasi stakeholder. | Minggu 1 – 18 |
| **AI / Computer Vision Engineer** | Pipeline RTSP, YOLOv8, Deep SORT, ArcFace, TensorRT, anti-spoofing. | Minggu 1 – 16 |
| **Backend Engineer** | REST/WebSocket API, skema DB/pgvector, RabbitMQ, FCM, logika presensi. | Minggu 1 – 16 |
| **Frontend Web Engineer** | Dashboard Admin & Guru, Live Monitor WebSocket, Face Enrollment UI. | Minggu 6 – 16 |
| **Mobile Developer (Flutter)** | Aplikasi Siswa/Ortu, notifikasi FCM, histori, perizinan digital. | Minggu 8 – 16 |
| **DevOps & Hardware Specialist** | Jaringan CCTV RTSP, kalibrasi kamera, server GPU CUDA, Docker, deployment. | Minggu 1 – 3, 14 – 18 |
| **QA / Tester** | Uji akurasi biometrik, load testing, pengujian fungsionalitas & UAT. | Minggu 10 – 18 |

---

## 5. Analisis Risiko & Strategi Mitigasi

| Potensi Risiko | Tingkat Dampak | Probabilitas | Rencana Mitigasi |
| :--- | :---: | :---: | :--- |
| **Gerakan Cepat Menyebabkan Motion Blur** | Tinggi | Sedang | Filter Laplacian Variance membuang frame blur; mengambil frame saat subjek melambat menjelang pintu/gerbang. |
| **Pencahayaan Buruk / Backlight Ekstrem** | Tinggi | Tinggi | Gunakan kamera IP berkemampuan WDR (Wide Dynamic Range) $\ge 120\text{ dB}$; pasang lampu penerangan LED bantu jika diperlukan. |
| **Bottleneck Komputasi GPU Multi-Kamera** | Tinggi | Sedang | Optimasi model ke TensorRT FP16; batasi FPS analisis AI ke 15 FPS (cukup untuk pelacakan manusia); gunakan motion-detection gate. |
| **Siswa Melintas Berkerumun (Occlusion)** | Sedang | Tinggi | Kombinasi YOLOv8-Face + Deep SORT/ByteTrack melacak ID hingga wajah terlihat jelas; letakkan kamera pada sudut elevasi $15^\circ - 20^\circ$. |
| **Koneksi Jaringan RTSP Terputus** | Sedang | Sedang | Implementasi *auto-reconnect buffer* pada modul Ingestion; health-check otomatis dengan alert ke admin. |
| **Privasi Data Wajah Siswa** | Kritis | Rendah | Simpan representasi biometrik hanya dalam bentuk vektor embedding 512 numerik (tidak dapat direkonstruksi menjadi foto asli). Enkripsi data at-rest. |

---

## 6. Rekomendasi Spesifikasi Perangkat Keras (Hardware Baseline)

1. **Server AI & Backend (On-Premise):**
   * **CPU:** Min. 8 Core / 16 Thread (Intel Core i7 Gen 13/14 atau AMD Ryzen 7 / EPYC).
   * **GPU:** NVIDIA GeForce RTX 3060/4060 Ti (VRAM 12GB/16GB) atau NVIDIA RTX A4000 (disarankan untuk $\ge 4$ kamera stream simultan).
   * **RAM:** 32 GB DDR4 / DDR5.
   * **Penyimpanan:** 1 TB NVMe SSD (Sistem & Database) + 2 TB HDD (Arsip snapshot gambar).
2. **IP Camera (Titik Gerbang):**
   * Resolusi: Min. 1080p (2 MP) @ 25-30 FPS, disarankan 4 MP.
   * Sensor: Min. 1/2.8" Progressive Scan CMOS dengan True WDR (120 dB).
   * Lensa: Vari-focal 2.8mm - 12mm (dapat diatur fokusnya sesuai jarak koridor/pintu gerbang).
   * Protokol: RTSP / ONVIF compliant, support PoE (Power over Ethernet).
3. **Infrastruktur Jaringan:**
   * Switch PoE Gigabit khusus sistem presensi untuk menjamin bandwidth tanpa latensi tinggi.

