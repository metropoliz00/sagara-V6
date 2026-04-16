-- SQL UNTUK FITUR SUMATIF (SAGARA)
-- Jalankan script ini di Supabase SQL Editor

-- 1. Tabel Utama Sumatif (Daftar Ujian/Asesmen)
CREATE TABLE IF NOT EXISTS sumatifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- sum1, sum2, sum3, sum4, sas
  duration NUMERIC DEFAULT 60,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT FALSE,
  questions JSONB DEFAULT '[]', -- Menyimpan array soal (PG, PGK, BS)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Hasil Sumatif (Jawaban & Nilai Siswa)
CREATE TABLE IF NOT EXISTS sumatif_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sumatif_id UUID REFERENCES sumatifs(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  score NUMERIC DEFAULT 0,
  answers JSONB DEFAULT '{}', -- Menyimpan jawaban siswa per question_id
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sumatif_id, student_id) -- Satu siswa hanya bisa mengirim satu hasil per sumatif
);

-- 3. Index untuk Performa
CREATE INDEX IF NOT EXISTS idx_sumatifs_class ON sumatifs(class_id);
CREATE INDEX IF NOT EXISTS idx_sumatif_results_sumatif ON sumatif_results(sumatif_id);
CREATE INDEX IF NOT EXISTS idx_sumatif_results_student ON sumatif_results(student_id);

-- 4. Keamanan (Row Level Security)
ALTER TABLE sumatifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sumatif_results ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Sumatifs (Semua user bisa baca jika aktif, admin/guru bisa kelola)
CREATE POLICY "Akses publik untuk sumatif" ON sumatifs
  FOR SELECT TO public USING (true);

CREATE POLICY "Guru/Admin kelola sumatif" ON sumatifs
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Kebijakan Akses Hasil Sumatif
CREATE POLICY "Siswa simpan hasil sendiri" ON sumatif_results
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Akses hasil sumatif" ON sumatif_results
  FOR SELECT TO public USING (true);

CREATE POLICY "Update hasil sumatif" ON sumatif_results
  FOR UPDATE TO public USING (true);

-- 5. Contoh Query Pengambilan Data (Retrieval)

-- Mengambil semua sumatif aktif untuk kelas tertentu
-- SELECT * FROM sumatifs WHERE class_id = '1A' AND is_active = true;

-- Mengambil hasil sumatif beserta data siswa (Join manual di aplikasi atau via view)
-- SELECT r.*, s.name FROM sumatif_results r JOIN students s ON r.student_id = s.id WHERE r.sumatif_id = 'uuid-sumatif';

-- 6. Contoh Query Penyimpanan Data (Storage)

-- Menyimpan sumatif baru
-- INSERT INTO sumatifs (class_id, subject_id, title, type, questions) VALUES ('1A', 'matematika', 'Ujian Bab 1', 'sum1', '[{"text": "1+1?", "type": "pg", "options": ["1","2","3"], "correctAnswer": "2"}]');

-- Menyimpan hasil pengerjaan siswa
-- INSERT INTO sumatif_results (sumatif_id, student_id, score, answers) VALUES ('uuid-sumatif', 'uuid-siswa', 100, '{"q1": "2"}') ON CONFLICT (sumatif_id, student_id) DO UPDATE SET score = EXCLUDED.score, answers = EXCLUDED.answers;
