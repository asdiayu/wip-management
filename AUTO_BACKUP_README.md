# Fitur Auto Backup Database

## 📋 Overview

Fitur auto backup yang mem-backup database secara otomatis setiap jam 7 pagi (WIB) ke Supabase Storage bucket.

### Format Backup
Sama dengan backup manual yang ada di halaman Database:
- **Format:** JSON
- **Isi:** `materials`, `locations`, `transactions`
- **Struktur:**
  ```json
  {
    "version": 3,
    "createdAt": "2024-01-31T00:00:00.000Z",
    "data": {
      "materials": [...],
      "locations": [...],
      "transactions": [...]
    }
  }
  ```

### Cara Kerja
1. Setiap jam 00:00 UTC (07:00 WIB), pg_cron trigger backup
2. pg_net memanggil Edge Function `daily-backup`
3. Edge Function:
   - Generate JSON backup dari database
   - Hapus backup hari sebelumnya
   - Upload backup baru ke bucket `database-backups`
   - Log aktivitas ke `audit_logs`

---

## 🚀 Cara Setup

### 1. Jalankan Migration SQL

Buka Supabase Dashboard → SQL Editor, lalu jalankan:

```sql
-- Copy paste isi file:
-- supabase/migrations/20240131_auto_backup_setup.sql
```

### 2. Dapatkan Project Ref & Service Role Key

Dari Supabase Dashboard:
- **Project Ref:** Settings → API → Project URL
  - Contoh: `https://abcd1234.supabase.co` → Project ref: `abcd1234`
- **Service Role Key:** Settings → API → service_role (secret)

### 3. Konfigurasi Function

Di Supabase SQL Editor, jalankan:

```sql
-- Set project ref (ganti dengan project ref Anda)
SELECT set_config('app.settings.project_ref', 'abcd1234', false);

-- Set service role key (ganti dengan service role key Anda)
SELECT set_config('app.settings.service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', false);
```

### 4. Deploy Edge Function

Install Supabase CLI (jika belum):
```bash
npm install -g supabase
```

Login ke Supabase:
```bash
supabase login
```

Link ke project:
```bash
supabase link --project-ref abcd1234
```

Deploy Edge Function:
```bash
cd /home/asdi/Unduhan/Crusher-management
supabase functions deploy daily-backup
```

### 5. Verifikasi Setup

**Cek cron job:**
```sql
SELECT * FROM cron.job;
```

Harus ada job dengan nama `daily-database-backup`.

**Cek bucket:**
```sql
SELECT * FROM storage.buckets WHERE id = 'database-backups';
```

**Test manual backup:**
```bash
curl -X POST https://abcd1234.supabase.co/functions/v1/daily-backup \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json"
```

---

## 🔧 Manajemen & Monitoring

### Cek Log Backup
```sql
SELECT * FROM audit_logs
WHERE action LIKE '%BACKUP%'
ORDER BY timestamp DESC
LIMIT 10;
```

### Cek File Backup di Storage
**Via Dashboard:**
- Storage → database-backups bucket

**Via SQL:**
```sql
SELECT * FROM storage.objects
WHERE bucket_id = 'database-backups'
ORDER BY created_at DESC;
```

### Download Backup
**Via Dashboard:**
1. Storage → database-backups
2. Klik file backup
3. Download

**Via Code:**
```typescript
const { data, error } = await supabase
  .storage
  .from('database-backups')
  .download('backup_2024-01-31.json');
```

### Restore dari Auto Backup
Gunakan fitur restore yang sudah ada di halaman Database Management:
1. Download file backup dari storage
2. Halaman Database → Restore
3. Upload file backup

---

## ⚙️ Konfigurasi Lanjutan

### Ubah Jadwal Backup

Default: Jam 00:00 UTC (07:00 WIB)

**Untuk mengubah jam:**
```sql
-- Hapus job lama
SELECT cron.unschedule('daily-database-backup');

-- Buat job baru dengan jadwal berbeda
-- Format cron: men jam hari month weekday
SELECT cron.schedule(
    'daily-database-backup',
    '0 7 * * *', -- Jam 07:00 UTC
    $$SELECT trigger_backup_via_http();$$
);
```

### Retensi Backup (Simpan Lebih dari 1 Hari)

Jika ingin menyimpan backup lebih dari 1 hari, edit Edge Function:

**File:** `supabase/functions/daily-backup/index.ts`

Comment atau hapus bagian delete old backup:
```typescript
// 2. Delete old backup (yesterday's file) if exists
// const { error: deleteError } = await supabase
//   .storage
//   .from('database-backups')
//   .remove([oldBackupFilename])
```

### Tambahan: Retensi Policy (Hapus Backup Lama)

Jika ingin auto-delete backup setelah N hari:

```sql
-- Di SQL Editor, buat function untuk cleanup
CREATE OR REPLACE FUNCTION cleanup_old_backups(retention_days INT DEFAULT 30)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'database-backups'
    AND created_at < NOW() - (retention_days || ' days')::interval;
END;
$$;

-- Schedule cleanup setiap minggu
SELECT cron.schedule(
    'weekly-backup-cleanup',
    '0 2 * * 0', -- Jam 02:00 setiap hari Minggu
    $$SELECT cleanup_old_backups(30);$$ -- Hapus backup lebih dari 30 hari
);
```

---

## 🐛 Troubleshooting

### Backup tidak berjalan

**1. Cek cron job:**
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 5;
```

**2. Cek pg_net extension:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

**3. Cek Edge Function:**
```bash
# Test manual
curl -X POST https://<project-ref>.supabase.co/functions/v1/daily-backup \
  -H "Authorization: Bearer <anon-key>"
```

### Error: "Project ref not set"

Jalankan:
```sql
SELECT set_config('app.settings.project_ref', 'abcd1234', false);
```

### Error: "Unauthorized"

Pastikan service role key benar:
```sql
SELECT set_config('app.settings.service_role_key', 'eyJ...', false);
```

### Backup tidak muncul di storage

1. Cek bucket exists:
```sql
SELECT * FROM storage.buckets WHERE id = 'database-backups';
```

2. Cek RLS policies (admin only):
```sql
SELECT * FROM pg_policies WHERE tablename = "objects";
```

---

## 📞 Support

Jika ada masalah:
1. Cek `audit_logs` untuk error details
2. Cek Edge Function logs di Supabase Dashboard
3. Test manual backup untuk isolasi masalah

---

## 📄 File Terkait

- **Migration:** `supabase/migrations/20240131_auto_backup_setup.sql`
- **Edge Function:** `supabase/functions/daily-backup/index.ts`
- **Hook Backup Manual:** `hooks/useDatabaseManagement.ts`
