# Implementation Plan - Redesigning Awaaz to a Professional Green/Light Interface

This plan describes the redesign of Awaaz to use the specific green, white, and gray light-mode palette. This aesthetic will feel highly reliable, governmental, and professional, making the civic signal and cockpit experience stand out.

## User Review Required

> [!IMPORTANT]
> The interface will utilize your specific color tokens:
> - **Canvas (Background)**: `#F6FEF8` (Very Light Green)
> - **Primary Actions**: `#16A34A` (Green) and `#15803D` (Primary Hover)
> - **Card / Panel Background**: `#FFFFFF` (White)
> - **Sidebar (Queue / Strip)**: `#14532D` (Deep Green) and `#166534` (Sidebar Hover)
> - **Borders / Separators**: `#D1FAE5` (Soft Green)
> - **Typography**: `#1F2937` (Dark Gray Primary) and `#6B7280` (Gray Secondary)
> - **Statuses**: `#22C55E` (Success), `#F59E0B` (Warning/New), `#EF4444` (Error/Rose), `#3B82F6` (Info/Blue)

## Proposed Changes

We will modify the global CSS layout rules and verify compilation.

---

### Design System & Theme

#### [MODIFY] [styles.css](file:///c:/Users/Shyam/Build-with-AI/frontend/src/styles.css)
- Implement your custom color palette in the CSS variables block:
  - `--bg`: `#F6FEF8`
  - `--surface`: `#FFFFFF`
  - `--surface-soft`: `#F0FDF4` (very light green tinted row background)
  - `--surface-card`: `#FFFFFF`
  - `--ink`: `#1F2937`
  - `--muted`: `#6B7280`
  - `--line`: `#D1FAE5`
  - `--line-strong`: `#A7F3D0` (slightly stronger border)
  - `--brand`: `#16A34A`
  - `--brand-dark`: `#15803D`
  - `--brand-light`: `#059669`
  - `--accent`: `#F59E0B`
  - `--teal`: `#22C55E`
  - `--rose`: `#EF4444`
  - `--violet`: `#3B82F6`
  - `--ok`: `#22C55E`
  - `--warn`: `#F59E0B`
- Style cards to have a clean, light drop shadow (`box-shadow: 0 4px 18px rgba(22, 163, 74, 0.04)`).
- Style Sidebar items (such as the queue list and top navigation panels) with Deep Green `#14532D` backgrounds where appropriate (or keep them clean white with deep green accents and indicators to feel unified).
- Style inputs: white background, fine `#D1FAE5` borders, focus outline in `#16A34A` with a soft green glow shadow.
- Badges: soft pastel colors with rich dark text to ensure high accessibility contrast.

---

### Verification Plan

### Automated Verification
- Run `npm run build` in the `frontend/` directory to check bundling.

### Manual Verification
- Launch Vite dev server, log into both dashboards, and check that visual hierarchy, typography, form fields, and status indicators align.
