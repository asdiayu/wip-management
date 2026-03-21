# Architecture

**Analysis Date:** 2026-03-21

## Pattern Overview

**Overall:** Feature-based SPA with Context API and Query-based State Management

**Key Characteristics:**
- React 19 with TypeScript for type safety
- Supabase as backend with PostgreSQL database
- TanStack React Query for server state management and caching
- Context API for global state (auth, theme, sidebar)
- Component-based UI with shadcn/ui design system
- Capacitor for cross-platform mobile deployment
- Role-based access control

## Layers

**Presentation Layer:**
- Purpose: UI components and user interface
- Location: `components/`
- Contains: Layout components, UI primitives, page components
- Depends on: Context layer, Custom hooks
- Used by: React router routes

**Application Logic Layer:**
- Purpose: Business logic and state management
- Location: `hooks/`, `context/`
- Contains: Custom hooks, context providers
- Depends on: Data layer, TypeScript types
- Used by: Presentation layer

**Data Layer:**
- Purpose: Data access and API communication
- Location: `services/`
- Contains: Supabase client, data access functions
- Depends on: External services (Supabase)
- Used by: Application logic layer

**External Services:**
- Purpose: Backend and external integrations
- Location: `supabase/`
- Contains: Database migrations, edge functions
- Used by: Data layer

## Data Flow

**User Authentication Flow:**

1. User submits login credentials
2. AuthContext calls supabase.auth.signInWithPassword
3. Supabase validates against PostgreSQL database
4. User data stored in React Query cache
5. ProtectedRoute components check user role and permissions
6. Role-based navigation filtering via NAV_LINKS

**Data Sync Flow:**

1. User navigates to stock page
2. useStockLogic hook triggers initial data fetch
3. React Query fetches materials and locations from Supabase
4. Real-time listeners activated via postgres_changes
5. Data updates trigger automatic UI refresh
6. Server-side aggregation via Supabase RPC functions

**State Management:**
- Global state via Context API (auth, theme, sidebar)
- Server state via TanStack React Query
- Component state via useState hooks
- Persistent state via localStorage

## Key Abstractions

**Custom Hooks Pattern:**
- Purpose: Encapsulate business logic and data fetching
- Examples: `useStockLogic`, `useDashboardLogic`, `useAuth`
- Pattern: Each hook returns consistent interface with loading states, error handling, and data

**Context Providers:**
- Purpose: Global state management
- Examples: `AuthProvider`, `ThemeProvider`, `SidebarProvider`
- Pattern: Single context per concern with custom hook for consumption

**Layout Components:**
- Purpose: Consistent page structure
- Examples: `MainLayout`, `Sidebar`, `Navbar`
- Pattern: Composition pattern with responsive design

## Entry Points

**Main Application:**
- Location: `index.tsx`
- Triggers: DOM mount via ReactDOM.createRoot
- Responsibilities: Initialize root providers and router

**Route Configuration:**
- Location: `App.tsx`
- Triggers: React Router navigation
- Responsibilities: Protected routing, lazy loading, role-based access

**Page Components:**
- Location: `pages/`
- Triggers: User navigation
- Responsibilities: Feature-specific UI and interactions

## Error Handling

**Strategy:** Graceful degradation with user feedback

**Patterns:**
- React Query error boundaries
- Loading states during async operations
- Toast notifications for user actions
- Fallback UI for error states

## Cross-Cutting Concerns

**Logging:** Console logging for debugging, audit logging via Supabase
**Validation:** Client-side validation before API calls, server-side validation via PostgreSQL constraints
**Authentication:** Role-based access control, JWT tokens via Supabase
**Caching:** React Query caching with staleTime and gcTime configuration
**Internationalization:** Indonesian interface text with English technical terms

---

*Architecture analysis: 2026-03-21*
```