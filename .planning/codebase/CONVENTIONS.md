# Coding Conventions

**Analysis Date:** 2026-03-21

## Naming Patterns

**Files:**
- Component files: PascalCase (e.g., `Card.tsx`, `Button.tsx`)
- Page files: PascalCase for components, PascalCase.tsx for pages (e.g., `Dashboard.tsx`, `Login.tsx`)
- Hook files: camelCase starting with `use` (e.g., `useDashboardLogic.ts`)
- Service files: camelCase (e.g., `supabase.ts`, `auditLogger.ts`)
- Utility files: camelCase (e.g., `formatHelper.ts`)
- Context files: PascalCase (e.g., `AuthContext.tsx`)
- Type files: `types.ts`

**Functions:**
- React components: PascalCase (e.g., `Card`, `Button`)
- Hook functions: camelCase starting with `use` (e.g., `useAuth`, `useDashboardLogic`)
- Regular functions: camelCase (e.g., `formatNumber`, `logActivity`)
- Event handlers: camelCase prefixed with `handle` (e.g., `handleSignIn`)
- Private functions: camelCase prefixed with underscore `_`

**Variables:**
- React state variables: camelCase (e.g., `loading`, `error`, `username`)
- Constants: UPPER_SNAKE_CASE (e.g., `APP_VERSION`)
- Props: camelCase (e.g., `title`, `value`, `className`)
- JSX element variables: camelCase (e.g., `pageLoader`, `customTooltip`)

**Types:**
- Interface names: PascalCase with optional suffix (e.g., `User`, `CardProps`, `AuthContextType`)
- Enum names: PascalCase (e.g., `TransactionType`)
- Generic parameters: single uppercase letters (e.g., `T`, `K`, `V`)

## Code Style

**Formatting:**
- No specific formatter detected in project files
- Line length appears to follow TypeScript defaults (120 characters)

**Linting:**
- No ESLint configuration found in project root
- TypeScript compiler used via `tsconfig.json`
- Console usage detected in codebase

**TypeScript:**
- Strict mode enabled
- Target: ES2022
- JSX: "react-jsx"
- Path aliases: `@/*` maps to `./`
- Experimental decorators enabled

## Import Organization

**Order:**
1. React and core React libraries
2. Third-party libraries (react-router-dom, recharts, etc.)
3. Local imports from `@/` aliases
4. Relative imports

**Import patterns:**
```typescript
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { User } from '@/types';
```

**Path Aliases:**
- `@/*` maps to `./` (root directory)
- Used throughout the codebase

## Error Handling

**Patterns:**
```typescript
// Silent error handling in audit logging
} catch (error) {
  console.error("Failed to log activity:", error);
  // Fail silently so we don't block the main user action
}

// API call error handling
const { data, error } = await supabase.auth.signInWithPassword({
  email: username,
  password
});
if (!error && data.user) {
  setUser(data.user as User);
}
```

## Logging

**Framework:** `console` (browser console)

**Patterns:**
- Error logging only (no development logging detected)
- Used sparingly, mainly in catch blocks
- Audit logging with silent failure mode

**Examples:**
```typescript
console.error("Failed to log activity:", error);
```

## Comments

**When to Comment:**
- Performance optimizations with cache settings
- Complex data transformations in charts
- Security features like rate limiting
- Component structure with JSX cloneElement fixes

**JSDoc/TSDoc:**
- Not consistently used throughout codebase
- Some function comments for complex logic
- Rare in utility functions

**Examples:**
```typescript
/**
 * Memformat angka ke format Indonesia (id-ID)
 * Jika angka bulat (misal 120), akan tampil "120"
 * Jika angka desimal (misal 120.5), akan tampil "120,5"
 * Maksimal desimal tetap 2 angka.
 */
export const formatNumber = (value: number | string): string => {
```

## Function Design

**Size:**
- Components: Generally small to medium (50-300 lines)
- Hooks: Medium complexity (100-200 lines)
- Utility functions: Small and focused (< 50 lines)

**Parameters:**
- Limited number of parameters (typically 3-5)
- Destructured props for components
- Optional parameters with defaults

**Return Values:**
- Components: React elements
- Hooks: Objects with data and functions
- Utility functions: Primitive values or arrays
- Async functions: Promises

## Module Design

**Exports:**
- Default exports for React components
- Named exports for utilities and hooks
- Re-exports for convenience (e.g., `export { useAuth }`)

**Barrel Files:**
- No barrel files detected
- Direct imports from specific files

**Structure:**
- Clear separation between components, hooks, services, and utilities
- Centralized constants in `constants.tsx`
- Type definitions in `types.ts`

---

*Convention analysis: 2026-03-21*