# External Integrations

**Analysis Date:** 2026-03-21

## APIs & External Services

**Supabase:**
- Supabase Platform - Backend-as-a-Service
  - SDK: @supabase/supabase-js ^2.45.1
  - Auth: Email/password authentication via Supabase Auth
  - Database: PostgreSQL with Row Level Security
  - Storage: File storage for documents and images
  - Functions: Edge Functions for AI and backup operations

**Google AI:**
- Gemini AI - Generative AI for smart assistant features
  - Integration: Supabase Edge Functions proxy
  - Auth: GEMINI_API_KEY environment variable
  - Purpose: Material analysis, recommendations, and chat assistance

**Native Mobile APIs:**
- Capacitor Plugins - Native mobile functionality
  - File System: @capacitor/filesystem
  - Share: @capacitor/share
  - Biometric: capacitor-native-biometric

## Data Storage

**Databases:**
- PostgreSQL - Primary database via Supabase
  - Connection: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
  - Client: @supabase/supabase-js with TypeScript types
  - Schema: Custom database migrations in supabase/migrations/

**File Storage:**
- Supabase Storage - Document and image storage
  - Buckets: Configured for material photos and documents
  - Client: Supabase storage API

**Caching:**
- React Query Client - Client-side data caching
  - Cache time: 30 minutes gcTime, 10 seconds staleTime
  - Retry: 1 retry on failed requests

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Custom authentication system
  - Implementation: Email/password authentication
  - Roles: admin, operator, manager, viewer
  - Session management: Automatic session refresh and state listening

**Authorization:**
- Role-based access control (RBAC)
  - Implementation: ProtectedRoute components with role checking
  - Storage: User metadata in Supabase auth records

## Monitoring & Observability

**Error Tracking:**
- Not implemented - No dedicated error tracking service detected

**Logs:**
- Custom audit logging via database
  - Implementation: AuditLog table and auditLogger service
  - Purpose: User action tracking and compliance

## CI/CD & Deployment

**Hosting:**
- Vercel - Frontend hosting
  - Configuration: vercel.json with aggressive cache headers
  - Features: Clean URLs, trailing slash handling

**CI Pipeline:**
- Not explicitly configured - Likely manual deployment

## Environment Configuration

**Required env vars:**
- VITE_SUPABASE_URL - Supabase project URL
- VITE_SUPABASE_ANON_KEY - Supabase anonymous key
- GEMINI_API_KEY - Google Gemini API key (optional)

**Secrets location:**
- .env.local - Local environment configuration
- .env.example - Template for environment variables

## Webhooks & Callbacks

**Incoming:**
- Supabase Auth callbacks - Authentication state changes
- Supabase database triggers - Real-time data updates

**Outgoing:**
- Supabase Edge Functions - Gemini AI and backup operations
  - Functions: gemini (AI assistant), daily-backup, upload-apk

---

*Integration audit: 2026-03-21*
```