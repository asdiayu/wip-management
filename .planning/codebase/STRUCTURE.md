# Codebase Structure

**Analysis Date:** 2026-03-21

## Directory Layout

```
.
├── components/           # UI components
│   ├── layout/         # Layout components (sidebar, navbar)
│   └── ui/             # Reusable UI primitives
├── context/            # React context providers
├── hooks/              # Custom React hooks for business logic
├── pages/              # Page components for routing
├── services/           # API and data access layer
├── supabase/           # Database migrations and edge functions
├── utils/              # Utility functions and helpers
├── constants.tsx       # App constants and navigation config
├── App.tsx             # Main app configuration and routing
├── index.tsx           # Application entry point
└── package.json       # Dependencies and scripts
```

## Directory Purposes

**components/**
- Purpose: Reusable UI components and page layouts
- Contains: Layout components (sidebar, navbar), UI primitives (buttons, inputs, cards), page components
- Key files: `components/layout/MainLayout.tsx`, `components/ui/Card.tsx`
- Generated: No
- Committed: Yes

**context/**
- Purpose: Global state management contexts
- Contains: Auth, theme, and sidebar context providers
- Key files: `context/AuthContext.tsx`, `context/ThemeContext.tsx`, `context/SidebarContext.tsx`
- Generated: No
- Committed: Yes

**hooks/**
- Purpose: Custom React hooks for business logic
- Contains: Feature-specific hooks for data fetching and state management
- Key files: `hooks/useStockLogic.ts`, `hooks/useDashboardLogic.ts`, `hooks/useAuth.ts`
- Generated: No
- Committed: Yes

**pages/**
- Purpose: Page components for application routes
- Contains: Feature-specific page components
- Key files: `pages/Dashboard.tsx`, `pages/Stock.tsx`, `pages/InputMaterial.tsx`
- Generated: No
- Committed: Yes

**services/**
- Purpose: Data access and API communication
- Contains: Supabase client and data access functions
- Key files: `services/supabase.ts`, `services/auditLogger.ts`
- Generated: No
- Committed: Yes

**supabase/**
- Purpose: Database configuration and backend functions
- Contains: Database migrations, edge functions
- Key files: `supabase/migrations/`, `supabase/functions/daily-backup/`
- Generated: No
- Committed: Yes

**utils/**
- Purpose: Utility functions and helpers
- Contains: Common utility functions
- Key files: (not visible in current structure)
- Generated: No
- Committed: Yes

## Key File Locations

**Entry Points:**
- `index.tsx`: Application entry point with React 19 root mounting
- `App.tsx`: Main router configuration with protected routes and lazy loading

**Configuration:**
- `constants.tsx`: Navigation links, icons, and app constants
- `package.json`: Dependencies including React 19, Supabase, TanStack Query

**Core Logic:**
- `context/AuthContext.tsx`: Authentication state management
- `hooks/useStockLogic.ts`: Stock management business logic
- `services/supabase.ts`: Supabase client configuration

**UI Components:**
- `components/layout/MainLayout.tsx`: Main application layout
- `components/layout/Sidebar.tsx`: Navigation sidebar with role-based access
- `components/ui/`: Reusable UI components

## Naming Conventions

**Files:**
- PascalCase for components: `Dashboard.tsx`, `Card.tsx`
- camelCase for hooks: `useStockLogic.ts`
- camelCase for utilities: `fileHelper.ts`

**Directories:**
- kebab-case: `components/ui/`, `context/`
- Plural for collections: `hooks/`, `pages/`

**Functions:**
- camelCase for React components and functions
- PascalCase for React component classes

**Variables:**
- camelCase for JavaScript/TypeScript variables
- UPPER_CASE for constants

## Where to Add New Code

**New Feature:**
- Primary code: `pages/[FeatureName].tsx`
- Business logic: `hooks/use[Feature]Logic.ts`
- UI components: `components/ui/[ComponentName].tsx`
- Layout updates: `components/layout/`

**New Component/Module:**
- Implementation: `components/ui/` for reusable components
- Feature-specific: `pages/[Feature]/Component.tsx`

**Utilities:**
- Shared helpers: `utils/[helperName].ts`
- Type definitions: Add to existing `.tsx` files or create `types/` directory

## Special Directories

**supabase/**
- Purpose: Database migrations and edge functions
- Generated: No
- Committed: Yes
- Contains: PostgreSQL migrations and serverless functions

**components/layout/**
- Purpose: Layout components and navigation
- Generated: No
- Committed: Yes
- Contains: Sidebar, navbar, and main layout components

**context/**
- Purpose: Global state providers
- Generated: No
- Committed: Yes
- Contains: Auth, theme, and sidebar contexts

---

*Structure analysis: 2026-03-21*
```