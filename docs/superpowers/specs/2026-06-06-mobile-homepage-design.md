# Design: Mobile Responsive Homepage

Standardize and optimize the Celestia homepage for mobile devices with a focus on cinematic impact and ease of use.

## Design Decisions

### 1. Hero Section (HomeHeroCarousel)
- **Layout:** Centered content for a premium, cinematic feel.
- **Height:** Tall aspect ratio (approx. 4:5) to allow "Continue Watching" to peek from the bottom, encouraging scroll.
- **Typography:** Extra-large, bold titles that overlap the backdrop. Use the brand's theme-colored gradient for text.
- **Interactions:** Maintain horizontal swipe gestures; refine the pagination "dots" to be larger and more touch-friendly.
- **Actions:** Primary "Watch Now" button centered, secondary "Save" button as a stylized icon-only circle button.

### 2. Header (SiteHeader)
- **Style:** Floating glass (backdrop-filter: blur) that remains at the top.
- **Branding:** "CELESTIA" mark centered or left-aligned depending on layout balance.
- **Actions:** Icons (Search, Notifications, Profile) grouped on the right.

### 3. Content Sections (HomeShelf, TrendingRail, etc.)
- **Rails:** Use large, swipeable cards for "Continue Watching" and "Trending" to maximize visual impact.
- **Thumbnails:** Standardize aspect ratios for mobile (16:9 for episodes/continue watching, 2:3 for anime posters).
- **Spacing:** Reduce horizontal padding of the `.page-shell` from 48px to 16px or 20px on mobile to maximize screen real estate.

### 4. Aesthetics & Polish
- **Blur Effects:** Heavy use of backdrop blurs and linear gradients to ensure text readability over hero images.
- **Transitions:** Smooth transitions between carousel slides.

## Technical Approach

- **CSS Variables:** Utilize media queries to adjust existing CSS variables (`--page-padding`, font sizes).
- **Layout:** Switch from `display: flex` with fixed widths to more flexible grid/flex layouts using `flex-wrap: wrap` or conditional `grid-template-columns`.
- **Media Queries:** Use `@media (max-width: 768px)` as the primary breakpoint.

## Success Criteria
- HomeHeroCarousel looks intentional and premium on mobile, not "broken."
- Navigation is clear and touch-friendly.
- At least two content items are partially visible in rails to signify swipeability.
