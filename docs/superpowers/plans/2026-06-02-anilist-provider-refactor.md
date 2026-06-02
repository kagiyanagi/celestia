# AniList Provider Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply "Tiger Style" constraints (70-line limit) and defensive transformers to the AniList provider.

**Architecture:** Extract mapping logic to a separate transformer file (`src/lib/providers/transformers/anilist.ts`). Use defensive coding (null-coalescing, defaults) to ensure output matches hardened types. Refactor `src/lib/providers/anilist.ts` to use these transformers and keep functions lean.

**Tech Stack:** TypeScript, Next.js (App Router)

---

### Task 1: Create AniList Transformers

**Files:**
- Create: `src/lib/providers/transformers/anilist.ts`

- [ ] **Step 1: Define AniList Internal Types in Transformer**
Copy `AniListMedia` and `AniListDetailsMedia` types from `anilist.ts` to `transformers/anilist.ts`.

- [ ] **Step 2: Implement Defensive `transformAnimeSummary`**
Extract and harden `toAnimeSummary` logic.

- [ ] **Step 3: Implement Defensive `transformCharacterCredits`**
Extract and harden `toCharacterCredits` logic.

- [ ] **Step 4: Implement Defensive `transformStaffCredits`**
Extract and harden `toStaffCredits` logic.

- [ ] **Step 5: Implement Defensive `transformRelations`**
Extract and harden `toRelations` logic.

- [ ] **Step 6: Implement Defensive `transformAnimeDetails`**
Extract and harden `toAnimeDetails` logic.

- [ ] **Step 7: Verify Types**
Ensure all transformers return the correct types from `@/types/anime`.

### Task 2: Refactor AniList Provider

**Files:**
- Modify: `src/lib/providers/anilist.ts`

- [ ] **Step 1: Update Imports**
Import transformers from `@/lib/providers/transformers/anilist`. Remove types and functions that were moved.

- [ ] **Step 2: Refactor `getHomeCollections`**
Use `transformAnimeSummary` and ensure it's under 70 lines.

- [ ] **Step 3: Refactor `getAiringSchedule`**
Use `transformAnimeSummary` and ensure it's under 70 lines.

- [ ] **Step 4: Refactor `getBrowseCollection`**
Use `transformAnimeSummary` and ensure it's under 70 lines.

- [ ] **Step 5: Refactor `searchAnime`**
Use `transformAnimeSummary` and ensure it's under 70 lines.

- [ ] **Step 6: Refactor `getAnimeDetails`**
Use `transformAnimeDetails` and ensure it's under 70 lines.

- [ ] **Step 7: Verify with Typecheck**
Run: `npm run typecheck`

### Task 3: Final Verification and Commit

- [ ] **Step 1: Final Linting**
Run: `npm run lint`

- [ ] **Step 2: Commit Changes**
Commit both files with the specified message.
