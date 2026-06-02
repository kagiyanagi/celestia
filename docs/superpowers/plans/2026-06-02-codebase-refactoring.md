# Codebase Refactoring (Safety-First Tiger Style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the codebase for scalability and reliability using "Tiger Style" constraints and defensive data transformers.

**Architecture:** Use a "Safety-First Hybrid" approach. API data is defensively transformed into domain types. Monolithic UI components are decomposed into small, focused sub-components (under 100 lines). Logic functions are strictly under 70 lines.

**Tech Stack:** Next.js (React 19), TypeScript, Lucide React.

---

### Task 1: Type Hardening & Error Boundaries

**Files:**
- Modify: `src/types/anime.ts`
- Create: `src/components/error-boundary.tsx`

- [ ] **Step 1: Ensure domain types have explicit optionality.**
Modify `src/types/anime.ts` to ensure that fields which might be missing from APIs are clearly marked as optional or nullable, preventing runtime "cannot read property of undefined" errors.

- [ ] **Step 2: Create a functional Error Boundary.**
Create `src/components/error-boundary.tsx` using a standard React Error Boundary pattern (class component or a library if available, but since we have no extra deps, use a simple class component wrapper).

```tsx
"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-500 bg-red-50 text-red-700 rounded">
          Something went wrong in this section.
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 3: Commit Infrastructure.**
```bash
git add src/types/anime.ts src/components/error-boundary.tsx
git commit -m "refactor: add error boundary and harden types"
```

---

### Task 2: AniList Provider - Defensive Transformers

**Files:**
- Modify: `src/lib/providers/anilist.ts`
- Create: `src/lib/providers/transformers/anilist.ts`

- [ ] **Step 1: Extract mapping logic to separate transformer file.**
Move functions like `toAnimeSummary`, `toCharacterCredits`, `toStaffCredits`, `toRelations`, and `toAnimeDetails` from `src/lib/providers/anilist.ts` to `src/lib/providers/transformers/anilist.ts`.

- [ ] **Step 2: Implement Defensive Transformation.**
In the new transformer file, ensure every field is checked. Use null-coalescing or default values to guarantee the output matches the `AnimeDetails` or `AnimeSummary` interfaces perfectly.

```typescript
// Example for src/lib/providers/transformers/anilist.ts
export function transformMedia(media: any): AnimeSummary {
  return {
    id: media.id ?? 0,
    title: {
      romaji: media.title?.romaji ?? null,
      english: media.title?.english ?? null,
      native: media.title?.native ?? null,
      userPreferred: media.title?.userPreferred ?? null,
    },
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    // ... all other fields with defaults
  };
}
```

- [ ] **Step 3: Refactor anilist.ts to use transformers and respect 70-line limit.**
Update `src/lib/providers/anilist.ts` to import the transformers. Ensure that the main fetch functions (like `getAnimeDetails`, `getHomeCollections`) are lean and focused on orchestration.

- [ ] **Step 4: Verify with typecheck.**
Run: `npm run typecheck`
Expected: Success.

- [ ] **Step 5: Commit Provider Refactor.**
```bash
git add src/lib/providers/anilist.ts src/lib/providers/transformers/anilist.ts
git commit -m "refactor: implement defensive transformers for AniList provider"
```

---

### Task 3: Decompose AnimeDetailsShell

**Files:**
- Create: `src/components/AnimeDetailsShell/index.tsx`
- Create: `src/components/AnimeDetailsShell/DetailsHero.tsx`
- Create: `src/components/AnimeDetailsShell/DetailsTabs.tsx`
- Create: `src/components/AnimeDetailsShell/DetailsOverview.tsx`
- Create: `src/components/AnimeDetailsShell/DetailsEpisodes.tsx`
- Create: `src/components/AnimeDetailsShell/DetailsCast.tsx`
- Create: `src/components/AnimeDetailsShell/helpers.ts`
- Delete/Modify: `src/components/anime-details-shell.tsx`

- [ ] **Step 1: Extract Hero section.**
Move the Hero JSX and its specific logic to `DetailsHero.tsx`. Ensure it takes only the necessary props.

- [ ] **Step 2: Extract Tabs and Content.**
Split the tabs navigation and each tab content (Overview, Episodes, Cast, Relations, Similar) into their own components. Use `ErrorBoundary` to wrap each tab content.

- [ ] **Step 3: Move helper logic to helpers.ts.**
Move `formatDate`, `getDisplayTitle`, and any complex filtering/sorting (like the episode range calculation) to `helpers.ts`.

- [ ] **Step 4: Re-orchestrate in index.tsx.**
Create the main `AnimeDetailsShell` component in `index.tsx` that manages the `activeTab` state and renders the sub-components.

- [ ] **Step 5: Update references.**
Update `src/app/anime/[id]/page.tsx` to import from the new directory.

- [ ] **Step 6: Verify styling.**
Compare the rendered page before and after. CSS classes must remain identical.

- [ ] **Step 7: Commit UI Decomposition.**
```bash
git add src/components/AnimeDetailsShell/
git commit -m "refactor: decompose AnimeDetailsShell monolith"
```

---

### Task 4: Final Cleanup & Validation

- [ ] **Step 1: Run Lint & Typecheck.**
Run: `npm run lint && npm run typecheck`
Expected: Success.

- [ ] **Step 2: Manual Smoke Test.**
Navigate through Home, Search, Airing, and multiple Anime Detail pages. Verify that pagination, sorting, and playback still work perfectly.

- [ ] **Step 3: Final Commit.**
```bash
git commit --allow-empty -m "refactor: complete safety-first tiger style refactoring"
```
