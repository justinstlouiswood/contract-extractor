"""
Contract Extractor - Main Application (V3)

Features:
- PDF upload and text extraction
- AI-powered contract analysis via Claude
- Structured JSON output with confidence scoring
- Gmail OAuth2 email + Google Sheets integration
- Slack incoming webhook integration
"""

import os
import re
import uuid
import hashlib
import requests as http_requests
from pathlib import Path
import json as json_module
from flask import Flask, request, jsonify, render_template, session, url_for, send_file, Response
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import anthropic
from pdf_processor import extract_text_from_pdf
import email_service

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path, override=True)

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.secret_key = os.environ.get('FLASK_SECRET_KEY', os.urandom(24))
ALLOWED_EXTENSIONS = {'pdf'}

# Initialize the Anthropic client
client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# In-memory extraction cache: SHA-256 file hash -> result dict
_extraction_cache: dict[str, dict] = {}
_EXTRACTION_CACHE_MAX = 50


def allowed_file(filename):
    """Check if the uploaded file has a .pdf extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_signal(text):
    """
    Extract the signal tag and page references from a value string.
    Returns (signal, pages, clean_value) tuple.
    Format: [SIGNAL:page1,page2] value  OR  [SIGNAL] value (legacy)
    """
    # New format: [SIGNAL:page_nums]
    signal_match = re.match(r'\[(\w+):?([\d,]*)\]\s*(.*)$', text.strip())
    if signal_match:
        signal = signal_match.group(1).upper()
        page_str = signal_match.group(2)
        pages = [int(p) for p in page_str.split(',') if p] if page_str else []
        return signal, pages, signal_match.group(3).strip()
    return 'EXPLICIT', [], text.strip()  # Default to EXPLICIT if no signal found


def parse_extracted_data(extracted_text):
    """
    Parse the extracted text into structured JSON for the frontend.
    This enables charting and structured display.
    Now includes confidence scoring based on extraction signals.
    """
    data = {
        'customer_name': None,
        'point_of_contact': {'name': None, 'email': None},
        'billing_contact': {'name': None, 'email': None},
        'subscription_start': None,
        'subscription_end': None,
        'duration': None,
        'annual_fees': [],
        'onboarding_fee': None,
        'payment_terms': None,
        'currency': 'CAD',
        'total_contract_value': 0,
        'notes': None,
        'additional_terms': None,
        'signatures': {
            'customer': {'name': None, 'title': None, 'date': None},
            'vendor': {'name': None, 'title': None, 'date': None}
        },
        'clauses': {},
        'raw_text': extracted_text,
        'page_refs': {}
    }

    # Track extraction signals for confidence calculation
    signals = {}

    try:
        # Extract customer name (with signal)
        customer_match = re.search(r'1\.1 Customer Legal Name:\s*(.+?)(?:\n|$)', extracted_text)
        if customer_match:
            signal, pages, value = extract_signal(customer_match.group(1))
            signals['customer_name'] = signal
            data['page_refs']['customer_name'] = pages
            data['customer_name'] = value

        # Extract point of contact (with signal)
        poc_match = re.search(r'1\.2 Point of Contact:\s*(.+?)(?:\n|$)', extracted_text)
        if poc_match:
            signal, pages, poc_text = extract_signal(poc_match.group(1))
            signals['point_of_contact'] = signal
            data['page_refs']['point_of_contact'] = pages
            email_match = re.search(r'<([^>]+)>', poc_text)
            if email_match:
                data['point_of_contact']['email'] = email_match.group(1)
                data['point_of_contact']['name'] = poc_text.replace(f'<{email_match.group(1)}>', '').strip()
            else:
                data['point_of_contact']['name'] = poc_text

        # Extract billing contact (with signal)
        billing_match = re.search(r'1\.3 Billing Contact:\s*(.+?)(?:\n|$)', extracted_text)
        if billing_match:
            signal, pages, billing_text = extract_signal(billing_match.group(1))
            signals['billing_contact'] = signal
            data['page_refs']['billing_contact'] = pages
            email_match = re.search(r'<([^>]+)>', billing_text)
            if email_match:
                data['billing_contact']['email'] = email_match.group(1)
                data['billing_contact']['name'] = billing_text.replace(f'<{email_match.group(1)}>', '').strip()
            else:
                data['billing_contact']['name'] = billing_text

        # Extract subscription dates (with signals)
        start_match = re.search(r'Start Date:\s*(.+?)(?:\n|$)', extracted_text)
        if start_match:
            signal, pages, value = extract_signal(start_match.group(1))
            signals['subscription_start'] = signal
            data['page_refs']['subscription_start'] = pages
            data['subscription_start'] = value

        end_match = re.search(r'End Date:\s*(.+?)(?:\n|$)', extracted_text)
        if end_match:
            signal, pages, value = extract_signal(end_match.group(1))
            signals['subscription_end'] = signal
            data['page_refs']['subscription_end'] = pages
            data['subscription_end'] = value

        duration_match = re.search(r'Duration:\s*(.+?)(?:\n|$)', extracted_text)
        if duration_match:
            signal, pages, value = extract_signal(duration_match.group(1))
            signals['duration'] = signal
            data['page_refs']['duration'] = pages
            data['duration'] = value

        # Extract annual fees (Year 1, Year 2, etc.) - with signal detection
        # Pattern: Year 1: [SIGNAL:pages] $amount CURRENCY
        year_pattern = re.compile(r'Year\s*(\d+):\s*(?:\[(\w+):?([\d,]*)\])?\s*\$?([\d,]+(?:\.\d{2})?)\s*(\w+)?', re.IGNORECASE)
        annual_fee_signals = []
        annual_fee_pages = []
        for match in year_pattern.finditer(extracted_text):
            year_num = int(match.group(1))
            signal = match.group(2).upper() if match.group(2) else 'EXPLICIT'
            page_str = match.group(3) or ''
            pages = [int(p) for p in page_str.split(',') if p] if page_str else []
            annual_fee_signals.append(signal)
            annual_fee_pages.extend(pages)
            amount_str = match.group(4).replace(',', '')
            amount = float(amount_str)
            currency = match.group(5) if match.group(5) else 'CAD'
            data['annual_fees'].append({
                'year': year_num,
                'amount': amount,
                'currency': currency
            })
            data['currency'] = currency
            data['page_refs'][f'annual_fee_year_{year_num}'] = pages

        # Use most common signal for annual fees
        if annual_fee_signals:
            signals['annual_fees'] = max(set(annual_fee_signals), key=annual_fee_signals.count)
        if annual_fee_pages:
            data['page_refs']['annual_fees'] = list(set(annual_fee_pages))

        # Sort annual fees by year
        data['annual_fees'].sort(key=lambda x: x['year'])

        # Extract onboarding fee (with signal)
        onboarding_match = re.search(r'One-Time Fee:\s*(?:\[(\w+):?([\d,]*)\])?\s*\$?([\d,]+(?:\.\d{2})?)\s*(\w+)?', extracted_text)
        if onboarding_match:
            signals['onboarding_fee'] = onboarding_match.group(1).upper() if onboarding_match.group(1) else 'EXPLICIT'
            page_str = onboarding_match.group(2) or ''
            data['page_refs']['onboarding_fee'] = [int(p) for p in page_str.split(',') if p] if page_str else []
            amount_str = onboarding_match.group(3).replace(',', '')
            data['onboarding_fee'] = float(amount_str)

        # Extract payment terms — only the net payment window (e.g., "Net 30")
        terms_match = re.search(r'Payment Terms:\s*(.+?)(?:\n|$)', extracted_text)
        if terms_match:
            signal, pages, value = extract_signal(terms_match.group(1))
            # Validate: only keep if it matches "Net [number]" pattern
            net_match = re.search(r'[Nn]et\s+(\d+)', value)
            if net_match and value.lower() not in ['not specified', '']:
                normalized = f"Net {net_match.group(1)}"
                signals['payment_terms'] = signal
                data['page_refs']['payment_terms'] = pages
                data['payment_terms'] = normalized

        # Calculate total contract value
        total = sum(fee['amount'] for fee in data['annual_fees'])
        if data['onboarding_fee']:
            total += data['onboarding_fee']
        data['total_contract_value'] = total

        # Extract notes section
        notes_match = re.search(r'3\.4 Notes & Conditions\s*\n(.*?)(?=\n4\.|$)', extracted_text, re.DOTALL)
        if notes_match:
            data['notes'] = notes_match.group(1).strip()

        # Extract additional terms (simplified format - just MSA date reference)
        terms_section = re.search(r'4\. ADDITIONAL TERMS\s*\n(.*?)(?=\n5\.|$)', extracted_text, re.DOTALL)
        if terms_section:
            data['additional_terms'] = terms_section.group(1).strip()

        # Extract signatures (with signals)
        customer_sig = re.search(r'5\.1 Customer:\s*(?:\[(\w+):?([\d,]*)\])?\s*([^,]+),\s*([^—]+)—\s*Signed:\s*(.+?)(?:\n|$)', extracted_text)
        if customer_sig:
            signals['signature_customer'] = customer_sig.group(1).upper() if customer_sig.group(1) else 'EXPLICIT'
            page_str = customer_sig.group(2) or ''
            data['page_refs']['signature_customer'] = [int(p) for p in page_str.split(',') if p] if page_str else []
            data['signatures']['customer'] = {
                'name': customer_sig.group(3).strip(),
                'title': customer_sig.group(4).strip(),
                'date': customer_sig.group(5).strip()
            }

        vendor_sig = re.search(r'5\.2 Vendor:\s*(?:\[(\w+):?([\d,]*)\])?\s*([^,]+),\s*([^—]+)—\s*Signed:\s*(.+?)(?:\n|$)', extracted_text)
        if vendor_sig:
            signals['signature_vendor'] = vendor_sig.group(1).upper() if vendor_sig.group(1) else 'EXPLICIT'
            page_str = vendor_sig.group(2) or ''
            data['page_refs']['signature_vendor'] = [int(p) for p in page_str.split(',') if p] if page_str else []
            data['signatures']['vendor'] = {
                'name': vendor_sig.group(3).strip(),
                'title': vendor_sig.group(4).strip(),
                'date': vendor_sig.group(5).strip()
            }

        # Extract clauses (Section 6)
        clause_types = [
            ('auto_renewal', r'6\.1 Auto-Renewal:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('termination_convenience', r'6\.2 Termination for Convenience:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('sla_guarantee', r'6\.3 SLA Guarantee:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('liability_cap', r'6\.4 Liability Cap:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('data_processing', r'6\.5 Data Processing / DPA:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('price_escalation', r'6\.6 Price Escalation:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('exclusivity', r'6\.7 Exclusivity:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
            ('indemnification', r'6\.8 Indemnification:\s*(?:\[(\w+):?([\d,]*)\])?\s*(YES|NO)\s*(?:—\s*(.+?))?(?:\n|$)'),
        ]

        for clause_key, pattern in clause_types:
            clause_match = re.search(pattern, extracted_text, re.IGNORECASE)
            if clause_match:
                present = clause_match.group(3).upper() == 'YES'
                description = clause_match.group(4).strip() if clause_match.group(4) else None
                signal = clause_match.group(1).upper() if clause_match.group(1) else 'EXPLICIT'
                page_str = clause_match.group(2) or ''
                pages = [int(p) for p in page_str.split(',') if p] if page_str else []

                verbatim = None
                risk = None
                if present:
                    # Search for VERBATIM and RISK lines after the clause match
                    after_text = extracted_text[clause_match.end():]
                    # Limit search window to ~500 chars (before next clause)
                    window = after_text[:500]
                    verb_match = re.search(r'VERBATIM:\s*"?(.+?)"?\s*(?:\n|$)', window)
                    if verb_match:
                        verbatim = verb_match.group(1).strip().strip('"')
                    risk_match = re.search(r'RISK:\s*(STANDARD|FAVORABLE|UNUSUAL)', window, re.IGNORECASE)
                    if risk_match:
                        risk = risk_match.group(1).upper()

                data['clauses'][clause_key] = {
                    'present': present,
                    'description': description,
                    'verbatim': verbatim,
                    'risk': risk,
                }
                signals[f'clause_{clause_key}'] = signal
                data['page_refs'][f'clause_{clause_key}'] = pages

        # Calculate confidence scores for all fields
        data['confidence'] = calculate_all_confidence_scores(data, signals)

    except Exception as e:
        print(f"Error parsing extracted data: {e}")
        # Still return data without confidence if calculation fails
        data['confidence'] = {}

    return data


# ============================================
# CONFIDENCE SCORING FUNCTIONS
# ============================================

def calculate_format_score(field_name, value):
    """
    Check if value matches expected format patterns.
    Returns 0-25 points based on format compliance.
    """
    if value is None or value == "Not specified" or value == "":
        return 0

    value_str = str(value)

    format_patterns = {
        'customer_name': r'^[A-Z][a-zA-Z0-9\s\.\,\&\-\']+$',  # Capitalized company name
        'subscription_start': r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
        'subscription_end': r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
        'duration': r'\d+\s*(year|month|day)s?',
        'email': r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$',
        'currency_amount': r'^\$?[\d,]+(?:\.\d{2})?$',
        'payment_terms': r'^Net\s+\d+$',
    }

    # Map field names to pattern types
    field_to_pattern = {
        'customer_name': 'customer_name',
        'subscription_start': 'subscription_start',
        'subscription_end': 'subscription_end',
        'duration': 'duration',
        'point_of_contact_email': 'email',
        'billing_contact_email': 'email',
        'onboarding_fee': 'currency_amount',
        'annual_fees': 'currency_amount',
        'payment_terms': 'payment_terms',
    }

    pattern_key = field_to_pattern.get(field_name)
    if pattern_key and pattern_key in format_patterns:
        pattern = format_patterns[pattern_key]
        if re.search(pattern, value_str, re.IGNORECASE):
            return 25
        return 12  # Partial credit for non-matching but present

    return 20  # Default score for fields without specific patterns


def calculate_consistency_score(field_name, value, parsed_data):
    """
    Check cross-field consistency.
    Returns 0-25 points based on consistency with related fields.
    """
    if value is None or value == "Not specified" or value == "":
        return 0

    # Duration consistency with dates
    if field_name == 'duration':
        start = parsed_data.get('subscription_start')
        end = parsed_data.get('subscription_end')
        if start and end and start != "Not specified" and end != "Not specified":
            return 25  # Both dates present, assume duration is consistent
        return 15  # Partial if dates missing

    # Start/End date consistency
    if field_name in ['subscription_start', 'subscription_end']:
        other_field = 'subscription_end' if field_name == 'subscription_start' else 'subscription_start'
        other_value = parsed_data.get(other_field)
        if other_value and other_value != "Not specified":
            return 25  # Both dates present
        return 18  # Only one date present

    # Total value consistency with fees
    if field_name == 'total_contract_value':
        fees = parsed_data.get('annual_fees', [])
        onboarding = parsed_data.get('onboarding_fee', 0) or 0
        if fees:
            calculated = sum(f.get('amount', 0) for f in fees) + onboarding
            if abs(calculated - float(value)) < 1:  # Within $1
                return 25
            return 10  # Mismatch
        return 15  # No fees to compare

    # Customer name consistency (appears in title)
    if field_name == 'customer_name':
        return 22  # Usually reliable when extracted

    # Contact fields
    if field_name in ['point_of_contact', 'billing_contact']:
        return 20  # Contact info is usually standalone

    # Signatures
    if field_name.startswith('signature'):
        return 20  # Signature data is usually self-contained

    return 20  # Default consistency score


def calculate_confidence(field_name, value, signal, parsed_data):
    """
    Calculate confidence score for a field (0-100).

    Factors:
    - Field presence (50%): Based on extraction signal from Claude
    - Format matching (25%): Does the value match expected format?
    - Cross-reference (25%): Is the value consistent with related fields?
    """
    if value is None or value == "Not specified" or value == "":
        return None  # Don't show confidence for missing fields

    score = 0

    # Factor 1: Field Presence (50 points max)
    presence_scores = {
        'EXPLICIT': 50,
        'INFERRED': 35,
        'PARTIAL': 25,
        'MULTIPLE': 30,
        'NOT_FOUND': 0
    }
    score += presence_scores.get(signal, 35)  # Default to 35 if signal unclear

    # Factor 2: Format Matching (25 points max)
    score += calculate_format_score(field_name, value)

    # Factor 3: Cross-Reference Consistency (25 points max)
    score += calculate_consistency_score(field_name, value, parsed_data)

    return min(100, max(0, score))


def calculate_all_confidence_scores(parsed_data, signals):
    """
    Calculate confidence scores for all extracted fields.
    Returns a dict of field_name -> confidence score (0-100).
    """
    confidence = {}

    # Simple fields
    simple_fields = [
        'customer_name',
        'subscription_start',
        'subscription_end',
        'duration',
        'onboarding_fee',
        'payment_terms',
    ]

    for field in simple_fields:
        value = parsed_data.get(field)
        signal = signals.get(field, 'EXPLICIT')
        conf = calculate_confidence(field, value, signal, parsed_data)
        if conf is not None:
            confidence[field] = conf

    # Contact fields (nested)
    for contact_type in ['point_of_contact', 'billing_contact']:
        contact = parsed_data.get(contact_type, {})
        if contact.get('name') or contact.get('email'):
            signal = signals.get(contact_type, 'EXPLICIT')
            # Use name for confidence calculation
            value = contact.get('name') or contact.get('email')
            conf = calculate_confidence(contact_type, value, signal, parsed_data)
            if conf is not None:
                confidence[contact_type] = conf

    # Annual fees (aggregate)
    if parsed_data.get('annual_fees'):
        signal = signals.get('annual_fees', 'EXPLICIT')
        # Use first fee amount for format check
        first_fee = parsed_data['annual_fees'][0] if parsed_data['annual_fees'] else None
        if first_fee:
            conf = calculate_confidence('annual_fees', first_fee.get('amount'), signal, parsed_data)
            if conf is not None:
                confidence['annual_fees'] = conf

    # Total contract value (calculated field - always INFERRED)
    if parsed_data.get('total_contract_value'):
        conf = calculate_confidence(
            'total_contract_value',
            parsed_data['total_contract_value'],
            'INFERRED',  # Always inferred since it's calculated
            parsed_data
        )
        if conf is not None:
            confidence['total_contract_value'] = conf

    # Signatures
    for sig_type in ['customer', 'vendor']:
        sig = parsed_data.get('signatures', {}).get(sig_type, {})
        if sig.get('name'):
            signal = signals.get(f'signature_{sig_type}', 'EXPLICIT')
            conf = calculate_confidence(f'signature_{sig_type}', sig.get('name'), signal, parsed_data)
            if conf is not None:
                confidence[f'signature_{sig_type}'] = conf

    return confidence


def build_extraction_prompt(text):
    """Build the Claude extraction prompt. Separated from API call for streaming use."""
    prompt = """You are a contract extraction specialist. Your task is to extract SPECIFIC information from an MSA (Master Service Agreement) Order Form and output it in a precise, structured format.

CRITICAL INSTRUCTIONS:
1. Extract ONLY the fields specified below - nothing more, nothing less
2. For pricing/fees: ONLY extract amounts that are NOT crossed out or struck through. If you see multiple amounts where some are crossed out, use ONLY the final/current amount.
3. Always include both the currency symbol ($) AND the currency code (e.g., CAD, USD)
4. If a field is not found or is blank, write "Not specified"
5. Copy footnotes VERBATIM - do not summarize

EXTRACTION SIGNALS WITH PAGE REFERENCES (REQUIRED):
For EACH field value, include a signal in square brackets indicating how you found it AND the page number(s) where found.
Format: [SIGNAL:PAGE_NUM] or [SIGNAL:PAGE1,PAGE2] for multiple pages.

Signal types:
- [EXPLICIT:N]: Value found exactly as labeled on page N
- [INFERRED:N,M]: Value derived from context on pages N and M
- [PARTIAL:N]: Only some information found on page N
- [MULTIPLE:N,M]: Multiple conflicting values found on pages N and M; using the most recent/prominent one
- [NOT_FOUND:0]: Field not present in document - use "Not specified" as value

Page numbers correspond to the "--- Page N ---" markers in the text below.
Place the signal BEFORE the value on the same line.

OUTPUT FORMAT (use this EXACT structure - NO horizontal lines or dividers):

CONTRACT SUMMARY OF [CUSTOMER NAME]

1. CONTACT INFORMATION
   1.1 Customer Legal Name: [SIGNAL:PAGE] [Extract the customer/company name]
   1.2 Point of Contact: [SIGNAL:PAGE] [Name] <[email]>
   1.3 Billing Contact: [SIGNAL:PAGE] [Name] <[email]>

2. SERVICES & MODULES
   2.1 Included Modules:
       • [List each module/service on its own line with bullet]

3. CONTRACT TERMS & FEES
   3.1 Subscription Period
       Start Date: [SIGNAL:PAGE] [Date]
       End Date: [SIGNAL:PAGE] [Date]
       Duration: [SIGNAL:PAGE,PAGE] [Calculate total years/months]

   3.2 Annual Software Fees
       Year 1: [SIGNAL:PAGE] $[amount] [CURRENCY]
       Year 2: [SIGNAL:PAGE] $[amount] [CURRENCY]
       Year 3: [SIGNAL:PAGE] $[amount] [CURRENCY]
       [Continue for all years in contract - ONLY non-crossed-out amounts]

   3.3 Onboarding Services
       Payment Terms: [SIGNAL:PAGE] [Extract ONLY the net payment window — e.g., "Net 30", "Net 60", "Net 90". Look for "net" followed by a number in phrases like "payable ... net 30 of the reception of an invoice". Output ONLY as "Net [number]". Do NOT populate with billing trigger language like "invoiced on signing date" or "due upon receipt". If no "net [number]" language exists, use "Not specified".]
       One-Time Fee: [SIGNAL:PAGE] $[amount] [CURRENCY]

   3.4 Notes & Conditions
       [Copy ANY footnotes, asterisk notes, or conditions EXACTLY as written]

4. ADDITIONAL TERMS
   This Order Form is entered into pursuant to the Master Service Agreement dated [DATE].

5. SIGNATURES
   5.1 Customer: [SIGNAL:PAGE] [Name], [Title] — Signed: [Date]
   5.2 Vendor: [SIGNAL:PAGE] [Name], [Title] — Signed: [Date]

6. KEY CLAUSES
   For each clause type below, indicate YES or NO and include a brief description if the clause is present.
   For each YES clause, also provide on the NEXT two lines:
       VERBATIM: Copy the exact sentence(s) from the contract that establish this clause (1-3 sentences, in quotes)
       RISK: Assess as STANDARD (typical market terms), FAVORABLE (advantageous to customer), or UNUSUAL (non-standard, worth flagging)
   For NO clauses, do NOT include VERBATIM or RISK lines.
   6.1 Auto-Renewal: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.2 Termination for Convenience: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.3 SLA Guarantee: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.4 Liability Cap: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.5 Data Processing / DPA: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.6 Price Escalation: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.7 Exclusivity: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]
   6.8 Indemnification: [SIGNAL:PAGE] YES/NO — [brief description if yes]
       VERBATIM: "[exact contract language if YES]"
       RISK: [STANDARD|FAVORABLE|UNUSUAL if YES]

EXAMPLE OUTPUT:
   1.1 Customer Legal Name: [EXPLICIT:1] Acme Corporation Inc.
   Start Date: [EXPLICIT:2] January 1, 2024
   Duration: [INFERRED:2,3] 3 years
   1.2 Point of Contact: [PARTIAL:1] John Smith <Not specified>
   6.1 Auto-Renewal: [EXPLICIT:4] YES — Auto-renews for successive 1-year terms unless 90-day written notice
       VERBATIM: "This agreement shall automatically renew for successive one-year periods unless either party provides written notice of non-renewal at least ninety (90) days prior to the end of the then-current term."
       RISK: STANDARD
   6.3 SLA Guarantee: [NOT_FOUND:0] NO

---

CONTRACT TEXT TO ANALYZE:
{text}

---

Extract the information following the EXACT format above. Remember:
- ONLY use non-crossed-out/non-strikethrough amounts for fees
- Include currency symbol AND code (e.g., $60,000 CAD)
- Copy footnotes VERBATIM
- Use "Not specified" for missing fields
- Do NOT include horizontal line dividers (═══ or ───)
- For Section 4, ONLY output the MSA reference date - nothing else
- ALWAYS include the extraction signal with page reference [EXPLICIT:N], [INFERRED:N], [PARTIAL:N], [MULTIPLE:N,M], or [NOT_FOUND:0] before each value"""
    return prompt.format(text=text)


def extract_contract_info(text):
    """
    Send the PDF text to Claude and ask it to extract key information.
    V3: Precise extraction with numbered sections and confidence signals.
    """
    prompt = build_extraction_prompt(text)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=5120,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    return message.content[0].text


def generate_summary(data):
    """Generate a condensed summary for quick copy-paste to Slack/email."""
    lines = []

    if data['customer_name']:
        lines.append(f"Customer: {data['customer_name']}")

    if data['subscription_start'] and data['subscription_end']:
        lines.append(f"Contract Period: {data['subscription_start']} to {data['subscription_end']} ({data['duration']})")

    if data['total_contract_value']:
        lines.append(f"Total Contract Value: ${data['total_contract_value']:,.2f} {data['currency']}")

    if data['annual_fees']:
        fees_str = " | ".join([f"Y{f['year']}: ${f['amount']:,.0f}" for f in data['annual_fees']])
        lines.append(f"Annual Fees: {fees_str}")

    if data['onboarding_fee']:
        lines.append(f"Onboarding: ${data['onboarding_fee']:,.2f} {data['currency']}")

    if data['point_of_contact']['name']:
        poc = data['point_of_contact']
        poc_str = poc['name']
        if poc['email']:
            poc_str += f" ({poc['email']})"
        lines.append(f"Contact: {poc_str}")

    return "\n".join(lines)


@app.route('/')
def index():
    """Serve the main page with the upload interface"""
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Handle PDF file uploads with progress streaming via SSE.
    Returns structured JSON with parsed data for charting.
    """

    # Check if a file was included in the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Only PDF files are allowed'}), 400

    try:
        filename = secure_filename(file.filename)

        # Generate unique ID for this PDF
        pdf_id = str(uuid.uuid4())

        # Save PDF to disk for viewer
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{pdf_id}.pdf')
        file.save(pdf_path)

        # Check extraction cache by file hash
        with open(pdf_path, 'rb') as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()

        if file_hash in _extraction_cache:
            cached = _extraction_cache[file_hash]
            return jsonify({
                'success': True,
                'pdf_id': pdf_id,
                'filename': filename,
                'extracted_info': cached['extracted_info'],
                'parsed_data': cached['parsed_data'],
                'summary': cached['summary'],
                'text_length': cached['text_length'],
                'cached': True,
            })

        # Extract text from PDF
        pdf_text = extract_text_from_pdf(pdf_path)

        if not pdf_text or len(pdf_text.strip()) < 100:
            # Clean up if extraction fails
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            return jsonify({
                'error': 'Could not extract sufficient text from the PDF.'
            }), 400

        # Send to Claude for analysis
        extracted_info = extract_contract_info(pdf_text)

        # Parse into structured data
        parsed_data = parse_extracted_data(extracted_info)

        # Generate condensed summary
        summary = generate_summary(parsed_data)

        # Cache extraction result (evict oldest if at capacity)
        if len(_extraction_cache) >= _EXTRACTION_CACHE_MAX:
            oldest_key = next(iter(_extraction_cache))
            del _extraction_cache[oldest_key]
        _extraction_cache[file_hash] = {
            'extracted_info': extracted_info,
            'parsed_data': parsed_data,
            'summary': summary,
            'text_length': len(pdf_text),
        }

        return jsonify({
            'success': True,
            'pdf_id': pdf_id,
            'filename': filename,
            'extracted_info': extracted_info,
            'parsed_data': parsed_data,
            'summary': summary,
            'text_length': len(pdf_text)
        })

    except anthropic.APIError as e:
        return jsonify({'error': f'Claude API error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Processing error: {str(e)}'}), 500


def _sse_event(data):
    """Format a dict as an SSE data line."""
    return f"data: {json_module.dumps(data)}\n\n"


@app.route('/upload-stream', methods=['POST'])
def upload_file_stream():
    """Handle PDF upload with SSE progress streaming and Claude token streaming."""

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Only PDF files are allowed'}), 400

    filename = secure_filename(file.filename)
    pdf_id = str(uuid.uuid4())
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{pdf_id}.pdf')
    file.save(pdf_path)

    def generate():
        try:
            # Step 0: File validated
            yield _sse_event({'event': 'step', 'step': 0, 'status': 'complete', 'message': 'File validated'})

            # Step 1: Text extraction
            yield _sse_event({'event': 'step', 'step': 1, 'status': 'in_progress', 'message': 'Extracting text from PDF...'})

            # Check extraction cache by file hash
            with open(pdf_path, 'rb') as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()

            if file_hash in _extraction_cache:
                cached = _extraction_cache[file_hash]
                yield _sse_event({'event': 'step', 'step': 1, 'status': 'complete', 'message': 'Text extracted (cached)'})
                yield _sse_event({'event': 'step', 'step': 2, 'status': 'complete', 'message': 'Analysis complete (cached)'})
                yield _sse_event({'event': 'step', 'step': 3, 'status': 'complete', 'message': 'Summary ready (cached)'})
                yield _sse_event({'event': 'complete', 'result': {
                    'success': True, 'pdf_id': pdf_id, 'filename': filename,
                    **cached, 'cached': True,
                }})
                return

            pdf_text = extract_text_from_pdf(pdf_path)

            if not pdf_text or len(pdf_text.strip()) < 100:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                yield _sse_event({'event': 'error', 'message': 'Could not extract sufficient text from the PDF.'})
                return

            page_count = pdf_text.count('--- Page ')
            yield _sse_event({'event': 'step', 'step': 1, 'status': 'complete', 'message': f'Extracted {page_count} pages'})

            # Step 2: Claude analysis with streaming
            yield _sse_event({'event': 'step', 'step': 2, 'status': 'in_progress', 'message': 'Claude is analyzing the contract...'})

            prompt = build_extraction_prompt(pdf_text)
            collected_text = []
            char_count = 0

            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=5120,
                messages=[{"role": "user", "content": prompt}]
            ) as stream:
                for text_chunk in stream.text_stream:
                    collected_text.append(text_chunk)
                    char_count += len(text_chunk)
                    if char_count % 500 < len(text_chunk):
                        yield _sse_event({'event': 'step', 'step': 2, 'status': 'in_progress',
                                          'message': f'Analyzing... ({char_count} chars extracted)'})

            extracted_info = ''.join(collected_text)
            yield _sse_event({'event': 'step', 'step': 2, 'status': 'complete', 'message': 'Analysis complete'})

            # Step 3: Parse and summarize
            yield _sse_event({'event': 'step', 'step': 3, 'status': 'in_progress', 'message': 'Generating summary...'})

            parsed_data = parse_extracted_data(extracted_info)
            summary = generate_summary(parsed_data)

            # Cache extraction result
            if len(_extraction_cache) >= _EXTRACTION_CACHE_MAX:
                oldest_key = next(iter(_extraction_cache))
                del _extraction_cache[oldest_key]
            _extraction_cache[file_hash] = {
                'extracted_info': extracted_info,
                'parsed_data': parsed_data,
                'summary': summary,
                'text_length': len(pdf_text),
            }

            yield _sse_event({'event': 'step', 'step': 3, 'status': 'complete', 'message': 'Summary generated'})

            # Final result
            yield _sse_event({'event': 'complete', 'result': {
                'success': True,
                'pdf_id': pdf_id,
                'filename': filename,
                'extracted_info': extracted_info,
                'parsed_data': parsed_data,
                'summary': summary,
                'text_length': len(pdf_text),
            }})

        except anthropic.APIError as e:
            yield _sse_event({'event': 'error', 'message': f'Claude API error: {str(e)}'})
        except Exception as e:
            yield _sse_event({'event': 'error', 'message': f'Processing error: {str(e)}'})

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


# ============================================
# EMAIL ROUTES - Gmail OAuth2 Integration
# ============================================

@app.route('/auth/gmail')
def auth_gmail():
    """Initiate Gmail OAuth2 authorization flow"""
    try:
        # Get or create session ID
        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())

        redirect_uri = url_for('auth_gmail_callback', _external=True)
        authorization_url, state = email_service.get_authorization_url(redirect_uri)

        # Store state for verification
        session['oauth_state'] = state

        return jsonify({
            'success': True,
            'authorization_url': authorization_url
        })
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to initiate authorization: {str(e)}'
        }), 500


@app.route('/auth/gmail/callback')
def auth_gmail_callback():
    """Handle OAuth2 callback from Google"""
    try:
        # Get or create session ID
        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())

        session_id = session['session_id']
        redirect_uri = url_for('auth_gmail_callback', _external=True)

        # Handle the callback
        email_service.handle_oauth_callback(
            request.url,
            redirect_uri,
            session_id
        )

        # Redirect back to main app with success message
        return '''
        <html>
        <head><title>Gmail Connected</title></head>
        <body>
            <script>
                window.opener.postMessage({type: 'gmail_auth_success'}, '*');
                window.close();
            </script>
            <p>Gmail connected successfully! You can close this window.</p>
        </body>
        </html>
        '''
    except Exception as e:
        return f'''
        <html>
        <head><title>Authorization Failed</title></head>
        <body>
            <script>
                window.opener.postMessage({{type: 'gmail_auth_error', error: '{str(e)}'}}, '*');
                window.close();
            </script>
            <p>Authorization failed: {str(e)}</p>
        </body>
        </html>
        '''


@app.route('/auth/status')
def auth_status():
    """Check if user is authenticated with Gmail"""
    if 'session_id' not in session:
        return jsonify({
            'authenticated': False,
            'email': None
        })

    session_id = session['session_id']
    is_authenticated = email_service.is_authenticated(session_id)

    if is_authenticated:
        user_email = email_service.get_user_email(session_id)
        return jsonify({
            'authenticated': True,
            'email': user_email
        })
    else:
        return jsonify({
            'authenticated': False,
            'email': None
        })


@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    """Disconnect Gmail account"""
    if 'session_id' in session:
        email_service.clear_credentials(session['session_id'])

    return jsonify({
        'success': True,
        'message': 'Gmail disconnected'
    })


@app.route('/send-email', methods=['POST'])
def send_email():
    """Send email with contract details via Gmail"""
    if 'session_id' not in session:
        return jsonify({
            'success': False,
            'error': 'Not authenticated. Please connect your Gmail account.'
        }), 401

    session_id = session['session_id']

    if not email_service.is_authenticated(session_id):
        return jsonify({
            'success': False,
            'error': 'Not authenticated. Please connect your Gmail account.'
        }), 401

    # Get email data from request
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400

    to_email = data.get('to')
    subject = data.get('subject')
    body = data.get('body')
    cc_emails = data.get('cc')

    if not to_email:
        return jsonify({
            'success': False,
            'error': 'Recipient email is required'
        }), 400

    if not subject:
        return jsonify({
            'success': False,
            'error': 'Subject is required'
        }), 400

    if not body:
        return jsonify({
            'success': False,
            'error': 'Email body is required'
        }), 400

    # Send the email
    result = email_service.send_email(
        session_id=session_id,
        to_email=to_email,
        subject=subject,
        body=body,
        cc_emails=cc_emails
    )

    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500


@app.route('/send-slack', methods=['POST'])
def send_slack():
    """Send contract summary to Slack via incoming webhook"""
    data = request.get_json()

    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    webhook_url = data.get('webhook_url')
    parsed_data = data.get('parsed_data')

    if not webhook_url:
        return jsonify({'success': False, 'error': 'Slack webhook URL is required'}), 400
    if not parsed_data:
        return jsonify({'success': False, 'error': 'No contract data provided'}), 400

    # Build Slack Block Kit message
    customer = parsed_data.get('customer_name', 'Unknown')
    total = parsed_data.get('total_contract_value', 0)
    currency = parsed_data.get('currency', 'CAD')
    duration = parsed_data.get('duration', 'N/A')
    start = parsed_data.get('subscription_start', 'N/A')
    end = parsed_data.get('subscription_end', 'N/A')
    poc = parsed_data.get('point_of_contact', {})
    poc_name = poc.get('name', 'N/A')
    poc_email = poc.get('email', '')

    fees_lines = []
    for fee in parsed_data.get('annual_fees', []):
        fees_lines.append(f"Year {fee['year']}: ${fee['amount']:,.0f} {fee.get('currency', currency)}")

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"Contract Extracted: {customer}"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Total Value:*\n${total:,.2f} {currency}"},
                {"type": "mrkdwn", "text": f"*Duration:*\n{duration}"},
                {"type": "mrkdwn", "text": f"*Period:*\n{start} - {end}"},
                {"type": "mrkdwn", "text": f"*Contact:*\n{poc_name}" + (f" ({poc_email})" if poc_email else "")}
            ]
        }
    ]

    if fees_lines:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*Annual Fees:*\n" + "\n".join(fees_lines)}
        })

    onboarding = parsed_data.get('onboarding_fee')
    if onboarding:
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"Onboarding Fee: ${onboarding:,.2f} {currency}"}]
        })

    payload = {"blocks": blocks}

    try:
        resp = http_requests.post(webhook_url, json=payload, timeout=10)
        if resp.status_code == 200:
            return jsonify({'success': True, 'message': 'Posted to Slack'})
        else:
            return jsonify({'success': False, 'error': f'Slack returned status {resp.status_code}: {resp.text}'}), 502
    except http_requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'Slack webhook timed out'}), 504
    except http_requests.exceptions.RequestException as e:
        return jsonify({'success': False, 'error': f'Failed to reach Slack: {str(e)}'}), 502


@app.route('/push-to-sheets', methods=['POST'])
def push_to_sheets():
    """Push contract data as a new row to a Google Sheet"""
    if 'session_id' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated. Please connect your Google account.'}), 401

    session_id = session['session_id']

    if not email_service.is_authenticated(session_id):
        return jsonify({'success': False, 'error': 'Not authenticated. Please connect your Google account.'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    spreadsheet_id = data.get('spreadsheet_id')
    parsed_data = data.get('parsed_data')

    if not spreadsheet_id:
        return jsonify({'success': False, 'error': 'Google Sheet ID is required'}), 400
    if not parsed_data:
        return jsonify({'success': False, 'error': 'No contract data provided'}), 400

    try:
        from googleapiclient.discovery import build

        creds = email_service.get_credentials(session_id)
        if not creds:
            return jsonify({'success': False, 'error': 'No valid credentials'}), 401

        service = build('sheets', 'v4', credentials=creds)

        # Build row data
        customer = parsed_data.get('customer_name', '')
        total = parsed_data.get('total_contract_value', 0)
        currency = parsed_data.get('currency', 'CAD')
        duration = parsed_data.get('duration', '')
        start = parsed_data.get('subscription_start', '')
        end = parsed_data.get('subscription_end', '')
        poc = parsed_data.get('point_of_contact', {})
        poc_name = poc.get('name', '')
        poc_email = poc.get('email', '')
        onboarding = parsed_data.get('onboarding_fee', 0) or 0

        annual_fees_str = ', '.join(
            [f"Y{f['year']}: ${f['amount']:,.0f}" for f in parsed_data.get('annual_fees', [])]
        )

        row = [
            customer, f"${total:,.2f}", currency, duration,
            start, end, poc_name, poc_email,
            annual_fees_str, f"${onboarding:,.2f}",
            parsed_data.get('notes', '')
        ]

        body = {'values': [row]}
        service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range='Sheet1!A:K',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()

        return jsonify({'success': True, 'message': 'Row added to Google Sheet'})

    except Exception as e:
        return jsonify({'success': False, 'error': f'Sheets API error: {str(e)}'}), 500


@app.route('/pdf/<pdf_id>')
def serve_pdf(pdf_id):
    """Serve uploaded PDF from disk"""
    # Validate UUID format to prevent path traversal
    try:
        uuid.UUID(pdf_id)
    except ValueError:
        return jsonify({'error': 'Invalid PDF ID'}), 400

    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{pdf_id}.pdf')
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'PDF not found'}), 404

    return send_file(pdf_path, mimetype='application/pdf', max_age=3600)


@app.route('/pdf/<pdf_id>/check')
def check_pdf(pdf_id):
    """Check if a PDF exists on disk without downloading it"""
    try:
        uuid.UUID(pdf_id)
    except ValueError:
        return jsonify({'exists': False}), 400

    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{pdf_id}.pdf')
    if os.path.exists(pdf_path):
        return jsonify({'exists': True}), 200
    return jsonify({'exists': False}), 404


@app.route('/health')
def health():
    """Simple health check endpoint"""
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, host='0.0.0.0', port=port)
