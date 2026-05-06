---
name: Live Warp Preview Panel Zazzle Parity
description: Restructured variant panel to show cylindrical warp preview at top (Zazzle-style), fixed context bar type check for Fabric.js 6.x i-text
type: green
stage: green
date: 2026-04-30
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: chat
labels: ["live-preview","warp","cylindrical","context-bar","fabric-js","layout","zazzle-parity"]
---

## Prompt

Context bar nhi ho rahi show when selected text. Also: Zazzle main dekho jub print area main change kro to wo text and image side mai image round ghoomti hai par mere pas nhi ho raha aisa or preview mai bhi round dekhti hai — aise kya krna hoga. (Two screenshots provided: user's plugin vs Zazzle.)

## Response

### Fix 1 — Context bar not showing for selected text
`showContextBar()` in `canvas-editor.js` line 526 checked `obj.type === 'IText' || obj.type === 'Textbox'` but Fabric.js 6.x uses `'i-text'` as the type string for IText objects.

**Change**: Added `|| obj.type === 'i-text'` to the isText check.

### Fix 2 — Live warp preview restructure (Zazzle parity)
The cylindrical warp preview (`#warp-preview-canvas` + 7 angle thumbs) was buried below product options in a 210px panel — users couldn't see it. Zazzle shows the live wrapped mug preview prominently at the top of the right panel.

**Changes**:
- `designer.php`: Moved live preview section to TOP of `#variant-panel`, above product options. Added `.live-preview-section` wrapper with `LIVE PREVIEW` header + current angle badge. Increased thumb canvas resolution (72×58). Added `.variant-options-section` wrapper for style/size/color options below.
- `designer.css`: Increased panel width 210px → 258px. Added `.live-preview-section` (blue-tinted bg, prominent). Changed angle strip from 3-column to 4-column grid. Panel gets `max-height: calc(100vh - 76px)` + scrollable to handle tall viewports. Added `.live-preview-title` (brand-colored), `.live-preview-angle` (pill badge showing current angle).

## Files Modified
- mug-customizer/public/assets/js/canvas-editor.js (context bar isText fix)
- mug-customizer/public/templates/designer.php (panel restructure)
- mug-customizer/public/assets/css/designer.css (panel styling)
