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


def parse_extracted_data(extracted_text):
    """
    Parse the extracted text into structured JSON for the frontend.
    This enables charting and structured display.
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

    try:
        # Extract customer name
        customer_match = re.search(r'1\.1 Customer Legal Name:\s*(.+?)(?:\n|$)', extracted_text)
        if customer_match:
            data['customer_name'] = customer_match.group(1).strip()

        # Extract point of contact
        poc_match = re.search(r'1\.2 Point of Contact:\s*(.+?)(?:\n|$)', extracted_text)
        if poc_match:
            poc_text = poc_match.group(1).strip()
            email_match = re.search(r'<([^>]+)>', poc_text)
            if email_match:
                data['point_of_contact']['email'] = email_match.group(1)
                data['point_of_contact']['name'] = poc_text.replace(f'<{email_match.group(1)}>', '').strip()
            else:
                data['point_of_contact']['name'] = poc_text

        # Extract billing contact
        billing_match = re.search(r'1\.3 Billing Contact:\s*(.+?)(?:\n|$)', extracted_text)
        if billing_match:
            billing_text = billing_match.group(1).strip()
            email_match = re.search(r'<([^>]+)>', billing_text)
            if email_match:
                data['billing_contact']['email'] = email_match.group(1)
                data['billing_contact']['name'] = billing_text.replace(f'<{email_match.group(1)}>', '').strip()
            else:
                data['billing_contact']['name'] = billing_text

        # Extract subscription dates
        start_match = re.search(r'Start Date:\s*(.+?)(?:\n|$)', extracted_text)
        if start_match:
            data['subscription_start'] = start_match.group(1).strip()

        end_match = re.search(r'End Date:\s*(.+?)(?:\n|$)', extracted_text)
        if end_match:
            data['subscription_end'] = end_match.group(1).strip()

        duration_match = re.search(r'Duration:\s*(.+?)(?:\n|$)', extracted_text)
        if duration_match:
            data['duration'] = duration_match.group(1).strip()

        # Extract annual fees (Year 1, Year 2, etc.)
        year_pattern = re.compile(r'Year\s*(\d+):\s*\$?([\d,]+(?:\.\d{2})?)\s*(\w+)?', re.IGNORECASE)
        for match in year_pattern.finditer(extracted_text):
            year_num = int(match.group(1))
            amount_str = match.group(2).replace(',', '')
            amount = float(amount_str)
            currency = match.group(3) if match.group(3) else 'CAD'
            data['annual_fees'].append({
                'year': year_num,
                'amount': amount,
                'currency': currency
            })
            data['currency'] = currency

        # Sort annual fees by year
        data['annual_fees'].sort(key=lambda x: x['year'])

        # Extract onboarding fee
        onboarding_match = re.search(r'One-Time Fee:\s*\$?([\d,]+(?:\.\d{2})?)\s*(\w+)?', extracted_text)
        if onboarding_match:
            amount_str = onboarding_match.group(1).replace(',', '')
            data['onboarding_fee'] = float(amount_str)

        # Extract onboarding terms
        terms_match = re.search(r'Payment Terms:\s*(.+?)(?:\n|$)', extracted_text)
        if terms_match:
            data['onboarding_terms'] = terms_match.group(1).strip()

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

        # Extract signatures
        customer_sig = re.search(r'5\.1 Customer:\s*([^,]+),\s*([^—]+)—\s*Signed:\s*(.+?)(?:\n|$)', extracted_text)
        if customer_sig:
            data['signatures']['customer'] = {
                'name': customer_sig.group(1).strip(),
                'title': customer_sig.group(2).strip(),
                'date': customer_sig.group(3).strip()
            }

        vendor_sig = re.search(r'5\.2 Vendor:\s*([^,]+),\s*([^—]+)—\s*Signed:\s*(.+?)(?:\n|$)', extracted_text)
        if vendor_sig:
            data['signatures']['vendor'] = {
                'name': vendor_sig.group(1).strip(),
                'title': vendor_sig.group(2).strip(),
                'date': vendor_sig.group(3).strip()
            }

    except Exception as e:
        print(f"Error parsing extracted data: {e}")

    return data


def extract_contract_info(text):
    """
    Send the PDF text to Claude and ask it to extract key information.
    V2: Precise extraction with numbered sections for MSA Order Forms.
    """

    prompt = """You are a contract extraction specialist. Your task is to extract SPECIFIC information from an MSA (Master Service Agreement) Order Form and output it in a precise, structured format.

CRITICAL INSTRUCTIONS:
1. Extract ONLY the fields specified below - nothing more, nothing less
2. For pricing/fees: ONLY extract amounts that are NOT crossed out or struck through. If you see multiple amounts where some are crossed out, use ONLY the final/current amount.
3. Always include both the currency symbol ($) AND the currency code (e.g., CAD, USD)
4. If a field is not found or is blank, write "Not specified"
5. Copy footnotes VERBATIM - do not summarize

OUTPUT FORMAT (use this EXACT structure - NO horizontal lines or dividers):

CONTRACT SUMMARY OF [CUSTOMER NAME]

1. CONTACT INFORMATION
   1.1 Customer Legal Name: [Extract the customer/company name]
   1.2 Point of Contact: [Name] <[email]>
   1.3 Billing Contact: [Name] <[email]>

2. SERVICES & MODULES
   2.1 Included Modules:
       • [List each module/service on its own line with bullet]

3. CONTRACT TERMS & FEES
   3.1 Subscription Period
       Start Date: [Date]
       End Date: [Date]
       Duration: [Calculate total years/months]

   3.2 Annual Software Fees
       Year 1: $[amount] [CURRENCY]
       Year 2: $[amount] [CURRENCY]
       Year 3: $[amount] [CURRENCY]
       [Continue for all years in contract - ONLY non-crossed-out amounts]

   3.3 Onboarding Services
       Payment Terms: [e.g., "Invoiced on Signing Date net 30"]
       One-Time Fee: $[amount] [CURRENCY]

   3.4 Notes & Conditions
       [Copy ANY footnotes, asterisk notes, or conditions EXACTLY as written]

4. ADDITIONAL TERMS
   This Order Form is entered into pursuant to the Master Service Agreement dated [DATE].

5. SIGNATURES
   5.1 Customer: [Name], [Title] — Signed: [Date]
   5.2 Vendor: [Name], [Title] — Signed: [Date]

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
- For Section 4, ONLY output the MSA reference date - nothing else"""

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
