# Mobile Responsive Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize and optimize the Celestia homepage for mobile devices with a centered cinematic hero, responsive header, and touch-friendly content rails.

**Architecture:** Use CSS media queries to adjust global variables and component-specific styles. Refactor `HomeHeroCarousel` for a centered mobile layout and `SiteHeader` for better mobile spacing. Update `HomeShelf` and `HomeTrendingRail` to use large cards that peek from the edges to indicate swipeability.

**Tech Stack:** Next.js, TypeScript, Lucide React, Vanilla CSS.

---

### Task 1: Responsive Layout Foundations

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Define mobile-specific CSS variables and shell adjustments**

```css
/* Update src/app/globals.css around line 80 */
:root {
    --page-padding: 48px;
}

@media (max-width: 768px) {
    :root {
        --page-padding: 20px;
        --radius: 16px;
    }

    main {
        padding-top: 84px; /* Reduced from 104px */
    }

    .page-shell {
        width: calc(100% - 40px); /* 20px padding each side */
        gap: 20px;
    }
}
```

- [ ] **Step 2: Verify layout changes**
Check that the main container padding reduces on mobile screens (768px and below).

- [ ] **Step 3: Commit**
```bash
git add src/app/globals.css
git commit -m "style: add mobile responsive foundations and variables"
```

---

### Task 2: Responsive Site Header

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/site-header.tsx`

- [ ] **Step 1: Adjust header spacing and icon sizes**

```css
/* Update src/app/globals.css header section */
@media (max-width: 768px) {
    .site-header {
        padding: 10px 16px;
    }

    .site-header-row {
        padding: 0;
        gap: 12px;
    }

    .brand-mark {
        font-size: 1.4rem;
    }

    .header-icon-button, .header-avatar {
        width: 40px;
        height: 40px;
        border-radius: 12px;
    }
}
```

- [ ] **Step 2: Verify header responsiveness**
Ensure icons and brand mark scale down and maintain alignment on mobile.

- [ ] **Step 3: Commit**
```bash
git add src/app/globals.css
git commit -m "style: optimize site header for mobile"
```

---

### Task 3: Mobile-Optimized Hero Carousel

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/home-hero-carousel.tsx`

- [ ] **Step 1: Implement centered layout in CSS**

```css
/* Update src/app/globals.css hero section */
@media (max-width: 768px) {
    .celestia-hero {
        margin-top: -84px;
        margin-bottom: 24px;
    }

    .celestia-hero-inner {
        aspect-ratio: 4 / 5;
        min-height: 540px;
    }

    .celestia-copy {
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        text-align: center;
        padding: 40px 20px 60px;
    }

    .celestia-copy-main {
        max-width: 100%;
        gap: 8px;
    }

    .celestia-copy-main h1 {
        font-size: 2.4rem;
        line-height: 1.1;
    }

    .celestia-description {
        display: none; /* Hide long descriptions on small mobile */
    }

    .celestia-pills {
        justify-content: center;
        gap: 6px;
    }

    .celestia-pills span {
        padding: 4px 10px;
        font-size: 0.75rem;
    }

    .celestia-actions {
        width: 100%;
        justify-content: center;
        margin-top: 16px;
    }

    .celestia-watch {
        flex: 1;
        max-width: 200px;
    }

    .celestia-dots {
        bottom: 16px;
    }

    .celestia-dots button {
        width: 32px;
    }
}
```

- [ ] **Step 2: Adjust Save Button to icon-only on mobile**
Modify `src/components/home-hero-carousel.tsx` to pass a prop or use a class to hide text in `DetailsSaveButton` if necessary (or handle via CSS).

- [ ] **Step 3: Verify Hero Carousel**
Ensure titles are centered, large, and gradient-filled. Verify swipe still works.

- [ ] **Step 4: Commit**
```bash
git add src/app/globals.css src/components/home-hero-carousel.tsx
git commit -m "style: implement centered cinematic hero for mobile"
```

---

### Task 4: Responsive Content Rails (HomeShelf & Trending)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Adjust Rail Card sizing for mobile peeking**

```css
/* Update src/app/globals.css rail sections */
@media (max-width: 768px) {
    .trending-rail {
        grid-auto-columns: 260px; /* Force size to ensure peeking */
        gap: 16px;
        padding-left: 0;
        margin-left: 0;
        width: auto;
    }

    .home-shelf-row {
        grid-template-columns: 1fr;
        gap: 24px;
    }

    .shelf-card {
        padding: 10px;
    }
}
```

- [ ] **Step 2: Verify Rail Peeking**
Check that the second card in the trending rail is partially visible on mobile widths.

- [ ] **Step 3: Commit**
```bash
git add src/app/globals.css
git commit -m "style: update content rails for mobile swipeability"
```

---

### Task 5: Final Polish and Refinement

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Apply global responsive font sizes and spacing**
Review other home components (`AiringBoard`, `HomeUpcomingGrid`) and apply minor mobile fixes.

- [ ] **Step 2: Final Verification**
Run the site on a mobile viewport and verify all success criteria.

- [ ] **Step 3: Commit**
```bash
git add src/app/globals.css
git commit -m "style: final mobile responsive polish"
```
