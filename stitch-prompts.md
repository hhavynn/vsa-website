# Stitch Generation Prompts — VSA Editorial Design System

Copy each prompt into https://stitch.withgoogle.com
Settings: **Device: Desktop · Model: Gemini 3 Pro**

---

## SCREEN 1 — Member Roster

```
[Context]
Admin table view for a Vietnamese Student Association data platform.
Design language: Refined Editorial. No glassmorphism, no gradients, no soft shadows.
All structure comes from 1px solid borders. Strict 8px spacing grid.
Font: Inter variable (400/500/600/700). Dark mode: #09090b background, #fafafa text.
Light mode: #fafafa background, #09090b text.
Accent: #4f46e5 (indigo-600) for CTAs, selected rows, focus rings only.
Border colors: #e2e8f0 (light) / #27272a (dark).

[Layout]
Full-width admin shell. No sidebar. Top-aligned page header.
Vertical stack: page title row → stat cards → toolbar → data table → pagination.
Page max-width: 1280px, centered, px-8 padding.

[Components]
PAGE HEADER
- Left: "Members" in Inter 24px/700, color #09090b dark:#fafafa
- Right: "Export CSV" button — outline style, h-9, px-4, border #e2e8f0, text #374151, Inter 13px/500

STAT CARDS (4-column grid, gap-4, no shadow)
Each card: border 1px solid #e2e8f0 (dark: #27272a), rounded-md, px-4 py-3, bg white (dark: #18181b)
- Card 1: label "Total Members" 11px/500 zinc-500, value "497" 28px/700 zinc-900
- Card 2: label "Active This Semester" 11px/500 zinc-500, value "312" 28px/700 zinc-900
- Card 3: label "Points Leaders" 11px/500 zinc-500, value "View Top 10 →" 13px/500 indigo-600
- Card 4: label "Avg Attendance" 11px/500 zinc-500, value "3.2 events" 28px/700 zinc-900

TOOLBAR (mt-6, flex justify-between items-center)
Left group (gap-2):
- Search input: h-9, w-64, border 1px #e2e8f0, rounded-md, placeholder "Search members…", pl-9, Inter 13px
  Prefix icon: magnifying glass 14px zinc-400
- "Filter" button: outline, h-9, px-3, border #e2e8f0, text zinc-600, Inter 13px/500, chevron-down icon right
Right:
- "Export CSV" — primary outlined button h-9

DATA TABLE (mt-4, border 1px solid #e2e8f0 dark:#27272a, rounded-md, overflow hidden)
Table header: bg #f4f4f5 dark:#27272a, border-bottom 1px #e2e8f0, py-2.5 px-4
  Columns (Inter 11px/600 uppercase tracking-wide zinc-500):
  NAME · YEAR · POINTS · ATTENDANCE · LAST SEEN · (empty — actions)

Table rows (border-bottom 1px #e2e8f0 dark:#27272a, py-3 px-4, hover bg-zinc-50 dark:hover:bg-zinc-800/50):
Show 8 sample rows with alternating realistic Vietnamese-American names.
- NAME cell: 32px circular avatar (zinc-200 bg, zinc-600 initials 12px) + name 13px/500 zinc-900 + email 11px zinc-400 below
- YEAR cell: pill badge — Inter 11px/500, border 1px, rounded-full, px-2 py-0.5
  Freshman=zinc bg, Sophomore=blue bg #eff6ff text #1d4ed8, Junior=violet bg, Senior=indigo bg
- POINTS cell: "142 pts" 13px/600 zinc-900
- ATTENDANCE cell: "7 events" 13px zinc-600
- LAST SEEN cell: "2 days ago" 13px zinc-400
- ACTIONS cell: "Edit" ghost btn 12px + "View" ghost btn 12px, gap-1

1 row shown as SELECTED: bg #eef2ff dark:bg-indigo-950/30, left border 2px solid #4f46e5

PAGINATION (mt-0, border-top 1px #e2e8f0, px-4 py-3, flex justify-between items-center)
Left: "Showing 1–25 of 497 members" — Inter 12px zinc-500
Right: rows-per-page select (h-8 border #e2e8f0 rounded text-xs) + prev/next buttons (h-8 w-8 border rounded-md)
```

---

## SCREEN 2 — Admin Points Dashboard

```
[Context]
Admin analytics view for a Vietnamese Student Association data platform.
Design language: Refined Editorial. Single-column with a right sidebar.
No glassmorphism, no gradients, no atmospheric shadows.
All containers use 1px solid border (#e2e8f0 light / #27272a dark) for structure.
Font: Inter variable. Accent: #4f46e5 (indigo-600) only.
Background: #fafafa (light) / #09090b (dark). Surface: white (light) / #18181b (dark).

[Layout]
Two-column layout: main content (flex-1) + right sidebar (w-72, fixed).
Main column: KPI cards → Leaderboard table → Recent Check-ins feed.
Sidebar: page header + Quick Actions panel.
Page max-width 1280px, px-8, gap-8. Top: page title row spanning full width.

[Components]
PAGE TITLE ROW (mb-8, flex justify-between items-center)
- Left: "Points Overview" Inter 22px/700 zinc-900
- Right: date range picker — two date inputs side by side, border #e2e8f0, h-9, rounded-md, Inter 13px, with calendar icon

KPI CARDS (3-column grid, gap-4)
Each: border 1px #e2e8f0 dark:#27272a, rounded-md, px-5 py-4, NO shadow, bg white dark:#18181b
- KPI 1: label "Total Points Distributed" 11px/500 zinc-500 uppercase tracking-wide
  value "24,830" 32px/700 zinc-900, sub "↑ 12% vs last month" 12px text-emerald-600
- KPI 2: label "Top Earner This Week" 11px/500 zinc-500 uppercase tracking-wide
  value "Linh Nguyen" 20px/600 zinc-900, sub "340 pts this week" 12px zinc-500
  small circular avatar 28px zinc-200 initials left of name
- KPI 3: label "Events This Month" 11px/500 zinc-500 uppercase tracking-wide
  value "8" 32px/700 zinc-900, sub "Next: Spring Mixer in 3 days" 12px zinc-500

LEADERBOARD TABLE (mt-8)
Section label: "Top 10 Leaderboard" Inter 14px/600 zinc-900 mb-3
Table: border 1px #e2e8f0 rounded-md overflow-hidden
Header: bg #f4f4f5, border-bottom, columns: RANK · NAME · TOTAL PTS · Δ WEEK (11px/600 zinc-500 uppercase)
10 rows (py-2.5 px-4 border-bottom hover:bg-zinc-50):
- RANK: #1 in Inter 13px/700 zinc-900, #2-#3 in zinc-600, rest zinc-400
- NAME: avatar 24px + name 13px/500 zinc-900
- TOTAL PTS: 13px/600 zinc-900
- Δ WEEK: "+24" text-emerald-600 Inter 12px/600, or "-8" text-red-500
Row 1 highlighted: bg #eef2ff left-border 2px #4f46e5

RECENT CHECK-INS (mt-8)
Section label: "Recent Check-ins" Inter 14px/600 zinc-900 mb-3
List: border 1px #e2e8f0 rounded-md overflow-hidden
8 items (border-bottom px-4 py-3 flex justify-between hover:bg-zinc-50):
Left: member name 13px/500 zinc-900 + event name "Spring Kick-off" 12px zinc-400 below
Right: timestamp "2h ago" 12px zinc-400 + points badge "+10 pts" bg-indigo-50 text-indigo-700 border-indigo-200 rounded px-2 py-0.5 12px/600

SIDEBAR (w-72 shrink-0)
Sticky top-0. No border on sidebar itself.

QUICK ACTIONS panel: border 1px #e2e8f0 dark:#27272a rounded-md overflow-hidden
Panel header: "Quick Actions" 12px/600 zinc-500 uppercase tracking-wide bg-zinc-50 px-4 py-3 border-bottom
Actions list (divide-y #e2e8f0):
- "+ Add Points" — full-width, py-3 px-4, Inter 13px/500 zinc-700, indigo chevron-right right, hover bg-zinc-50
- "Import Attendance" — same style
- "Generate Check-in Code" — same style, bottom-most item shows small grey code preview "VSA-2024-★★★★" below label in 11px zinc-400
```

---

## After generation
1. In Stitch: Screenshot the result, export HTML
2. Run: `npx stitch-kit stitch-react-components` with the exported HTML to get TSX
3. Or use the stitch-orchestrator skill in a session where Stitch MCP is connected
