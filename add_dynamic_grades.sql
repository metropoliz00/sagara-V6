-- Menambahkan kolom extra_data pada tabel grades untuk mendukung penambahan kolom nilai yang dinamis
ALTER TABLE grades ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;
