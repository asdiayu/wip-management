# Technology Stack

**Analysis Date:** 2026-03-21

## Languages

**Primary:**
- TypeScript ^5.8.2 - Core application logic, React components, and type definitions

**Secondary:**
- JavaScript - Vite build process and bundling

## Runtime

**Environment:**
- Node.js - Development and build environment
- Browser - Client-side execution (ES2022 target)

**Package Manager:**
- npm ^9.x - Dependency management
- Lockfile: package-lock.json present

## Frameworks

**Core:**
- React ^19.0.0 - UI component library
- React DOM ^19.0.0 - DOM rendering
- React Router DOM ^7.1.1 - Client-side routing

**Build/Development:**
- Vite ^7.2.4 - Build tool and development server
- @vitejs/plugin-react ^5.1.1 - React plugin for Vite

**Testing:**
- No testing framework detected

## Key Dependencies

**Critical:**
- @supabase/supabase-js ^2.45.1 - Database client and authentication
- @tanstack/react-query ^5.51.1 - Data fetching and caching

**UI/UX:**
- recharts ^3.3.0 - Data visualization charts
- react-markdown - Markdown rendering for AI responses

**Mobile/Progressive Web App:**
- @capacitor/core - Capacitor core for mobile app packaging
- @capacitor/android ^8.0.1 - Android platform support
- @capacitor/filesystem - File system access
- @capacitor/share - Native sharing capabilities
- capacitor-native-biometric - Biometric authentication

**Data Processing:**
- xlsx - Excel file processing
- html-to-image ^1.11.11 - HTML to image conversion
- html5-qrcode ^2.3.8 - QR code scanning

**Utilities:**
- dotenv ^17.2.3 - Environment variable management
- React HOCs and custom hooks

## Configuration

**Environment:**
- Environment variables via .env files
- Supabase URL and anon key required
- Optional Gemini API key for AI features

**Build:**
- vite.config.ts with custom bundling and cache headers
- tsconfig.json with ES2022 target and React JSX support
- Manual vendor chunking for optimized loading

## Platform Requirements

**Development:**
- Node.js for development server
- npm for package management
- TypeScript for compilation

**Production:**
- Vercel deployment configured with aggressive cache headers
- Android mobile app via Capacitor
- Progressive Web App capabilities

**Mobile:**
- Android APK generation via Gradle
- Capacitor configuration for native app packaging

---

*Stack analysis: 2026-03-21*
```