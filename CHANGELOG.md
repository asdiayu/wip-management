# Changelog

All notable changes to this project will be documented in this file.

## [1.1.6] - 2025-02-05

### Fixed 🐛
- **Timezone Issue**: Fixed timestamp inconsistency by migrating from `TIMESTAMPTZ` to `TIMESTAMP WITHOUT TIME ZONE`
  - All timestamps now stored in WIB (Indonesia timezone) without UTC conversion
  - Input time (e.g., 00:30) now matches display time exactly - no more timezone conversion confusion
  - Database, input, and display all use consistent WIB format

- **Shift Logic Bug**: Fixed report filtering to respect operational date based on shift schedules
  - Report date filter now correctly uses 07:00 - 06:59 next day range (matching shift change time)
  - Transactions from 00:00-06:59 on date 2 (Shift 2) now correctly appear in report for date 1
  - Previously, these transactions would incorrectly appear in report for date 2

### Changed 🔧
- **Database Schema**:
  - `transactions.timestamp`: Changed to `TIMESTAMP WITHOUT TIME ZONE`
  - `audit_logs.timestamp`: Changed to `TIMESTAMP WITHOUT TIME ZONE`

- **RPC Functions Updated**:
  - `get_report_summary` - Parameters now use `TIMESTAMP WITHOUT TIME ZONE`
  - `get_dashboard_kpi` - Parameters now use `TIMESTAMP WITHOUT TIME ZONE`
  - `get_daily_trend_stats` - Parameters now use `TIMESTAMP WITHOUT TIME ZONE`
  - `get_top_movers_stats` - Parameters now use `TIMESTAMP WITHOUT TIME ZONE`
  - `get_abc_analysis_stats` - Parameters now use `TIMESTAMP WITHOUT TIME ZONE`
  - `get_material_analytics_stats` - Return type now uses `TIMESTAMP WITHOUT TIME ZONE`

- **Helper Functions**:
  - Added `toPostgresTimestamp()` - Converts JavaScript Date to PostgreSQL timestamp format
  - Updated `createOperationalTimestamp()` - Returns WIB format instead of UTC

- **Hooks Updated**:
  - All transaction hooks now use consistent WIB timestamp format
  - Report filters now correctly implement operational date logic

### Database Migration 📊
- Migration script: `20250205_change_timestamp_to_without_timezone.sql`
  - Converts existing UTC timestamps to WIB (+7 hours)
  - Updates both `transactions` and `audit_logs` tables

### Technical Details ⚙️
- **Previous Behavior**: Input 00:30 WIB → Stored as UTC → Displayed differently
- **New Behavior**: Input 00:30 WIB → Stored as 00:30 WIB → Displayed as 00:30 ✅
- **No more timezone conversions** - what you input is what you get!

---

## [1.1.5] - Previous Release
- Stock opname features
- Audit log improvements
- Dashboard enhancements
