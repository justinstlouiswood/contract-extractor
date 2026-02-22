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
- **Deployment**: Railway with nixpacks (Node.js build + Python runtime)

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

**Dark-mode Novisto-inspired. Georgia serif. 6px rounded rectangles.**

### Typography

- **Global typeface**: `Georgia, 'Times New Roman', Times, serif` applied to `html, body` via `globals.css`
- **Data values**: Regular weight, no monospace. Use `tabular-nums` for numeric alignment
- **Monospace exceptions** (keep `font-mono`): extracted text `<pre>` blocks, Spreadsheet ID input, Gmail email display
- **Sizes**: 28px stat card values, 22px page title, 13px body/labels, 12px/11px captions

### Color System

Dark-only mode. Background `oklch(0.19 0.003 75)`, card `oklch(0.22 0.003 75)`.

**Semantic status tokens** (5 tiers x 3 roles):

| Tier | Background | Ring | Text |
|------|-----------|------|------|
| Success | `oklch(0.30 0.04 155)` | `oklch(0.40 0.06 155)` | `oklch(0.72 0.10 155)` |
| Warning | `oklch(0.30 0.04 85)` | `oklch(0.40 0.06 85)` | `oklch(0.78 0.10 85)` |
| Danger | `oklch(0.28 0.04 25)` | `oklch(0.38 0.06 25)` | `oklch(0.72 0.12 25)` |
| Info | `oklch(0.28 0.04 250)` | `oklch(0.38 0.06 250)` | `oklch(0.72 0.10 250)` |
| Neutral | `oklch(0.25 0.003 75)` | `oklch(0.35 0.003 75)` | `oklch(0.60 0.003 75)` |

**Chart accent colors**: Moss `oklch(0.50 0.08 155)`, Sage `oklch(0.65 0.06 155)`

**Hardcoded badge colors**:

| Badge | Text | Background | Border |
|-------|------|------------|--------|
| Extracted | `#4ADE80` | `#0D1F14` | `#1F5C32` |
| Review | `#F87171` | `#1F0D0D` | `#7F1D1D` |

**Source tag colors** (in `getTagColor()`):

| Tag | Background | Text |
|-----|-----------|------|
| EXPLICIT | `#0D1F14` | `#4ADE80` |
| INFERRED | `#1A1708` | `#FACC15` |
| NOT_FOUND | `#1C1C22` | `#9494A8` |
| PARTIAL | semantic `warning-bg` | semantic `warning-text` |
| MULTIPLE | semantic `neutral-bg` | semantic `neutral-text` |

### Shape

- **Border radius**: `--radius: 0.4375rem` (7px base). Most elements use `rounded-sm` (6px) or `rounded-md`
- **No pills**: All badges, tags, and chips use `rounded-md` (6px). Never `rounded-full` except for timeline dots and the toggle switch knob
- **Cards**: `rounded-xl` on the PDF viewer panel card, standard on others

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
| `frontend/src/hooks/use-theme.ts` | Dark mode (adds `.dark` class to `<html>`) |
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
| `nixpacks.toml` | Railway build config (Node.js + Python) |
| `agent.md` | Extraction agent behavior specification |

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Serve main page |
| `/upload` | POST | Upload PDF, extract text, analyze with Claude, return structured JSON |
| `/upload-stream` | POST | SSE streaming version of upload with step-by-step progress |
| `/cancel/<job_id>` | POST | Cancel an active extraction job |
| `/send-email` | POST | Send email via Gmail OAuth |
| `/send-slack` | POST | Post Block Kit message to Slack via incoming webhook |
| `/push-to-sheets` | POST | Append row to Google Sheet |
| `/pdf/<id>` | GET | Serve uploaded PDF for viewer |
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

| Tier | Score | Color | Label |
|------|-------|-------|-------|
| High Confidence | >= 85 | Green (`#4ADE80`) | High |
| Needs Review | < 85 | Red (`#F87171`) | Review |

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
- **Build**: nixpacks runs `cd frontend && npm install && npm run build` then `pip install`
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
- Georgia serif for all text; `font-mono` only for raw extracted text, sheet IDs, email addresses
- Bar chart corners: rounded on top only (3px), square on bottom
- All buttons use shadcn Button (outline or ghost variants for secondary actions)
- 6px rounded rectangles on all badges, tags, chips. No pills
- Dark-only mode. No theme toggle
- All styling via Tailwind utility classes
- `tabular-nums` on all numeric data for alignment

---

## PDF Storage Architecture

- PDFs stored on disk at `uploads/<uuid>.pdf` via the `/upload` endpoint
- Served to the frontend via `/pdf/<id>` Flask endpoint (`send_file`)
- `pdfId` (UUID string) passed from `App.tsx` to `PDFViewerPanel` as a prop
- `PDFViewerPanel` loads via `pdfjsLib.getDocument('/pdf/<id>')`
- pdfjs-dist Web Worker requires `base: '/static/dist/'` in `vite.config.ts` so the worker URL resolves correctly under Flask's static file serving
- Frontend bundle in `static/dist/` is committed to git and must be rebuilt (`cd frontend && npm run build`) before committing any frontend source changes

---

## Known Issues / Technical Debt

- `/upload-stream` SSE endpoint does NOT save PDFs to disk and does NOT return `pdf_id` in its response. It is currently unused by the frontend (`App.tsx` uses `/upload` instead), but is a latent bug if reactivated. Either bring it to parity with `/upload` or remove it
- Railway ephemeral filesystem means `uploads/` PDFs do not persist across deploys. Acceptable for single-session use, but if PDFs need to survive deploys, consider Railway Volumes or external storage
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

**Cleanup (commit after `fb4de22`):**
- Removed unused `import threading` from `app.py`
- Updated `CLAUDE.md` with architecture docs, known issues, and session log

---

## Next Session Priorities

1. Decide whether `/upload-stream` should be brought to parity with `/upload` (add `pdf_id` + disk storage) or removed entirely
2. Consider Railway persistent storage if PDF viewing across deploys is needed
3. Continue building features on a stable, verified base
