# Press On Ventures — Interactive Investor Deck

Phase 1 of the interactive web-based investor presentation for Press On Ventures Fund I.

## Overview

A fully static, animated investor deck that replaces the PDF pitch deck. Runs in any modern browser with no build step, server, or dependencies — just open `index.html`.

## Files

```
povc-investor-deck/
├── index.html    ← All 14 sections, semantic HTML
├── styles.css    ← Complete design system + responsive
├── main.js       ← Animations, scroll effects, navigation
└── README.md     ← This file
```

## Sections

| # | Section | Notes |
|---|---------|-------|
| 1 | Cover | Dark hero with grid, animated stats |
| 2 | Mission Statement | Beige, large headline |
| 3 | Opportunity Summary | Split layout, 4 info cards |
| 4 | Fund Design | Bar chart + category breakdown |
| 5 | Thesis & Focus | 3 dark cards, numbered |
| 6 | Portfolio Snapshot | 3 animated donut charts + legend |
| 7 | Portfolio A | 10Beauty, Cofertility, Feno |
| 8 | Portfolio B | Jacob Bar, Magic Story, Recess |
| 9 | Portfolio C | Rhythm Sciences, SipMargs, Skylark |
| 10 | Snapfix | Featured card + portfolio badge |
| 11 | Team | Willie Litvack + Sean Tolkin |
| 12 | Venture Partners | Advisory network |
| 13 | LP Terms | Fund economics grid |
| 14 | Contact | Dark closing with CTA |

## Design System

- **Fonts:** Inter Bold (headings) · Poppins Medium/Regular (body) — loaded from Google Fonts
- **Colors:** `#292929` Dark · `#FFFFFF` White · `#F2F2F2` Light Grey · `#E0D8D1` Beige
- **Logo:** Power button SVG replacing the "O" in "ON" (inline SVG, light/dark variants)

## Animation Features

- ✅ Scroll-triggered fade-in (Intersection Observer, `data-delay` stagger)
- ✅ Count-up numbers (`data-target`, `data-prefix`, `data-suffix`)
- ✅ Animated SVG donut charts (stroke-dasharray from 0 → value)
- ✅ Fund bar chart (CSS scale animation on scroll)
- ✅ Parallax on cover grid and contact accent
- ✅ Portfolio card stagger (100ms / 200ms / 300ms delays)
- ✅ Floating nav dots (14 sections, active tracking, dark/light switching)
- ✅ Top nav with scroll-state shadow and active link highlighting
- ✅ Mobile hamburger menu

## Running Locally

```bash
# Option 1: Open directly (works for fonts/JS)
open index.html

# Option 2: Local server (recommended for best experience)
npx serve .
# or
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deployment

Drop the three files (`index.html`, `styles.css`, `main.js`) into any static host:
- **Netlify:** drag & drop folder at app.netlify.com
- **Vercel:** `vercel --prod` from this directory
- **GitHub Pages:** push to a repo, enable Pages
- **Any CDN/S3:** upload all 3 files

No build step, no dependencies, no server required.

## Phase 2 Roadmap (Future)

- [ ] Email gate / password protection
- [ ] Analytics (page views, section dwell time)
- [ ] Real team/company photos
- [ ] Actual venture partner names and bios
- [ ] DocSend-style link tracking
- [ ] PDF export button
- [ ] Dark/light mode toggle
