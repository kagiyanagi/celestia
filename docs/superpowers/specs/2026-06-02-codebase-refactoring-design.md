# Design Spec: Celestia Codebase Refactoring (Safety-First Tiger Style)

## 1. Overview
The goal is to refactor the Celestia codebase to improve scalability, readability, and reliability. We will adopt a "Safety-First Hybrid" approach that applies "Tiger Style" coding principles to logic-heavy areas while maintaining standard React conventions for UI code.

## 2. Core Principles
- **Defensive Transformers:** API data must be validated and transformed into app-owned types immediately upon retrieval.
- **Strict Logic Bounds:** Provider and utility functions are limited to **70 lines**.
- **Modular UI:** Large components (monoliths) will be decomposed into small, focused sub-components (70-100 lines max for UI).
- **Explicit Type Safety:** No use of `any`. Explicit interfaces for all data boundaries.
- **Fail-Safe UI:** Implement Error Boundaries to ensure localized failures don't crash the application.

## 3. Architecture & Data Flow
### 3.1. Provider Pattern
Providers (`src/lib/providers`) are responsible for:
1. Fetching raw data from external APIs.
2. Mapping raw data to domain types using **Transformer Functions**.
3. Providing a clean, reliable interface to the rest of the application.

### 3.2. Domain Types
All core entities (Anime, Character, Staff, etc.) will have stable definitions in `src/types`. The UI will only consume these types, never the raw API response shapes.

## 4. Implementation Strategy

### 4.1. Tiger Style Logic
- Use `snake_case` for internal logic helper functions where appropriate (optional but preferred for "hot" logic).
- Functions must do one thing. If a function exceeds 70 lines, it must be split.
- Use descriptive naming with units for numbers (e.g., `duration_ms`, `timestamp_s`).

### 4.2. Component Decomposition
The primary target for decomposition is `src/components/anime-details-shell.tsx`. It will be moved to a directory structure:
```
src/components/AnimeDetailsShell/
├── index.tsx (Main orchestrator)
├── DetailsHero.tsx
├── DetailsTabs.tsx
├── DetailsOverview.tsx
├── DetailsEpisodes.tsx
├── DetailsCast.tsx
└── helpers.ts (Logic/Formatters)
```

### 4.3. Styling & Functionality Preservation
- **Visual Integrity:** No changes to CSS or global styles. JSX structure will be preserved during decomposition.
- **Functionality:** Existing features (search, filtering, playback, tracking) must remain fully functional.

## 5. Verification Plan
- **Linting:** Run `npm run lint` to ensure no styling or type regressions.
- **Type Checking:** Run `npm run typecheck` to verify data flow integrity.
- **Manual Smoke Test:** Verify the home page, detail page, and watch page function as expected.
- **Regression Testing:** Ensure that the AniList and Streaming providers correctly handle edge cases (e.g., missing thumbnails or descriptions).
