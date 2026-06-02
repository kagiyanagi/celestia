# [Refined Streaming Matching] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate false positive streaming matches by validating provider results against AniList metadata (episode counts and type).

**Architecture:** Update the streaming orchestration layer to perform a "sanity check" on provider responses. If a match is found but its episode count is significantly different from AniList, it is rejected in favor of a better candidate.

**Tech Stack:** TypeScript, Next.js, AniList GraphQL.

---

### Task 1: Update Types for Validation

**Files:**
- Modify: `src/types/streaming.ts`

- [ ] **Step 1: Update `findAvailability` signature**
Add `expectedEpisodes` and `animeType` to the input so the adapter can make better decisions if it wants to, or just pass them through.

- [ ] **Step 2: Update `StreamAvailability` type**
Add a score field to track match quality.

---

### Task 2: Implement Alignment Scoring in Orchestrator

**Files:**
- Modify: `src/lib/providers/streaming.ts`

- [ ] **Step 1: Create a scoring helper**
Implement a function that calculates how "good" a match is based on name strictness and episode count alignment.

- [ ] **Step 2: Update `findStreamAvailability` to pick the best score**
Instead of returning the first `available: true`, collect all results and pick the one with the highest alignment score.

- [ ] **Step 3: Update `getStreamSource` to support expected episodes**
Ensure the source fetching also benefits from metadata.

---

### Task 3: Pass Metadata from Pages

**Files:**
- Modify: `src/app/anime/[id]/page.tsx`
- Modify: `src/app/watch/[id]/page.tsx`

- [ ] **Step 1: Update Detail Page call**
Pass the total episodes to the availability check.

- [ ] **Step 2: Update Watch Page call**
Ensure the Watch page also uses this logic to prevent it from loading the wrong source if a user lands there directly.

---

### Task 4: Verification and Final Build

- [ ] **Step 1: Run local build**
Verify no TypeScript regressions.

- [ ] **Step 2: Cleanup and Final check**
Confirm the Gintama Movie vs TV issue is resolved via the scoring logic.
