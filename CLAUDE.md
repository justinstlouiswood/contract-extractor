# MSA Extraction Machine

A web app that extracts key information from SaaS contract PDFs using AI.

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: React via CDN (no build step)
- **AI**: Anthropic Claude API for contract analysis
- **Email**: Gmail OAuth2 integration
- **PDF Processing**: PyMuPDF, PyPDF2, pdf2image, pytesseract
- **PDF Viewing**: PDF.js via CDN
- **Deployment**: Railway with nixpacks (for poppler + tesseract system deps)

## Design System

"Natural Tone" - warm, organic aesthetic with sage green accents.

- Light/dark mode toggle
- Accent color: Sage green (`#5C8D73` light, `#6AA386` dark)
- Fonts: Inter for UI, JetBrains Mono for code/data, Neue Haas Grotesk for main title
- Soft shadows, rounded corners (6-10px)
- Custom favicon: `static/favicon.jpg`

## Key Files

| File | Purpose |
|------|---------|
| `app.py` | Flask server, all API routes |
| `static/script.js` | All React components |
| `static/style.css` | All styling (CSS variables) |
| `email_service.py` | Gmail OAuth2 integration |
| `pdf_processor.py` | PDF text extraction |
| `.env` | API keys (never commit) |
| `nixpacks.toml` | Railway build config for system deps |
| `static/favicon.jpg` | Browser tab icon |

## Running Locally

```bash
cd contract-extractor
python3 app.py
# Opens at http://localhost:5001
```

## Deployment

- **Live URL**: https://msa-extraction-machine.up.railway.app/
- **Platform**: Railway (auto-deploys from git push)
- **Required Railway variables**: ANTHROPIC_API_KEY
- Push to `origin` (personal) and `work` (company) remotes

## Troubleshooting

- If port 5001 is busy: `lsof -ti:5001 | xargs kill -9`
- If modules missing: `pip3 install -r requirements.txt`
- Server must restart to pick up new .env values

## Environment Variables

```
ANTHROPIC_API_KEY=your-key
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
```

## Style Preferences

- No emojis in code or UI
- Bar chart corners: rounded on TOP only (4px), square on bottom
- Monospace font for extracted contract data
- Copy buttons use secondary button style
- New sections must match extracted-section styling (1px border, shadow-sm, btn-secondary)
- Consistent spacing: all major sections use margin-bottom: var(--space-xl)

## Component Order (Results View)

1. Total Contract Value tile
2. Info tiles (Customer, Vendor, Term, etc.)
3. Revenue Overview chart
4. Full Extracted Details section
5. Send Email section (at bottom)
6. PDF Viewer panel (right side, when PDF exists)

## PDF Viewer

Persistent 50/50 split layout displays uploaded PDF alongside extraction results.

- **Backend**: PDFs stored with UUID in `uploads/`, served via `/pdf/<pdf_id>`
- **Layout**: 50% extraction results | 50% PDF (side-by-side)
- **Rendering**: Continuous scroll with all pages visible
- **Controls**: Zoom only (no page navigation needed)
- **Responsive**: Stacks vertically below 1200px viewport width
- **Max width**: Container expanded to 1800px to accommodate split view

## Source Tags

Extracted text includes source tags indicating data provenance.

- **Tag colors**: MULTIPLE (dark green `#4a7c59`) > EXPLICIT (muted green) > INFERRED (muted red)
- **Tooltip**: "?" icon next to "Full Extracted Details" opens help modal
- **Clean toggle**: Button to hide/show source tags for cleaner view

## Current State

- Deployed and live on Railway
- Gmail OAuth2 configured locally (credentials in .env)
- Gmail OAuth flow not yet tested end-to-end
- Email section styled to match other sections
- Bar charts have rounded top corners
- Custom favicon added
- Homepage title: "MSA Extraction Machine" (Neue Haas Grotesk font)
- PDF viewer with persistent 50/50 split layout
- Source tags with tooltip help modal and clean toggle
