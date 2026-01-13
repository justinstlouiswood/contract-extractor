"""
Contract Extractor - Main Application (V3)

Features:
- PDF upload and text extraction
- AI-powered contract analysis via Claude
- Real-time progress streaming (SSE)
- Structured JSON output for charting
- Cancel/abort functionality
"""

import os
import re
import json
import tempfile
import threading
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, render_template, Response, stream_with_context, session, redirect, url_for
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

# Track active processing jobs (for cancellation)
active_jobs = {}


def allowed_file(filename):
    """Check if the uploaded file has a .pdf extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_signal(text):
    """
    Extract the signal tag from a value string.
    Returns (signal, clean_value) tuple.
    """
    signal_match = re.match(r'\[(\w+)\]\s*(.*)$', text.strip())
    if signal_match:
        return signal_match.group(1).upper(), signal_match.group(2).strip()
    return 'EXPLICIT', text.strip()  # Default to EXPLICIT if no signal found


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
        'onboarding_terms': None,
        'currency': 'CAD',
        'total_contract_value': 0,
        'notes': None,
        'additional_terms': None,
        'signatures': {
            'customer': {'name': None, 'title': None, 'date': None},
            'vendor': {'name': None, 'title': None, 'date': None}
        },
        'raw_text': extracted_text
    }

    # Track extraction signals for confidence calculation
    signals = {}

    try:
        # Extract customer name (with signal)
        customer_match = re.search(r'1\.1 Customer Legal Name:\s*(.+?)(?:\n|$)', extracted_text)
        if customer_match:
            signal, value = extract_signal(customer_match.group(1))
            signals['customer_name'] = signal
            data['customer_name'] = value

        # Extract point of contact (with signal)
        poc_match = re.search(r'1\.2 Point of Contact:\s*(.+?)(?:\n|$)', extracted_text)
        if poc_match:
            signal, poc_text = extract_signal(poc_match.group(1))
            signals['point_of_contact'] = signal
            email_match = re.search(r'<([^>]+)>', poc_text)
            if email_match:
                data['point_of_contact']['email'] = email_match.group(1)
                data['point_of_contact']['name'] = poc_text.replace(f'<{email_match.group(1)}>', '').strip()
            else:
                data['point_of_contact']['name'] = poc_text

        # Extract billing contact (with signal)
        billing_match = re.search(r'1\.3 Billing Contact:\s*(.+?)(?:\n|$)', extracted_text)
        if billing_match:
            signal, billing_text = extract_signal(billing_match.group(1))
            signals['billing_contact'] = signal
            email_match = re.search(r'<([^>]+)>', billing_text)
            if email_match:
                data['billing_contact']['email'] = email_match.group(1)
                data['billing_contact']['name'] = billing_text.replace(f'<{email_match.group(1)}>', '').strip()
            else:
                data['billing_contact']['name'] = billing_text

        # Extract subscription dates (with signals)
        start_match = re.search(r'Start Date:\s*(.+?)(?:\n|$)', extracted_text)
        if start_match:
            signal, value = extract_signal(start_match.group(1))
            signals['subscription_start'] = signal
            data['subscription_start'] = value

        end_match = re.search(r'End Date:\s*(.+?)(?:\n|$)', extracted_text)
        if end_match:
            signal, value = extract_signal(end_match.group(1))
            signals['subscription_end'] = signal
            data['subscription_end'] = value

        duration_match = re.search(r'Duration:\s*(.+?)(?:\n|$)', extracted_text)
        if duration_match:
            signal, value = extract_signal(duration_match.group(1))
            signals['duration'] = signal
            data['duration'] = value

        # Extract annual fees (Year 1, Year 2, etc.) - with signal detection
        # Pattern: Year 1: [SIGNAL] $amount CURRENCY
        year_pattern = re.compile(r'Year\s*(\d+):\s*(?:\[(\w+)\])?\s*\$?([\d,]+(?:\.\d{2})?)\s*(\w+)?', re.IGNORECASE)
        annual_fee_signals = []
        for match in year_pattern.finditer(extracted_text):
            year_num = int(match.group(1))
            signal = match.group(2).upper() if match.group(2) else 'EXPLICIT'
            annual_fee_signals.append(signal)
            amount_str = match.group(3).replace(',', '')
            amount = float(amount_str)
            currency = match.group(4) if match.group(4) else 'CAD'
            data['annual_fees'].append({
                'year': year_num,
                'amount': amount,
                'currency': currency
            })
            data['currency'] = currency

        # Use most common signal for annual fees
        if annual_fee_signals:
            signals['annual_fees'] = max(set(annual_fee_signals), key=annual_fee_signals.count)

        # Sort annual fees by year
        data['annual_fees'].sort(key=lambda x: x['year'])

        # Extract onboarding fee (with signal)
        onboarding_match = re.search(r'One-Time Fee:\s*(?:\[(\w+)\])?\s*\$?([\d,]+(?:\.\d{2})?)\s*(\w+)?', extracted_text)
        if onboarding_match:
            signals['onboarding_fee'] = onboarding_match.group(1).upper() if onboarding_match.group(1) else 'EXPLICIT'
            amount_str = onboarding_match.group(2).replace(',', '')
            data['onboarding_fee'] = float(amount_str)

        # Extract onboarding terms (with signal)
        terms_match = re.search(r'Payment Terms:\s*(.+?)(?:\n|$)', extracted_text)
        if terms_match:
            signal, value = extract_signal(terms_match.group(1))
            signals['onboarding_terms'] = signal
            data['onboarding_terms'] = value

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
        customer_sig = re.search(r'5\.1 Customer:\s*(?:\[(\w+)\])?\s*([^,]+),\s*([^—]+)—\s*Signed:\s*(.+?)(?:\n|$)', extracted_text)
        if customer_sig:
            signals['signature_customer'] = customer_sig.group(1).upper() if customer_sig.group(1) else 'EXPLICIT'
            data['signatures']['customer'] = {
                'name': customer_sig.group(2).strip(),
                'title': customer_sig.group(3).strip(),
                'date': customer_sig.group(4).strip()
            }

        vendor_sig = re.search(r'5\.2 Vendor:\s*(?:\[(\w+)\])?\s*([^,]+),\s*([^—]+)—\s*Signed:\s*(.+?)(?:\n|$)', extracted_text)
        if vendor_sig:
            signals['signature_vendor'] = vendor_sig.group(1).upper() if vendor_sig.group(1) else 'EXPLICIT'
            data['signatures']['vendor'] = {
                'name': vendor_sig.group(2).strip(),
                'title': vendor_sig.group(3).strip(),
                'date': vendor_sig.group(4).strip()
            }

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


def extract_contract_info(text):
    """
    Send the PDF text to Claude and ask it to extract key information.
    V3: Precise extraction with numbered sections and confidence signals.
    """

    prompt = """You are a contract extraction specialist. Your task is to extract SPECIFIC information from an MSA (Master Service Agreement) Order Form and output it in a precise, structured format.

CRITICAL INSTRUCTIONS:
1. Extract ONLY the fields specified below - nothing more, nothing less
2. For pricing/fees: ONLY extract amounts that are NOT crossed out or struck through. If you see multiple amounts where some are crossed out, use ONLY the final/current amount.
3. Always include both the currency symbol ($) AND the currency code (e.g., CAD, USD)
4. If a field is not found or is blank, write "Not specified"
5. Copy footnotes VERBATIM - do not summarize

EXTRACTION SIGNALS (REQUIRED):
For EACH field value, include a signal in square brackets indicating how you found it:
- [EXPLICIT]: Value found exactly as labeled in the document (e.g., "Customer Name: Acme Corp")
- [INFERRED]: Value derived from context or calculation (e.g., duration calculated from dates)
- [PARTIAL]: Only some information found (e.g., name without email for contacts)
- [MULTIPLE]: Multiple conflicting values found; using the most recent/prominent one
- [NOT_FOUND]: Field not present in document - use "Not specified" as value

Place the signal BEFORE the value on the same line.

OUTPUT FORMAT (use this EXACT structure - NO horizontal lines or dividers):

CONTRACT SUMMARY OF [CUSTOMER NAME]

1. CONTACT INFORMATION
   1.1 Customer Legal Name: [SIGNAL] [Extract the customer/company name]
   1.2 Point of Contact: [SIGNAL] [Name] <[email]>
   1.3 Billing Contact: [SIGNAL] [Name] <[email]>

2. SERVICES & MODULES
   2.1 Included Modules:
       • [List each module/service on its own line with bullet]

3. CONTRACT TERMS & FEES
   3.1 Subscription Period
       Start Date: [SIGNAL] [Date]
       End Date: [SIGNAL] [Date]
       Duration: [SIGNAL] [Calculate total years/months]

   3.2 Annual Software Fees
       Year 1: [SIGNAL] $[amount] [CURRENCY]
       Year 2: [SIGNAL] $[amount] [CURRENCY]
       Year 3: [SIGNAL] $[amount] [CURRENCY]
       [Continue for all years in contract - ONLY non-crossed-out amounts]

   3.3 Onboarding Services
       Payment Terms: [SIGNAL] [e.g., "Invoiced on Signing Date net 30"]
       One-Time Fee: [SIGNAL] $[amount] [CURRENCY]

   3.4 Notes & Conditions
       [Copy ANY footnotes, asterisk notes, or conditions EXACTLY as written]

4. ADDITIONAL TERMS
   This Order Form is entered into pursuant to the Master Service Agreement dated [DATE].

5. SIGNATURES
   5.1 Customer: [SIGNAL] [Name], [Title] — Signed: [Date]
   5.2 Vendor: [SIGNAL] [Name], [Title] — Signed: [Date]

EXAMPLE OUTPUT:
   1.1 Customer Legal Name: [EXPLICIT] Acme Corporation Inc.
   Start Date: [EXPLICIT] January 1, 2024
   Duration: [INFERRED] 3 years
   1.2 Point of Contact: [PARTIAL] John Smith <Not specified>

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
- ALWAYS include the extraction signal [EXPLICIT], [INFERRED], [PARTIAL], [MULTIPLE], or [NOT_FOUND] before each value"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[
            {"role": "user", "content": prompt.format(text=text)}
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

        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            file.save(tmp_file.name)
            temp_path = tmp_file.name

        # Extract text from PDF
        pdf_text = extract_text_from_pdf(temp_path)

        # Clean up temp file
        os.unlink(temp_path)

        if not pdf_text or len(pdf_text.strip()) < 100:
            return jsonify({
                'error': 'Could not extract sufficient text from the PDF.'
            }), 400

        # Send to Claude for analysis
        extracted_info = extract_contract_info(pdf_text)

        # Parse into structured data
        parsed_data = parse_extracted_data(extracted_info)

        # Generate condensed summary
        summary = generate_summary(parsed_data)

        return jsonify({
            'success': True,
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


@app.route('/upload-stream', methods=['POST'])
def upload_file_stream():
    """
    Handle PDF file uploads with Server-Sent Events (SSE) for progress updates.
    This endpoint streams progress back to the client in real-time.
    """

    def generate():
        job_id = str(uuid.uuid4())
        active_jobs[job_id] = {'cancelled': False}

        try:
            # Step 1: Validate file
            yield f"data: {json.dumps({'step': 1, 'status': 'in_progress', 'message': 'Validating file...', 'job_id': job_id})}\n\n"

            if 'file' not in request.files:
                yield f"data: {json.dumps({'error': 'No file uploaded'})}\n\n"
                return

            file = request.files['file']

            if file.filename == '':
                yield f"data: {json.dumps({'error': 'No file selected'})}\n\n"
                return

            if not allowed_file(file.filename):
                yield f"data: {json.dumps({'error': 'Only PDF files are allowed'})}\n\n"
                return

            filename = secure_filename(file.filename)
            yield f"data: {json.dumps({'step': 1, 'status': 'complete', 'message': 'File validated'})}\n\n"

            # Check for cancellation
            if active_jobs.get(job_id, {}).get('cancelled'):
                yield f"data: {json.dumps({'cancelled': True})}\n\n"
                return

            # Step 2: Extract text from PDF
            yield f"data: {json.dumps({'step': 2, 'status': 'in_progress', 'message': 'Extracting text from PDF...'})}\n\n"

            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                file.save(tmp_file.name)
                temp_path = tmp_file.name

            pdf_text = extract_text_from_pdf(temp_path)
            os.unlink(temp_path)

            if not pdf_text or len(pdf_text.strip()) < 100:
                yield f"data: {json.dumps({'error': 'Could not extract text from PDF'})}\n\n"
                return

            yield f"data: {json.dumps({'step': 2, 'status': 'complete', 'message': f'Extracted {len(pdf_text)} characters'})}\n\n"

            # Check for cancellation
            if active_jobs.get(job_id, {}).get('cancelled'):
                yield f"data: {json.dumps({'cancelled': True})}\n\n"
                return

            # Step 3: Analyze with Claude
            yield f"data: {json.dumps({'step': 3, 'status': 'in_progress', 'message': 'Analyzing contract with AI...'})}\n\n"

            extracted_info = extract_contract_info(pdf_text)

            yield f"data: {json.dumps({'step': 3, 'status': 'complete', 'message': 'Analysis complete'})}\n\n"

            # Check for cancellation
            if active_jobs.get(job_id, {}).get('cancelled'):
                yield f"data: {json.dumps({'cancelled': True})}\n\n"
                return

            # Step 4: Generate structured output
            yield f"data: {json.dumps({'step': 4, 'status': 'in_progress', 'message': 'Generating summary...'})}\n\n"

            parsed_data = parse_extracted_data(extracted_info)
            summary = generate_summary(parsed_data)

            yield f"data: {json.dumps({'step': 4, 'status': 'complete', 'message': 'Summary generated'})}\n\n"

            # Final result
            result = {
                'success': True,
                'filename': filename,
                'extracted_info': extracted_info,
                'parsed_data': parsed_data,
                'summary': summary,
                'complete': True
            }
            yield f"data: {json.dumps(result)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # Clean up job tracking
            if job_id in active_jobs:
                del active_jobs[job_id]

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )


@app.route('/cancel/<job_id>', methods=['POST'])
def cancel_job(job_id):
    """Cancel an active extraction job."""
    if job_id in active_jobs:
        active_jobs[job_id]['cancelled'] = True
        return jsonify({'success': True, 'message': 'Job cancellation requested'})
    return jsonify({'error': 'Job not found'}), 404


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


@app.route('/health')
def health():
    """Simple health check endpoint"""
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, host='0.0.0.0', port=port)
