# 📦 File-file Auto Backup

Berikut adalah file yang telah dibuat untuk fitur auto backup:

## 1. Migration SQL
**File:** `supabase/migrations/20240131_auto_backup_setup.sql`

**Isi:**
- Setup bucket `database-backups`
- Enable extensions: `pg_cron`, `pg_net`
- Buat SQL functions untuk backup
- Setup cron schedule: **00:00 UTC = 07:00 WIB**
- RLS policies untuk keamanan

**Cara pakai:**
Jalankan di Supabase SQL Editor

---

## 2. Edge Function
**File:** `supabase/functions/daily-backup/index.ts`

**Function:**
- Generate JSON backup (materials, locations, transactions)
- Delete backup hari sebelumnya
- Upload backup baru ke storage
- Log aktivitas ke audit_logs

**Cara deploy:**
```bash
supabase functions deploy daily-backup
```

---

## 3. Deploy Script
**File:** `deploy-backup.sh`

**Function:**
- Automate setup dan deploy
- Link ke Supabase project
- Deploy Edge Function
- Generate config script

**Cara pakai:**
```bash
./deploy-backup.sh
```

---

## 4. Test Script
**File:** `test-backup.sh`

**Function:**
- Test manual backup
- Cek response dari Edge Function

**Cara pakai:**
```bash
./test-backup.sh
```

---

## 5. Dokumentasi
**File:** `AUTO_BACKUP_README.md`

**Isi:**
- Panduan lengkap setup
- Troubleshooting
- Monitoring
- Konfigurasi lanjutan

---

## ✅ Checklist Setup

1. ✅ Jalankan migration SQL di Supabase SQL Editor
2. ✅ Deploy Edge Function: `./deploy-backup.sh` atau manual
3. ✅ Set config (project_ref & service_role_key)
4. ✅ Verifikasi: `SELECT * FROM cron.job;`
5. ✅ Test manual: `./test-backup.sh`

---

## 🕐 Jadwal Backup

**Schedule:** `0 0 * * *` (Cron format)
- **UTC:** 00:00 (tengah malam)
- **WIB:** 07:00 (jam 7 pagi) ✅

**Format filename:** `backup_YYYY-MM-DD.json`

**Location:** Storage → `database-backups` bucket

**Retention:** 1 hari (backup lama otomatis dihapus)
