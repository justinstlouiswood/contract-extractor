# MSA Extraction Machine

Internal tool for Customer Success, Finance, and Legal teams to extract, review, and distribute structured data from SaaS Master Service Agreement (MSA) order forms.

## Tech Stack

- **Backend**: Flask (Python 3.9)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (New York)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`) for contract analysis
- **Email**: Gmail OAuth2 integration (send + Google Sheets push)
- **PDF Processing**: PyMuPDF, PyPDF2, pdf2image, pytesseract
- **PDF Viewing**: pdfjs-dist (bundled via Vite, continuous scroll with text layer)
- **Excel Export**: SheetJS (`xlsx`, bundled via Vite)
- **Charts**: Recharts (ComposedChart with Bar + Line)
- **Icons**: lucide-react
- **Deployment**: Railway with Railpack (auto-detected Python build, pre-built frontend)

---

## Architecture: Extract > Review > Distribute

Three-phase pipeline designed for a single RevOps / Deal Desk user.

### Phase 1: Extract

Upload a PDF. The backend extracts page-marked text via PyMuPDF, sends it to Claude with a structured prompt, and parses the response into JSON. Every extracted field carries an extraction signal (`EXPLICIT`, `INFERRED`, `PARTIAL`, `MULTIPLE`, `NOT_FOUND`) and page reference(s) in `[SIGNAL:PAGE]` format. The backend computes per-field confidence scores (0-100) from three factors: signal strength (50%), format validation (25%), and cross-field consistency (25%).

### Phase 2: Review

Split-panel workspace. Left panel shows extracted data in collapsible sections (Contract Details, Fees & Revenue, Signatures & Terms, Full Extracted Text). Each section wraps a `ReviewFieldTable` with columns for Field, Value, Page ref, and Edit. Users verify sections by category; a `VerificationProgress` bar tracks how many of the three categories are verified. All categories must be verified to unlock distribution.

Right panel renders the source PDF with pdfjs-dist. Clicking a page ref pill scrolls the PDF to the source page.

### Phase 3: Distribute

Four channels unlock after all categories are verified:

1. **Copy** - One-click clipboard copy of formatted summary
2. **Email** - Gmail OAuth2 integration (compose with To, CC, Subject, Body)
3. **Slack** - Incoming webhook with Block Kit message
4. **Sheet** - Download as Excel/CSV/JSON, or push a row to Google Sheets via API

---

## Design System

**Warm off-white light mode. Inter sans-serif. 6px rounded rectangles. Soft shadows.**

Aesthetic target: "Notion meets a white-shoe law firm" — warm whites, soft shadows, quiet depth.

### Typography

- **Global typeface**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` applied to `html, body` via `globals.css`
- **Data values**: Regular weight, no monospace. Use `tabular-nums` for numeric alignment
- **Monospace exceptions** (keep `font-mono`): extracted text `<pre>` blocks, Spreadsheet ID input, Gmail email display
- **Sizes**: 28px stat card values, 22px page title, 13px body/labels, 12px/11px captions

### Color System

Single permanent light mode. No dark mode, no theme toggle, no `dark:` classes.

**Surface depth hierarchy** (lightest to darkest):

| Layer | Color | Token | Usage |
|-------|-------|-------|-------|
| Cards | `#FFFFFF` | `--card` | Highest layer, pure white with `shadow-card` |
| Canvas | `#F5F4F1` | `--background` | Main app background, warm off-white |
| Secondary | `#EFEDE9` | `--surface-secondary` | Sidebar, PDF panel background |
| Inner tint | `#FAFAF8` | `--surface-tint` | Barely-there tint within expanded card sections |

**Key neutral tokens**:
- `--foreground: #1A1A1A` (near-black text)
- `--muted-foreground: #6B6B6B` (secondary text)
- `--border: #E0DDD7` (warm gray borders)
- `--secondary: #F0EEE9`, `--accent: #ECEAE5`

**Chart accent colors**: Moss `#2D6A4F`, Sage `#52B788`

**Semantic status tokens**:

| Tier | Background | Ring/Border | Text |
|------|-----------|-------------|------|
| Success | `#F0FDF4` | `#BBF7D0` | `#15803D` |
| Danger | `#FEF2F2` | `#FECACA` | `#DC2626` |

**Badge variants** (defined in `badge.tsx` cva):
- `extracted`: green bg/text/border (`--extracted-*` tokens)
- `warning` / `danger`: red bg/text/border (`--danger-*` tokens)
- `success`: green bg/text/border (`--success-*` tokens)

**Source tag colors** (in `getTagColor()`):

| Tag | Background | Text |
|-----|-----------|------|
| EXPLICIT | `#F0FDF4` | `#15803D` |
| INFERRED | `#F0EEE9` | `#6B6B6B` |
| NOT_FOUND | `#F0EEE9` | `#A0A0A0` |
| PARTIAL | semantic `warning-bg` | semantic `warning-text` |
| MULTIPLE | semantic `neutral-bg` | semantic `neutral-text` |

### Shadows

Two tiers defined as `@utility` in `globals.css`:

| Utility | Shadow | Usage |
|---------|--------|-------|
| `shadow-card` | `0 1px 4px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)` | Cards, stat tiles, tables, expandable sections |
| `shadow-float` | `0 2px 8px rgba(0,0,0,0.10), 0 6px 20px rgba(0,0,0,0.08)` | Floating dock, dialogs, tooltips, copy feedback toast |

### Shape

- **Border radius**: `--radius: 0.375rem` (6px). All radius tokens (`--radius-sm` through `--radius-4xl`) set to `0.375rem`
- **No pills**: All badges, tags, and chips use `rounded-md` (6px). Never `rounded-full` except for timeline dots
- **Cards**: `rounded-sm` (6px) on all card-like containers

### Spacing

- All styling via Tailwind utility classes, no custom CSS files beyond `globals.css`
- No emojis in code or UI

---

## Data Model

### ParsedData (frontend: `types/contract.ts`)

```
customer_name         string        Customer / company legal name
duration              string        e.g. "3 years"
subscription_start    string        e.g. "January 1, 2024"
subscription_end      string        e.g. "December 31, 2026"
total_contract_value  number        Sum of all annual fees + onboarding
currency              string        e.g. "CAD", "USD"
onboarding_fee        number        One-time setup fee
payment_terms         string        e.g. "Net 30" (normalized)
annual_fees           AnnualFee[]   { year: number, amount: number }
point_of_contact      Contact       { name?, email?, title? }
billing_contact       Contact       { name?, email?, title? }
signatures            { customer: Signature, vendor: Signature }
                                    Signature = { name?, date?, title? }
notes                 string        Footnotes / conditions (verbatim)
additional_terms      string        MSA reference date
clauses               Record<string, ClauseInfo>
                                    ClauseInfo = { present: boolean, description?: string }
confidence            Record<string, number>   Per-field scores 0-100
page_refs             Record<string, number[]> Field key -> source page(s)
```

### Clause Keys

```
auto_renewal              Auto-Renewal
termination_convenience   Termination for Convenience
sla_guarantee             SLA Guarantee
liability_cap             Liability Cap
data_processing           Data Processing / DPA
price_escalation          Price Escalation
exclusivity               Exclusivity
indemnification           Indemnification
```

### Verification Categories

Three categories group verifiable fields:

| Category | Fields |
|----------|--------|
| `contract_details` | customer_name, duration, subscription_start, subscription_end, point_of_contact, billing_contact |
| `fees_revenue` | onboarding_fee, payment_terms, annual_fee_year_N |
| `signatures` | signature_customer, signature_vendor, notes, additional_terms |

All three must be verified to unlock distribution.

---

## UX Flow

### Homepage ("Command Center")

- Centered layout with `min-h-screen flex-col justify-center`
- Title: "MSA Extraction Machine" at 22px with FileText document icon, centered
- Three stat cards in a row: Total Contracts, Total Contract Value, Last Extracted
  - Cards: `rounded-lg border border-border bg-card p-6`, 28px semibold values
- Split layout below: Recent Extractions table (60%) | Upload drop zone (40%)
  - Table: paginated, sortable, searchable. Rows show customer, duration, value, status (`extracted` badge variant), date
  - Drop zone: solid 1px border at rest, dashed 2px on hover/drag. Upload icon at 44px
  - Empty state: italic placeholder text when no contracts exist

### Processing View

- Centered card with filename, four processing steps with numbered indicators
- Step statuses: pending (border), in_progress (border + pulse bar), complete (filled + check icon)
- Overall progress bar at bottom with percentage

### Floating Dock

- Fixed top-center, `z-50`. Appears on processing and detail views
- Three states:
  - Processing: Back button | "Processing" badge | Stop button
  - Complete: Back button | "Processing Complete?" | Yes (green) | No (red, no-op)
- No button is intentionally a no-op (keeps user on page)

### Review Workspace (Detail View)

Left panel sections (top to bottom):

1. **Summary Card** - TCV as 30px value, currency as small muted label, customer name, duration/dates. Review badge if TCV confidence < 85. Lock CTA when unverified; distribution buttons when unlocked (Copy, Email, Slack, Sheet). Sub-panels expand inline for email compose, Slack webhook, Sheets push
2. **Contract Timeline** - Horizontal progress bar showing elapsed vs remaining time. Tick marks on date labels. Expired badge if past end date
3. **Verification Progress** - Progress bar with "X of Y verified" label. "Mark All Verified" button
4. **Extraction Confidence** - Two-tier heatmap (High Confidence >= 85, Needs Review < 85). Colored tier labels: green for high, red for review. Percentage appended to each score. Tier separator border between groups
5. **Contract Details** (collapsible) - `ReviewFieldTable` with field/value/page/edit columns
6. **Fees & Revenue** (collapsible) - `ReviewFieldTable` + `RevenueChart` (bar chart with YoY escalation labels connected by anchor lines, dashed cumulative TCV line) + `PaymentTimeline` (dots on baseline: hollow for onboarding, filled for annual)
7. **Signatures & Terms** (collapsible) - `ReviewFieldTable` + `ClauseTags` (present clauses with green `+` prefix, absent with red minus prefix, bordered detection count badge)
8. **Full Extracted Text** (collapsible) - Toggle switch for cleaned view (hides source tags). Raw text in `font-mono <pre>` with inline tag badges

Right panel: PDF viewer in a `rounded-xl border border-border bg-card` container. Zoom controls. Page labels as "N of M" (no "Page" prefix). Clicking page ref pills scrolls to source page.

---

## Key Files

| File | Purpose |
|------|---------|
| `app.py` | Flask server, all API routes, Claude prompt, data parsing, confidence scoring |
| `pdf_processor.py` | PDF text extraction with `--- Page N ---` markers |
| `email_service.py` | Gmail OAuth2 + Google Sheets API integration |
| `frontend/src/App.tsx` | Root component, view routing, state management |
| `frontend/src/types/contract.ts` | TypeScript interfaces for all data structures |
| `frontend/src/lib/contract-utils.ts` | Utility functions (format, export, parse, tag colors) |
| `frontend/src/globals.css` | Tailwind v4 theme tokens, oklch color system, Georgia font |
| `frontend/src/hooks/use-theme.ts` | Cleanup-only hook (removes stale `.dark` class + localStorage from prior sessions) |
| `frontend/src/hooks/use-recent-contracts.ts` | localStorage-based contract history (max 20) |
| `frontend/src/components/ui/` | shadcn/ui primitives (Table, Badge, Button, Card, Input, Progress, Dialog, etc.) |
| `frontend/src/components/views/home-view.tsx` | Homepage command center |
| `frontend/src/components/views/processing-view.tsx` | Processing progress card |
| `frontend/src/components/views/review-view.tsx` | Review workspace orchestrator |
| `frontend/src/components/views/pdf-viewer-panel.tsx` | PDF renderer with zoom + scroll-to-page |
| `frontend/src/components/views/duplicate-modal.tsx` | "Contract Already Processed" dialog |
| `frontend/src/components/summary-card.tsx` | Header card with TCV, distribution actions |
| `frontend/src/components/contract-timeline.tsx` | Horizontal timeline with elapsed bar |
| `frontend/src/components/verification-progress.tsx` | Category verification progress |
| `frontend/src/components/confidence-heatmap.tsx` | Two-tier confidence display |
| `frontend/src/components/confidence-badge.tsx` | Per-field confidence badge |
| `frontend/src/components/review-field-table.tsx` | Editable field table with page refs |
| `frontend/src/components/revenue-chart.tsx` | Recharts ComposedChart (bars + cumulative line) |
| `frontend/src/components/payment-timeline.tsx` | Payment schedule with baseline dots |
| `frontend/src/components/clause-tags.tsx` | Clause presence tags with +/- prefixes |
| `frontend/src/components/extracted-text-display.tsx` | Raw text with inline source tag badges |
| `frontend/src/components/expandable-section.tsx` | Collapsible section with verify checkbox |
| `frontend/src/components/floating-dock.tsx` | Floating navigation dock |
| `frontend/src/components/dropzone.tsx` | File upload drop zone |
| `frontend/src/components/page-ref-pill.tsx` | Clickable page reference badge |
| `frontend/src/components/home-contract-table.tsx` | Paginated contract history table |
| `frontend/src/components/distribution/email-section.tsx` | Gmail compose panel |
| `frontend/src/components/distribution/slack-panel.tsx` | Slack webhook panel |
| `frontend/src/components/distribution/sheets-panel.tsx` | Google Sheets + export panel |
| `templates/index.html` | Flask template, loads Vite build output |
| `static/dist/` | Vite build output (committed — must rebuild before committing frontend changes) |
| `.env` | API keys (never commit) |
| `.python-version` | Pins Python 3.12 for Railpack builds on Railway |
| `railway.json` | Railpack deploy config (gunicorn start command) |
| `agent.md` | Extraction agent behavior specification |

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Serve main page |
| `/upload` | POST | Upload PDF, extract text, analyze with Claude, return structured JSON |
| `/send-email` | POST | Send email via Gmail OAuth |
| `/send-slack` | POST | Post Block Kit message to Slack via incoming webhook |
| `/push-to-sheets` | POST | Append row to Google Sheet |
| `/pdf/<id>` | GET | Serve uploaded PDF for viewer |
| `/pdf/<id>/check` | GET | Check if PDF exists on disk (200/404) |
| `/auth/gmail` | GET | Initiate Gmail/Sheets OAuth |
| `/auth/gmail/callback` | GET | OAuth callback |
| `/auth/status` | GET | Check auth state |
| `/auth/logout` | POST | Disconnect Gmail |
| `/health` | GET | Health check |

---

## Confidence Scoring

Each extracted field receives a 0-100 confidence score computed from three weighted factors:

### Factor 1: Signal Strength (50 points max)

| Signal | Points | Meaning |
|--------|--------|---------|
| EXPLICIT | 50 | Value found exactly as labeled |
| INFERRED | 35 | Value derived from context |
| MULTIPLE | 30 | Multiple conflicting values found |
| PARTIAL | 25 | Only partial information found |
| NOT_FOUND | 0 | Field not present in document |

### Factor 2: Format Validation (25 points max)

Checks if the extracted value matches expected patterns:
- Dates: `Month DD, YYYY` or `MM/DD/YYYY`
- Duration: `N year(s)` or `N month(s)`
- Email: standard email regex
- Currency: `$N,NNN.NN` format
- Payment terms: `Net NN`
- Full match = 25 points, partial = 12, default = 20

### Factor 3: Cross-Field Consistency (25 points max)

Checks agreement between related fields:
- Duration vs start/end dates
- TCV vs sum of annual fees + onboarding
- Presence of complementary fields (start implies end)

### Confidence Tiers (UI Display)

| Tier | Score | Label |
|------|-------|-------|
| High Confidence | >= 85 | Black text subheading, green-tinted heatmap chips |
| Needs Review | < 85 | Black text subheading, red-tinted heatmap chips |

Card title ("Extraction Confidence") and tier subheadings ("High Confidence", "Needs Review") both use `text-foreground` (black).

---

## Running Locally

```bash
cd contract-extractor

# Development (hot reload)
python3 app.py                    # Flask at http://localhost:5001
cd frontend && npm run dev        # Vite at http://localhost:5173 (proxies API to Flask)

# Production (built assets)
cd frontend && npm run build      # Outputs to static/dist/
python3 app.py                    # Serves everything at http://localhost:5001
```

## Deployment

- **Platform**: Railway (auto-deploys from git push)
- **Builder**: Railpack (replaced Nixpacks — `nixpacks.toml` is ignored)
- **Python version**: Pinned to 3.12 via `.python-version` (Railpack reads this file)
- **Build**: Railpack auto-detects `requirements.txt` and runs `pip install`. Frontend is pre-built and committed to `static/dist/` (no Node.js build step on Railway)
- **Deploy**: `railway.json` specifies start command: `gunicorn --worker-class gevent --workers 1 --timeout 180`
- **Required Railway variables**: `ANTHROPIC_API_KEY`
- Push to `origin` remote (only remote currently configured)

## Environment Variables

```
ANTHROPIC_API_KEY=your-key
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
FLASK_SECRET_KEY=optional-override
```

## Troubleshooting

- If port 5001 is busy: `lsof -ti:5001 | xargs kill -9`
- If modules missing: `pip3 install -r requirements.txt`
- If frontend deps missing: `cd frontend && npm install`
- Server must restart to pick up new `.env` values

---

## Style Preferences

- No emojis in code or UI
- Inter sans-serif for all text; `font-mono` only for raw extracted text, sheet IDs, email addresses
- Bar chart corners: rounded on top only (2px), square on bottom
- All buttons use shadcn Button (outline or ghost variants for secondary actions)
- 6px rounded rectangles on all badges, tags, chips, cards. No pills
- Single permanent light mode. No dark mode, no theme toggle, no `dark:` Tailwind classes
- All styling via Tailwind utility classes
- `tabular-nums` on all numeric data for alignment
- Cards lift off the warm off-white canvas via `shadow-card`; floating elements use `shadow-float`

---

## PDF Storage Architecture

- PDFs stored on disk at `uploads/<uuid>.pdf` via the `/upload` endpoint
- Served to the frontend via `/pdf/<id>` Flask endpoint (`send_file`)
- Availability checked via `/pdf/<id>/check` endpoint (returns `{exists: true/false}` with 200/404)
- `pdfId` (UUID string) passed from `App.tsx` to `PDFViewerPanel` as a prop
- `PDFViewerPanel` pre-flight checks `/pdf/<id>/check` before loading with pdfjs. If 404, shows "Source document expired" and calls `onPdfUnavailable` to collapse the panel. If check passes, loads via `pdfjsLib.getDocument('/pdf/<id>')`
- `PdfStatus` discriminated union (`idle | checking | loading | ready | not_found | load_error`) drives all viewer UI states
- pdfjs-dist Web Worker requires `base: '/static/dist/'` in `vite.config.ts` so the worker URL resolves correctly under Flask's static file serving
- Frontend bundle in `static/dist/` is committed to git and must be rebuilt (`cd frontend && npm run build`) before committing any frontend source changes

---

## Known Issues / Technical Debt

- Railway ephemeral filesystem means `uploads/` PDFs do not persist across deploys. Acceptable for single-session use (upload, review, distribute, done), but if PDFs need to survive deploys, consider Railway Volumes or external storage
- `static/dist/` is committed to git. Any frontend source change requires a rebuild before commit, or the bundle will be stale

---

## Session Log

### Feb 22, 2026 — PDF Viewer Fix

**Problem:** PDF viewer showed "PDF unavailable" on every contract, regardless of upload or history.

**Root causes (two compounding issues):**
1. Frontend source had been reverted from IndexedDB/blob URLs to disk-based `pdfId` storage, but the bundle was never rebuilt — the running JS still tried the old strategy
2. Vite's default `base: '/'` caused the pdfjs Web Worker URL to resolve to `/assets/pdf.worker.min.mjs` instead of `/static/dist/assets/pdf.worker.min.mjs`, producing a 503 and silent "fake worker" fallback

**Fix (commit `fb4de22`):**
- Reverted `app.py` to disk storage (`uploads/`), removed volatile in-memory store with 1-hour TTL
- Reverted `App.tsx` to `pdfId` (UUID string), removed blob URL / IndexedDB logic
- Reverted `pdf-viewer-panel.tsx` to `pdfId` prop, fetch from `/pdf/<id>` with retry
- Added `base: '/static/dist/'` to `vite.config.ts`
- Deleted orphaned `frontend/src/lib/pdf-store.ts`
- Rebuilt frontend bundle

**Cleanup (commit `4f43d03`):**
- Removed unused `import threading` from `app.py`
- Updated `CLAUDE.md` with architecture docs, known issues, and session log

### Feb 22, 2026 — Dead Code Removal

**Problem:** `/upload-stream` SSE endpoint, `/cancel/<job_id>` endpoint, and `active_jobs` dict were all dead code — never called by the frontend, incompatible with the disk-based PDF storage model.

**Fix:**
- Removed `/upload-stream` route and `upload_file_stream()` function (~105 lines)
- Removed `/cancel/<job_id>` route and `cancel_job()` function
- Removed `active_jobs = {}` dict
- Removed unused imports: `tempfile`, `json`, `Response`, `stream_with_context`, `redirect`
- Removed `/upload-stream` proxy from `frontend/vite.config.ts`
- Updated module docstring, API routes table, known issues, and session log in `CLAUDE.md`

### Feb 22, 2026 — Off-White Depth Redesign

**Goal:** Convert from dual light/dark mode to a single permanent light mode with warm off-white depth and dimensionality. "Notion meets a white-shoe law firm."

**Changes (commit `a28682f`, 26 files, 122 insertions, 251 deletions):**

Phase 1 — Strip dark mode infrastructure:
- Deleted `frontend/src/components/theme-toggle.tsx`
- Gutted `frontend/src/hooks/use-theme.ts` to cleanup-only stub (removes stale `.dark` class + localStorage)
- Removed ThemeToggle import/mount from `App.tsx`
- Removed all `dark:` classes from 7 UI component files (button, input, textarea, checkbox, badge, tabs, dropdown-menu)

Phase 2 — Rewrite `globals.css`:
- Removed `@custom-variant dark`, entire `.dark {}` block, toggle vars, 150ms transition rule
- Updated `:root` to warm off-white palette: canvas `#F5F4F1`, secondary `#F0EEE9`, accent `#ECEAE5`, borders `#E0DDD7`, sidebar `#EFEDE9`
- Added surface tokens: `--surface-secondary: #EFEDE9`, `--surface-tint: #FAFAF8`
- Added `@utility shadow-card` and `@utility shadow-float`
- Set all radius tokens to `0.375rem` (6px)

Phase 3 — Apply shadows and surface tokens:
- `shadow-card` on: card.tsx base, stat cards (home-view), table wrapper (home-contract-table), confidence heatmap, verification progress, contract timeline, expandable section headers, PDF inner card, dropzone resting state, empty state
- `shadow-float` on: floating dock, copy feedback toast, revenue chart tooltip, dialog content
- `bg-surface-secondary` on PDF viewer panel outer container
- `bg-surface-tint` on expandable section content body
- Confidence heatmap: title and tier subheadings changed to `text-foreground` (black) instead of muted/colored

**Verification:**
- `grep -r "dark:" frontend/src/` returns 0 results
- No `.dark` class on `<html>`, no `theme` key in localStorage
- Build succeeds cleanly (`tsc -b && vite build`)
- Visually verified in Chrome: warm off-white canvas, white cards with soft shadows, PDF panel with secondary surface background

**Decisions made:**
- Kept `useTheme()` hook as a cleanup stub rather than deleting entirely, to gracefully handle users with stale `.dark` class/localStorage from prior sessions
- All radius tokens set to the same value (0.375rem) for uniform 6px corners everywhere
- Two shadow tiers only: `shadow-card` (subtle) for cards, `shadow-float` (stronger) for overlays

### Feb 22, 2026 — Permanent PDF Viewer Fix (Third Occurrence)

**Problem:** PDF preview panel repeatedly shows "PDF unavailable / The source file may have expired." This is the third occurrence across redesigns. Prior fixes (stale bundles, worker URLs) addressed symptoms but not the architectural gap.

**Root causes (three compounding issues):**
1. **Stale pdfId from localStorage**: `handleSelectContract` restored `pdf_id` from localStorage, but the actual PDF file at `uploads/<uuid>.pdf` may have been deleted (server restart, Railway redeploy). The viewer blindly fetched `/pdf/<uuid>`, got 404, retried once (same 404), and showed generic "PDF unavailable"
2. **No pre-flight validation**: `PDFViewerPanel.loadPdf()` went straight to `pdfjsLib.getDocument()` without checking if the file existed. Retry logic didn't distinguish between permanent 404 (file deleted) and transient network errors
3. **State management gaps**: `setPdfId` was conditional (`if (result.pdf_id)`) leaving stale values; `handleStop` and `processFile` didn't clear pdfId; `handleSelectContract` didn't include `pdf_id` in the ContractResult object

**Fix:**
- Added `/pdf/<id>/check` endpoint to `app.py` — lightweight existence check (JSON + status code, no file download)
- Rewrote `PDFViewerPanel` with discriminated `PdfStatus` union type (`idle | checking | loading | ready | not_found | load_error`), pre-flight check before pdfjs load, AbortController cleanup, differentiated error states (permanent "expired" vs transient "retry"), spinner instead of plain text loading
- Added `onPdfUnavailable` callback — when PDF is permanently gone, parent clears pdfId and layout collapses from 50/50 split to full-width review (extracted data works without PDF)
- Fixed `App.tsx` state management: `setPdfId(result.pdf_id ?? null)` (never conditional), clear pdfId/scrollToPage in `processFile` and `handleStop`, include `pdf_id` in ContractResult object in `handleSelectContract`
- Tightened `pdf_id` type from optional (`pdf_id?: string | null`) to required (`pdf_id: string | null`) on both `ContractResult` and `ContractRecord` — TypeScript enforces explicit handling
- Rebuilt frontend bundle

**Why this won't regress again:**
- Pre-flight check distinguishes "file gone" from "network error" — no more blind retries on permanent failures
- `onPdfUnavailable` callback creates a feedback loop: viewer tells parent, parent clears state, layout degrades gracefully
- Required `pdf_id` type means TypeScript catches any future code path that forgets to set it
- AbortController prevents state updates on unmounted components during navigation

### Feb 23, 2026 — Resizable Sidebar

**Feature:** Draggable sidebar resize handle with localStorage persistence.

**Changes:**
- Created `frontend/src/hooks/use-sidebar-resize.ts` — custom hook for drag-to-resize (default 288px, min 200px, max 480px, persists to `localStorage` key `sidebarWidth`)
- Modified `frontend/src/components/ui/sidebar.tsx` — integrated dynamic width via `--sidebar-width` CSS variable, added `SidebarResizeHandle` component with `col-resize` cursor, removed width transition for smooth drag

### Feb 23, 2026 — Extraction Pipeline 50% Stall Fix

**Problem:** New PDF uploads stall at exactly 50% progress and never complete. Previously-processed documents work fine (SHA-256 cache returns instantly).

**Root cause:** Gunicorn's default `sync` worker buffers entire SSE generator output. The frontend reads from a `ReadableStream` that never receives data while gunicorn holds all SSE events in memory.

**Fix:**
- Switched gunicorn to `gevent` worker class for real-time SSE streaming (`Procfile`, `railway.json`)
- Added `httpx.Timeout(120.0, connect=10.0)` to Anthropic client (down from 600s default)
- Wrapped Flask generator with `stream_with_context()`
- Added structured error handling: catches `anthropic.APIStatusError`, `APIConnectionError`, `httpx.TimeoutException` separately
- Added non-streaming fallback if streaming produces no output
- Replaced all `print()` with structured `logging` in `app.py` and `pdf_processor.py`
- Added OCR page limit (20 pages) to prevent OOM on large scanned docs
- Added 90s client-side inactivity timeout via `Promise.race` in SSE reader loop
- Added `'error'` status to `ProcessingStep` with red indicator UI

### Feb 23, 2026 — Railway Build Failure (Nixpacks vs Railpack)

**Problem:** Railway builds failed repeatedly with gevent compilation error on Python 3.13. Multiple fix attempts (bumping gevent version, recreating `nixpacks.toml`) had no effect.

**Root cause:** Railway migrated from Nixpacks to Railpack (commit `c5bc670`). That commit explicitly deleted `nixpacks.toml` because Railpack ignores it. Subsequent fix attempts recreated `nixpacks.toml` — which was silently ignored. The `railway.json` only had a `deploy.startCommand` (no build config), and no Python version was pinned anywhere Railpack could read it. Railpack defaulted to Python 3.13.2, which cannot compile gevent's C extensions.

**Fix:**
- Created `.python-version` with `3.12` (Railpack's second-priority version detection mechanism)
- Deleted `nixpacks.toml` (misleading, ignored by Railpack)
- Updated `CLAUDE.md` to document Railpack as the builder and `.python-version` as the version pin

**Key lesson:** Always verify which build system is active before adding configuration files. `nixpacks.toml` and `railway.json` serve different builders.

---

## Next Session Priorities

1. Consider Railway persistent storage if PDF viewing across deploys is needed
2. CLAUDE.md Design System section still references some stale values from prior dark-mode era in the UX Flow section (badge colors like `#4ADE80` etc.) — these describe dark-mode colors that no longer apply but are in prose descriptions, not `:root` vars. Low priority cosmetic cleanup
3. Continue building features on a stable, verified base
