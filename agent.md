# MSA Extraction Agent — Behavior Specification

This document defines how the Claude extraction agent parses MSA order forms, assigns confidence, labels clauses, derives payment terms, generates summaries, and respects the verification flow.

---

## 1. Extraction Pipeline

### 1.1 Input

The agent receives the full text of a PDF, pre-processed by `pdf_processor.py` with `--- Page N ---` markers inserted between each page boundary. The text may contain OCR artifacts, crossed-out pricing, and multi-column layouts.

### 1.2 Model and Parameters

- **Model**: `claude-sonnet-4-20250514`
- **Max tokens**: 4096
- **Temperature**: Default (deterministic extraction)
- **Single-turn**: One user message containing the full prompt + contract text

### 1.3 Prompt Structure

The prompt instructs Claude to act as a contract extraction specialist and output data in a precise numbered-section format. The full prompt is defined in `app.py` function `extract_contract_info()`.

Key prompt rules:
- Extract ONLY the fields specified in the template — nothing more, nothing less
- For pricing: ONLY extract amounts that are NOT crossed out or struck through
- Always include both currency symbol ($) AND currency code (e.g., CAD, USD)
- If a field is not found or is blank, write "Not specified"
- Copy footnotes VERBATIM — do not summarize
- Include extraction signal with page reference before every value

---

## 2. Extraction Signals

Every extracted field value must be prefixed with a signal tag indicating provenance. Format: `[SIGNAL:PAGE_NUM]` or `[SIGNAL:PAGE1,PAGE2]` for multi-page references.

### Signal Types

| Signal | Meaning | Confidence Weight |
|--------|---------|-------------------|
| `EXPLICIT` | Value found exactly as labeled in the document | 50/50 |
| `INFERRED` | Value derived from surrounding context, not directly labeled | 35/50 |
| `PARTIAL` | Only some of the expected information was found | 25/50 |
| `MULTIPLE` | Multiple conflicting values found; the most recent/prominent is used | 30/50 |
| `NOT_FOUND` | Field not present in the document; value set to "Not specified" | 0/50 |

### Page Reference Rules

- Page numbers correspond to the `--- Page N ---` markers in the input text
- For `NOT_FOUND` signals, use page `0`: `[NOT_FOUND:0]`
- For values spanning multiple pages, list all: `[INFERRED:2,3]`
- Always place the signal BEFORE the value on the same line

---

## 3. Extracted Fields

### Section 1: Contact Information

```
1.1 Customer Legal Name    The customer or company legal name
1.2 Point of Contact       Name <email>
1.3 Billing Contact        Name <email>
```

- Email is enclosed in angle brackets: `John Smith <john@example.com>`
- If email is not found: `John Smith <Not specified>`

### Section 2: Services & Modules

```
2.1 Included Modules       Bulleted list of each module/service
```

- One module per line with bullet prefix
- This section is displayed in raw extracted text only (not parsed into structured fields)

### Section 3: Contract Terms & Fees

```
3.1 Subscription Period
    Start Date              Date in "Month DD, YYYY" format preferred
    End Date                Date in "Month DD, YYYY" format preferred
    Duration                Calculated total (e.g., "3 years")

3.2 Annual Software Fees
    Year 1                  $amount CURRENCY
    Year 2                  $amount CURRENCY
    Year N                  Continue for all years in the contract

3.3 Onboarding Services
    Payment Terms           Net payment window only (see rules below)
    One-Time Fee            $amount CURRENCY

3.4 Notes & Conditions     Copy footnotes VERBATIM
```

### Section 4: Additional Terms

```
This Order Form is entered into pursuant to the Master Service Agreement dated [DATE].
```

- ONLY output the MSA reference date — nothing else in this section

### Section 5: Signatures

```
5.1 Customer    [SIGNAL:PAGE] Name, Title — Signed: Date
5.2 Vendor      [SIGNAL:PAGE] Name, Title — Signed: Date
```

### Section 6: Key Clauses

```
6.1 Auto-Renewal                YES/NO — brief description
6.2 Termination for Convenience YES/NO — brief description
6.3 SLA Guarantee               YES/NO — brief description
6.4 Liability Cap               YES/NO — brief description
6.5 Data Processing / DPA       YES/NO — brief description
6.6 Price Escalation            YES/NO — brief description
6.7 Exclusivity                 YES/NO — brief description
6.8 Indemnification             YES/NO — brief description
```

- If a clause is present (YES), include a brief description (e.g., "Renews annually unless 90-day notice")
- If absent (NO), no description needed

---

## 4. Payment Terms Detection Rules

Payment terms extraction is deliberately narrow. The agent must:

1. **Only extract the net payment window** — the number of days for invoice payment
2. **Look for "net" followed by a number** in phrases like:
   - "payable net 30 of the reception of an invoice"
   - "payment terms: net 60 days"
   - "invoices are due net 30"
3. **Normalize output** to exactly `Net [number]` — e.g., `Net 30`, `Net 60`, `Net 90`
4. **DO NOT populate with**:
   - Billing trigger language ("invoiced on signing date")
   - Payment method descriptions ("due upon receipt")
   - Any text that is not a net-days window
5. **If no "net [number]" language exists**, output `Not specified`

The backend validates this with a regex: `re.search(r'[Nn]et\s+(\d+)', value)`. Any value not matching this pattern is discarded.

---

## 5. Confidence Scoring

Confidence is computed server-side in `app.py` (`calculate_confidence()`), not by Claude. The agent's role is to provide accurate signals; the backend scores them.

### Score Calculation (0-100)

```
confidence = signal_strength (0-50) + format_score (0-25) + consistency_score (0-25)
```

**Signal strength**: See Section 2 table above.

**Format score**: Backend checks if extracted values match expected regex patterns:
- Dates: `Month DD, YYYY` or `MM/DD/YYYY` format
- Duration: `N year(s)` or `N month(s)`
- Email: standard email pattern
- Currency amounts: `$N,NNN.NN`
- Payment terms: `Net NN`
- Full match = 25 pts, partial = 12 pts, present but no pattern = 20 pts

**Consistency score**: Backend checks cross-field agreement:
- Duration should be consistent with start/end date span
- TCV should equal sum(annual_fees) + onboarding_fee
- Both start and end dates should be present together

### Special Cases

- `total_contract_value` is always signal `INFERRED` (it's calculated, not extracted)
- Fields with value "Not specified" or `null` receive no confidence score (excluded from UI)
- Annual fees use the most common signal across all year entries

---

## 6. UI Display Tiers

The frontend groups fields into two confidence tiers:

| Tier | Threshold | UI Color | Label |
|------|-----------|----------|-------|
| High Confidence | score >= 85 | Green `#4ADE80` | "High Confidence" |
| Needs Review | score < 85 | Red `#F87171` | "Needs Review" |

Fields scoring below 85 also receive a "Review" badge (red, `rounded-md`) next to their label in the field table.

---

## 7. Clause Detection and Display

### Agent Output

For each of the 8 clause types, the agent outputs:
- `YES` or `NO` indicating presence
- A brief description (for YES clauses only)
- Extraction signal and page reference

### Frontend Display

Clauses appear as tag chips in the Signatures & Terms section:

- **Present clauses**: Green `+` prefix, green-tinted background (`border-moss/30 bg-moss/15 text-moss`)
- **Absent clauses**: Red minus prefix, transparent background with muted text
- **Detection count**: Bordered badge showing "N of 8 detected"

### Clause Labels (UI mapping)

```
auto_renewal              -> "Auto-Renewal"
termination_convenience   -> "Termination"
sla_guarantee             -> "SLA"
liability_cap             -> "Liability Cap"
data_processing           -> "DPA"
price_escalation          -> "Escalation"
exclusivity               -> "Exclusivity"
indemnification           -> "Indemnification"
```

---

## 8. Verification Flow

### Category-Based Verification

The review workspace requires users to verify extracted data before distribution. Fields are grouped into three categories:

| Category | UI Section | Fields |
|----------|-----------|--------|
| `contract_details` | Contract Details | customer_name, duration, subscription_start, subscription_end, point_of_contact_name, point_of_contact_email, billing_contact_name, billing_contact_email |
| `fees_revenue` | Fees & Revenue | onboarding_fee, payment_terms, annual_fee_year_1, annual_fee_year_2, ... |
| `signatures` | Signatures & Terms | signature_customer, signature_vendor, notes, additional_terms |

### Verification Rules

1. Each category has a verify checkbox in its `ExpandableSection` header
2. Users can toggle individual categories or use "Mark All Verified" for bulk verification
3. The `VerificationProgress` bar shows `N of 3 verified` with a percentage bar
4. Distribution buttons (Copy, Email, Slack, Sheet) are locked behind a bordered button reading "Verify N of 3 categories to unlock"
5. All three categories must be verified to unlock distribution
6. No data leaves the tool (clipboard, email, Slack, Sheets) until verification is complete

### Inline Editing

Users can edit any extracted field value directly in the table:
- Click the pencil icon to enter edit mode
- Save or cancel with keyboard (Enter/Escape) or buttons
- Edited fields show an "Edited" badge (info-colored, `rounded-md`)
- Edited values are used in all exports and distribution outputs

---

## 9. Summary Generation

### Clipboard Summary (Copy action)

Generated by `buildClipboardSummary()` in `contract-utils.ts`. Plain text format:

```
Contract Summary: [Customer Name]

Total Contract Value: $XXX,XXX CAD
Duration: 3 years
Start: January 1, 2024
End: December 31, 2026
Contact: John Smith (john@example.com)

Year 1: $50,000 CAD
Year 2: $55,000 CAD
Year 3: $60,000 CAD
Onboarding: $10,000 CAD
```

Respects edited field values.

### Slack Summary (Block Kit)

Generated by the `/send-slack` endpoint. Structured as Slack Block Kit blocks:
- Header block: "Contract Extracted: [Customer]"
- Section with fields: Total Value, Duration, Period, Contact
- Section: Annual Fees (one line per year)
- Context: Onboarding fee

### Email Summary

Composed by the user in the Email panel. The tool pre-populates subject and body with extracted data. Sent via Gmail OAuth.

### Structured Exports

Three export formats via `contract-utils.ts`:
- **CSV**: Category / Field / Value columns
- **JSON**: Nested object with contractDetails and termsAndFees
- **Excel**: Same structure as CSV, generated with SheetJS

All exports respect edited field values and include the customer name in the filename.

---

## 10. Source Tag System

### Raw Extracted Text

The full Claude output is stored as `extracted_info` and displayed in the "Full Extracted Text" section. Tags appear inline in the text.

### Tag Display

- Tags are parsed by `parseExtractedText()` using regex: `\[(EXPLICIT|INFERRED|PARTIAL|MULTIPLE|NOT_FOUND)(?::\d+(?:,\d+)*)?\]`
- Each tag renders as an inline badge with `rounded-md` shape and `text-[13px]` size
- Colors are defined in `getTagColor()` (see CLAUDE.md color table)
- The "Cleaned View" toggle switch hides all tags, showing only the extracted text content
- Toggle: custom inline switch (not shadcn). Active = `bg-foreground`, inactive = `bg-muted`. Knob slides with `translate-x-4`

### Tag Stripping

`stripSourceTags()` removes all tag markup including trailing whitespace for clean display.

---

## 11. Target User Roles

### Customer Success

Primary users. Use the tool to:
- Extract contract details from new MSA order forms
- Verify customer name, contact info, and contract dates
- Copy summaries to Slack for team visibility
- Track contract history via the homepage table

### Finance

Use the tool to:
- Verify annual fees, onboarding fees, and payment terms
- Review TCV calculations against source document
- Export structured data to Google Sheets for financial modeling
- Check fee escalation patterns via the revenue chart

### Legal

Use the tool to:
- Review key clause detection (auto-renewal, termination, SLA, liability, DPA)
- Verify signature dates and signatory information
- Check additional terms and MSA reference dates
- Cross-reference extracted data against the source PDF

---

## 12. Error Handling

### Extraction Failures

- If PDF text extraction yields < 100 characters, the upload is rejected with an error message
- Claude API errors are caught and returned as `{ error: "Claude API error: ..." }`
- Generic processing errors are caught and surfaced in the UI error banner

### Parsing Failures

- If `parse_extracted_data()` throws, the raw `extracted_info` text is still returned
- Confidence scores default to an empty object `{}` on calculation failure
- Missing fields default to `null` or `"Not specified"` — the UI handles both gracefully with em-dash placeholders

### Cancellation

- The processing view supports cancellation via AbortController
- The SSE streaming endpoint checks `active_jobs[job_id]['cancelled']` between steps
- Cancelling returns the user to the homepage with no side effects
