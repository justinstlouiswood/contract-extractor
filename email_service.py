"""
Gmail OAuth2 Email Service
Handles authentication and email sending via Gmail API
"""

import os
import base64
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# OAuth2 scopes for Gmail and Google Sheets
SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets'
]

# Token storage (in production, use a database or secure session storage)
_token_storage = {}


def get_oauth_flow(redirect_uri):
    """Create OAuth2 flow for Gmail authentication"""
    client_id = os.environ.get('GMAIL_CLIENT_ID')
    client_secret = os.environ.get('GMAIL_CLIENT_SECRET')

    if not client_id or not client_secret:
        raise ValueError("GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in environment")

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

    return flow


def get_authorization_url(redirect_uri):
    """Get the URL to redirect user for Gmail authorization"""
    flow = get_oauth_flow(redirect_uri)

    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )

    return authorization_url, state


def handle_oauth_callback(authorization_response, redirect_uri, session_id):
    """Handle OAuth2 callback and store credentials"""
    flow = get_oauth_flow(redirect_uri)

    # Exchange authorization code for tokens
    flow.fetch_token(authorization_response=authorization_response)

    credentials = flow.credentials

    # Store credentials for this session
    _token_storage[session_id] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': list(credentials.scopes)
    }

    return True


def get_credentials(session_id):
    """Get stored credentials for a session"""
    if session_id not in _token_storage:
        return None

    creds_data = _token_storage[session_id]

    credentials = Credentials(
        token=creds_data['token'],
        refresh_token=creds_data['refresh_token'],
        token_uri=creds_data['token_uri'],
        client_id=creds_data['client_id'],
        client_secret=creds_data['client_secret'],
        scopes=creds_data['scopes']
    )

    return credentials


def is_authenticated(session_id):
    """Check if user is authenticated for this session"""
    return session_id in _token_storage


def clear_credentials(session_id):
    """Clear stored credentials for a session"""
    if session_id in _token_storage:
        del _token_storage[session_id]


def send_email(session_id, to_email, subject, body, cc_emails=None):
    """
    Send an email using Gmail API

    Args:
        session_id: The session ID to get credentials for
        to_email: Recipient email address (or comma-separated list)
        subject: Email subject line
        body: Email body text
        cc_emails: Optional CC recipients (comma-separated)

    Returns:
        dict with 'success' and 'message' or 'error'
    """
    credentials = get_credentials(session_id)

    if not credentials:
        return {
            'success': False,
            'error': 'Not authenticated. Please connect your Gmail account.'
        }

    try:
        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)

        # Create message
        message = MIMEMultipart()
        message['to'] = to_email
        message['subject'] = subject

        if cc_emails:
            message['cc'] = cc_emails

        # Add body
        message.attach(MIMEText(body, 'plain'))

        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

        # Send message
        sent_message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()

        return {
            'success': True,
            'message': f'Email sent successfully! Message ID: {sent_message["id"]}'
        }

    except HttpError as error:
        error_details = json.loads(error.content.decode('utf-8'))
        error_message = error_details.get('error', {}).get('message', str(error))

        return {
            'success': False,
            'error': f'Failed to send email: {error_message}'
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'An error occurred: {str(e)}'
        }


def get_user_email(session_id):
    """Get the authenticated user's email address"""
    credentials = get_credentials(session_id)

    if not credentials:
        return None

    try:
        service = build('gmail', 'v1', credentials=credentials)
        profile = service.users().getProfile(userId='me').execute()
        return profile.get('emailAddress')
    except Exception:
        return None
