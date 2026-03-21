# Codebase Concerns

**Analysis Date:** 2026-03-21

## Tech Debt

**Legacy 'latest' Dependencies:**
- Issue: Using 'latest' tag for multiple packages in package.json
- Files: `package.json` (lines 17-23)
- Impact: Unpredictable version updates, potential breaking changes, lack of reproducible builds
- Fix approach: Pin to specific versions for core dependencies, use lockfile consistency checks

**Any Types in TypeScript:**
- Issue: Extensive use of 'any' type throughout the codebase
- Files: `context/AuthContext.tsx`, `hooks/useDashboardLogic.ts`, `hooks/useDatabaseManagement.ts`, etc.
- Impact: Loss of type safety, compile-time checks, IDE assistance
- Fix approach: Replace 'any' with specific interfaces, create proper type definitions for API responses

**Inconsistent Error Handling:**
- Issue: Mixed error handling patterns across components
- Files: Multiple files with console.error but inconsistent user feedback
- Impact: Poor user experience, debugging difficulties, inconsistent error states
- Fix approach: Implement centralized error boundary, standardize error messages and user feedback

## Known Bugs

**Race Condition in AuthContext:**
- Issue: Auth state updates may cause race conditions between session check and auth listener
- Files: `context/AuthContext.tsx` (lines 21-32)
- Symptoms: Flickering auth states, multiple session registrations
- Trigger: Rapid auth state changes during login/logout
- Workaround: Add state guards and cleanup checks

**Memory Leaks in Dashboard Logic:**
- Issue: Multiple useEffect hooks without proper cleanup
- Files: `hooks/useDashboardLogic.ts`
- Symptoms: Dashboard components accumulating memory over time
- Trigger: Widget state persistence and frequent data fetching
- Workaround: Implement proper cleanup intervals and data refactoring

## Security Considerations

**localStorage Security:**
- Risk: Sensitive data (login credentials, session info) potentially stored in localStorage
- Files: `pages/Login.tsx`, `pages/UserManagement.tsx`, multiple hook files
- Current mitigation: Basic validation and encryption
- Recommendations: Move to session-based storage, implement proper token refresh mechanism

**Password Handling:**
- Risk: Passwords transmitted and stored without strong validation
- Files: `context/AuthContext.tsx`, `pages/UserManagement.tsx`
- Current mitigation: Basic length checks, Supabase server-side hashing
- Recommendations: Implement password complexity requirements, secure transmission validation

**Rate Limiting Implementation:**
- Risk: Basic client-side rate limiting easily bypassed
- Files: `pages/Login.tsx` (lines 39-41)
- Current mitigation: Simple localStorage-based attempt tracking
- Recommendations: Implement server-side rate limiting, proper session management

## Performance Bottlenecks

**Dashboard Data Fetching:**
- Problem: Multiple API calls without proper optimization
- Files: `hooks/useDashboardLogic.ts` (lines 76-100)
- Cause: Lack of data fetching optimization, excessive useEffect dependencies
- Improvement path: Implement caching, pagination, and selective data loading

**Large Component Files:**
- Problem: Large component files with complex logic
- Files: `pages/UserManagement.tsx` (493 lines), `pages/Login.tsx` (495 lines)
- Cause: Monolithic components mixing business logic and UI
- Improvement path: Split into smaller focused components, extract business logic to hooks

## Fragile Areas

**Supabase Integration:**
- Files: `services/supabase.ts`, `context/AuthContext.tsx`
- Why fragile: Direct dependency on external API changes, environment configuration
- Safe modification: Add abstraction layer, implement fallbacks
- Test coverage: Integration tests needed for auth failures

**Cross-Platform Capacitor:**
- Files: `pages/Login.tsx`, `hooks/*` (multiple files with platform checks)
- Why fragile: Platform-specific code scattered throughout components
- Safe modification: Create abstraction layer for platform features
- Test coverage: Limited testing for native platform features

## Scaling Limits

**Data Loading Performance:**
- Current capacity: Limited to small datasets for dashboard and reporting
- Limit: No pagination, infinite scrolling, or data optimization
- Scaling path: Implement server-side pagination, data streaming, caching layers

**Session Management:**
- Current capacity: Single-session, no concurrent user support
- Limit: Basic session handling without token rotation
- Scaling path: Implement proper session management, token refresh, user switching

## Dependencies at Risk

**Capacitor Native Dependencies:**
- Risk: Using 'latest' versions for native integrations
- Impact: Breaking changes in native modules, platform incompatibilities
- Migration plan: Pin to stable versions, implement compatibility checks

**Supabase SDK:**
- Risk: Major version changes may break authentication patterns
- Impact: Auth system failures, API changes
- Migration plan: Implement adapter pattern, maintain backward compatibility

## Missing Critical Features

**Input Validation:**
- Problem: Limited client-side validation for forms
- Blocks: Poor data quality, potential API errors
- Priority: High

**Error Boundaries:**
- Problem: No error boundaries to catch component errors
- Blocks: Application stability, user experience
- Priority: High

**Accessibility:**
- Problem: Limited accessibility features
- Blocks: Compliance, user accessibility
- Priority: Medium

## Test Coverage Gaps

**API Integration Testing:**
- What's not tested: Supabase API calls, error handling scenarios
- Files: `services/supabase.ts`, `context/AuthContext.tsx`
- Risk: API failures not caught, network issues not handled
- Priority: High

**Component Testing:**
- What's not tested: Component state changes, user interactions
- Files: All React components
- Risk: UI bugs, state management issues
- Priority: Medium

---

*Concerns audit: 2026-03-21*