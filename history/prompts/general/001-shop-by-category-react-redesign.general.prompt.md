---
id: 001
title: Shop by Category React Component Redesign
stage: general
date: 2026-04-27
surface: agent
model: claude-sonnet-4-6
feature: none
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: inline prompt
labels: ["ui-design","react","tailwind","components","ecommerce"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - react-components/ShopByCategory.jsx
  - react-components/preview.html
tests:
  - visual preview via react-components/preview.html (open in browser)
---

## Prompt

You are a senior UI/UX designer and frontend engineer.

Redesign the "Shop by Category" section of an eCommerce website to match a premium, modern SaaS-level user experience (similar to Zazzle, Etsy, or Apple-level design quality).

[Full requirements: card design with 16-20px radius, soft shadows, equal-size cards; consistent SVG mockup illustrations for 8 categories (Mug, Photo Book, T-shirt, Phone Case, Invitation Card, Wall Frame, Gift Box, Office Stationery); #F7F8FA section background; medium-weight typography; hover lift + shadow + image scale (0.2-0.3s ease); 8-column desktop / 4-column tablet / 2-column mobile grid; React + Tailwind CSS; clean production-ready component-based structure.]

## Response snapshot

Created two files:

1. `react-components/ShopByCategory.jsx` — Production React component with:
   - 8 inline SVG mockup components (MugMockup, PhotoBookMockup, TshirtMockup, PhoneCaseMockup, InvitationCardMockup, WallFrameMockup, GiftBoxMockup, OfficeMockup), each on a 240×240 canvas with a per-category pastel backdrop circle and minimal product illustration
   - CategoryCard: `group` hover coordination, `hover:-translate-y-[6px]`, `hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)]`, inner image `group-hover:scale-[1.05]` with overflow-hidden clipping
   - Responsive grid: `grid-cols-2 sm:grid-cols-4 lg:grid-cols-8`, gap-3→5
   - Section header with eyebrow label, H2, and subtitle
   - Browse-all CTA with animated arrow

2. `react-components/preview.html` — Zero-build standalone preview using CDN React 18 + Babel + Tailwind Play CDN; open directly in browser to preview the component.

## Outcome

- ✅ Impact: Full React component ready to drop into any React/Next.js project with Tailwind CSS
- 🧪 Tests: Manual visual verification via preview.html
- 📁 Files: react-components/ShopByCategory.jsx, react-components/preview.html
- 🔁 Next prompts: wire up real category URLs, add skeleton loading state, integrate with WooCommerce REST API for dynamic category data
- 🧠 Reflection: Inline SVGs keep zero external image dependencies; pastel per-category backdrops give visual variety while keeping consistent illustration style

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): visual review pending
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): swap SVG mockups for real product photography once available
