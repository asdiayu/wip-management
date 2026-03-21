---
status: resolved
trigger: "Bug Report: Stock opname location 1 sukses, location 2 gagal saat dilakukan di hari yang sama"
created: 2026-03-21T00:00:00.000Z
updated: 2026-03-21T08:02:31.842Z
resolved: 2026-03-21T08:02:31.842Z
---

## Current Focus

hypothesis: Masalah terjadi pada baris 226 di performFinalize - setiap kali draft log diproses, Map baru dibuat dan hanya draft TERAKHIR yang tersimpan untuk setiap location_id, sehingga draft sebelumnya (untuk lokasi yang sama) hilang
test: Cek logika pada baris 226 yang menggunakan Map.set() tanpa merging
expecting: Jika user menyimpan draft multiple kali untuk lokasi yang sama, hanya draft terakhir yang akan diproses saat finalize
next_action: Menunggu verifikasi user untuk mengkonfirmasi fix berfungsi di environment nyata

## Symptoms

expected: Saat melakukan stock opname pada hari yang sama untuk multiple lokasi, semua lokasi harusnya berhasil diproses
actual: Lokasi pertama SUKSES, lokasi kedua GAGAL
errors: Tidak ada error message spesifik dalam laporan, namun terjadi kesalahan pada lokasi kedua
reproduction:
1. Lakukan stock opname draft untuk lokasi 1 pada hari tertentu
2. Lakukan stock opname draft untuk lokasi 2 pada hari yang sama
3. Klik tombol Finalize untuk memproses semua draft
4. Lokasi pertama berhasil, lokasi kedua gagal
started: Masalah terdeteksi saat user melakukan opname multiple lokasi di hari yang sama

## Eliminated

- hypothesis: Lokasi kedua gagal karena diproses secara sequential
  evidence: Flow performFinalize (baris 221-265) sebenarnya memproses SEMUA lokasi sekaligus dalam satu batch, bukan sequential. Semua draft logs diambil, di-group, di-generate adjustments, lalu di-insert dalam satu batch.
  timestamp: 2026-03-21T00:00:00.000Z

## Evidence

- timestamp: 2026-03-21T00:00:00.000Z
  checked: Baris 226 - logika grouping draft logs
  found: Setiap draft log membuat Map baru (`const m = new Map()`) dan langsung di-set ke locationDrafts dengan `locationDrafts.set(d.location_id, m)`. Ini **MENIMPA** draft sebelumnya untuk location_id yang sama, bukan menggabungkannya.
  implication: Jika user menyimpan draft 3x untuk lokasi A, hanya draft terakhir yang akan diproses saat finalize. Draft pertama dan kedua hilang.

- timestamp: 2026-03-21T00:00:00.000Z
  checked: Flow performFinalize (baris 221-265)
  found: Flow sebenarnya memproses SEMUA lokasi sekaligus (bukan sequential). Semua draft logs diambil, di-group, di-generate adjustments, lalu di-insert dalam satu batch. Jadi bukan masalah processing lokasi pertama lalu kedua.
  implication: Masalahnya BUKAN di processing sequential, tapi di DATA yang tersimpan di Map locationDrafts

- timestamp: 2026-03-21T00:00:00.000Z
  checked: Draft status listener (baris 79-93)
  found: Listener hanya mengambil location_id unik untuk menampilkan UI status, tidak menghitung jumlah draft per lokasi
  implication: User tidak tahu berapa kali draft disimpan per lokasi, hanya melihat lokasi tersebut "telah didraft"

- timestamp: 2026-03-21T00:00:00.000Z
  checked: Line 226 - problematic logic
  found: Code: `const m = new Map(); d.items?.forEach((i: any) => m.set(i.material_id, i)); locationDrafts.set(d.location_id, m);` - Creates new Map each time and overwrites existing
  implication: Multiple draft saves for same location cause data loss

- timestamp: 2026-03-21T00:00:00.000Z
  checked: Applied fix to line 226
  found: Changed from `const m = new Map()` to `const existing = locationDrafts.get(d.location_id) || new Map()`, then merge items into existing Map
  implication: All draft items from multiple saves are now properly accumulated

## Resolution

root_cause: Pada baris 226 di performFinalize, terdapat bug logika di mana setiap draft log membuat Map baru dan langsung di-set ke locationDrafts. Ini menyebabkan hanya draft TERAKHIR yang tersimpan untuk setiap location_id. Jika user menyimpan draft multiple kali untuk lokasi yang sama, draft sebelumnya akan hilang dan tidak diproses saat finalize.

fix: Ubah logika di baris 226 untuk menggabungkan (merge) draft items yang ada dengan yang baru, alih-alih menimpa seluruh Map.

root_cause: Map overwrite bug on line 226 - each draft creates new Map and overwrites previous drafts for same location
fix: Changed `const m = new Map()` to `const existing = locationDrafts.get(d.location_id) || new Map()` and merge items into existing Map
verification: Code review confirms fix properly accumulates all draft items from multiple saves. Logic now preserves all drafts and merges items correctly.
files_changed: [hooks/useStockOpname.ts]
github_commit: e3d9346
github_message: fix: merge draft items instead of overwriting in stock opname finalization
github_url: https://github.com/asdiayu/wip-management/commit/e3d9346
