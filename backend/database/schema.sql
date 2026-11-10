-- ==============================================================================
-- SKEMA BASIS DATA: PRESENSI CERDAS (PostgreSQL 16 + pgvector)
-- ==============================================================================

-- Aktifkan ekstensi UUID dan pgvector
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. ENUM Tipe Data
CREATE TYPE user_role AS ENUM ('ADMIN', 'GURU', 'SISWA', 'ORANG_TUA');
CREATE TYPE user_status AS ENUM ('AKTIF', 'NONAKTIF', 'LULUS');
CREATE TYPE camera_direction AS ENUM ('IN', 'OUT');
CREATE TYPE camera_status AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');
CREATE TYPE attendance_status AS ENUM ('TEPAT_WAKTU', 'TERLAMBAT', 'PULANG', 'MANUAL_OVERRIDE');
CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE leave_category AS ENUM ('SAKIT', 'IZIN', 'DISPENSASI');

-- 2. TABEL KELAS
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_kelas VARCHAR(50) NOT NULL UNIQUE, -- Contoh: "X-RPL 1", "XI-IPA 2"
    tingkat VARCHAR(10) NOT NULL,           -- "10", "11", "12"
    jurusan VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL PENGGUNA (users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_induk VARCHAR(50) NOT NULL UNIQUE, -- NISN untuk siswa, NIP/NUPTK untuk guru
    nama VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE,
    nomor_telepon VARCHAR(20),
    role user_role NOT NULL DEFAULT 'SISWA',
    password_hash VARCHAR(255) NOT NULL,
    status user_status NOT NULL DEFAULT 'AKTIF',
    kelas_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    parent_of UUID REFERENCES users(id) ON DELETE SET NULL, -- Relasi Orang Tua -> Siswa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABEL VEKTOR ENCODING WAJAH (face_encodings)
-- Menggunakan model ArcFace (dimensi embedding: 512 FLOAT)
CREATE TABLE IF NOT EXISTS face_encodings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vector_data vector(512) NOT NULL,
    sample_quality_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index HNSW (Hierarchical Navigable Small World) untuk pencarian cepat Cosine Similarity
CREATE INDEX IF NOT EXISTS idx_face_encodings_vector 
ON face_encodings USING hnsw (vector_data vector_cosine_ops);

-- 5. TABEL NODE KAMERA (camera_nodes)
CREATE TABLE IF NOT EXISTS camera_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_node VARCHAR(100) NOT NULL,        -- Contoh: "Gerbang Masuk Utama 1"
    lokasi VARCHAR(150) NOT NULL,          -- "Gerbang Barat"
    ip_address VARCHAR(45) NOT NULL,
    rtsp_url VARCHAR(255) NOT NULL,        -- rtsp://admin:pass@192.168.1.101:554/live
    arah camera_direction NOT NULL DEFAULT 'IN',
    status camera_status NOT NULL DEFAULT 'ONLINE',
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABEL JADWAL PRESENSI (schedules)
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_sesi VARCHAR(100) NOT NULL,       -- Contoh: "Jam Masuk Pagi Reguler"
    hari_aktif VARCHAR(20)[] DEFAULT ARRAY['Senin','Selasa','Rabu','Kamis','Jumat'],
    jam_mulai TIME NOT NULL,               -- 06:30:00
    jam_selesai TIME NOT NULL,             -- 07:15:00 (Batas tepat waktu)
    toleransi_menit INT DEFAULT 15,        -- Toleransi keterlambatan
    kelas_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    guru_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABEL LOG TRANSAKSI PRESENSI (attendance_logs)
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    camera_id UUID REFERENCES camera_nodes(id) ON DELETE SET NULL,
    waktu TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status attendance_status NOT NULL,
    confidence FLOAT NOT NULL,             -- Cosine similarity score (e.g. 0.892)
    img_url VARCHAR(255),                  -- Snapshot crop foto saat terdeteksi
    track_id VARCHAR(50),                  -- ID pelacakan Deep SORT sementara
    override_by UUID REFERENCES users(id), -- Jika diubah manual oleh Guru/Admin
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pencarian histori presensi harian
CREATE INDEX IF NOT EXISTS idx_attendance_user_waktu ON attendance_logs(user_id, waktu);
CREATE INDEX IF NOT EXISTS idx_attendance_waktu ON attendance_logs(waktu);

-- 8. TABEL PERMOHONAN IZIN/SAKIT (leave_requests)
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kategori leave_category NOT NULL DEFAULT 'SAKIT',
    tgl_mulai DATE NOT NULL,
    tgl_selesai DATE NOT NULL,
    alasan TEXT NOT NULL,
    bukti_url VARCHAR(255),                -- Foto surat dokter / surat izin ortu
    status_izin leave_status NOT NULL DEFAULT 'PENDING',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABEL DEVICE TOKEN FCM (device_tokens)
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token VARCHAR(255) NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL,          -- 'android' atau 'ios'
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Kelas Contoh
INSERT INTO classes (id, nama_kelas, tingkat, jurusan) VALUES
('a0000000-0000-0000-0000-000000000001', 'X RPL 1', '10', 'Rekayasa Perangkat Lunak'),
('a0000000-0000-0000-0000-000000000002', 'XI RPL 1', '11', 'Rekayasa Perangkat Lunak')
ON CONFLICT (nama_kelas) DO NOTHING;

-- Akun Default (Password default: 'Admin123!' -> hash bcrypt)
-- Catatan: $2a$10$w09dKx0F/nK0Fv3XzF/67OfiQ.aE6F90E1x8HqQ.H5sN.KqTzZlKG (Admin123!)
INSERT INTO users (id, nomor_induk, nama, email, nomor_telepon, role, password_hash, status) VALUES
('b0000000-0000-0000-0000-000000000001', 'ADMIN-001', 'Administrator Sekolah', 'admin@sekolah.sch.id', '081234567890', 'ADMIN', '$2a$10$w09dKx0F/nK0Fv3XzF/67OfiQ.aE6F90E1x8HqQ.H5sN.KqTzZlKG', 'AKTIF'),
('b0000000-0000-0000-0000-000000000002', '198501012010011001', 'Budi Santoso, S.Kom', 'guru.budi@sekolah.sch.id', '081234567891', 'GURU', '$2a$10$w09dKx0F/nK0Fv3XzF/67OfiQ.aE6F90E1x8HqQ.H5sN.KqTzZlKG', 'AKTIF')
ON CONFLICT (nomor_induk) DO NOTHING;

-- Siswa Contoh
INSERT INTO users (id, nomor_induk, nama, email, nomor_telepon, role, password_hash, status, kelas_id) VALUES
('c0000000-0000-0000-0000-000000000001', '0061234561', 'Ahmad Rizky Pratama', 'rizky@siswa.sch.id', '085211223344', 'SISWA', '$2a$10$w09dKx0F/nK0Fv3XzF/67OfiQ.aE6F90E1x8HqQ.H5sN.KqTzZlKG', 'AKTIF', 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000002', '0061234562', 'Siti Nurhaliza', 'siti@siswa.sch.id', '085211223345', 'SISWA', '$2a$10$w09dKx0F/nK0Fv3XzF/67OfiQ.aE6F90E1x8HqQ.H5sN.KqTzZlKG', 'AKTIF', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (nomor_induk) DO NOTHING;

-- Node Kamera Contoh
INSERT INTO camera_nodes (id, nama_node, lokasi, ip_address, rtsp_url, arah, status) VALUES
('d0000000-0000-0000-0000-000000000001', 'Kamera Gerbang Masuk Utama', 'Gerbang Depan', '192.168.1.101', 'rtsp://localhost:8554/cam_masuk', 'IN', 'ONLINE'),
('d0000000-0000-0000-0000-000000000002', 'Kamera Gerbang Keluar', 'Gerbang Depan', '192.168.1.102', 'rtsp://localhost:8554/cam_keluar', 'OUT', 'ONLINE')
ON CONFLICT (id) DO NOTHING;

-- Jadwal Pagi Contoh
INSERT INTO schedules (id, nama_sesi, hari_aktif, jam_mulai, jam_selesai, toleransi_menit, kelas_id) VALUES
('e0000000-0000-0000-0000-000000000001', 'Presensi Masuk Pagi', ARRAY['Senin','Selasa','Rabu','Kamis','Jumat'], '06:30:00', '07:15:00', 15, 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

