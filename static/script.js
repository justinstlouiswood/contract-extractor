/**
 * Contract Extractor V5 - Extract > Review > Distribute
 * 3-phase pipeline: compress PDF into structured data, verify, push downstream.
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// localStorage keys
const STORAGE_KEY = 'contract_extractor_history';
const MAX_HISTORY = 5;
const SLACK_WEBHOOK_KEY = 'contract_extractor_slack_webhook';
const SHEETS_ID_KEY = 'contract_extractor_sheets_id';

// localStorage management functions
const getRecentContracts = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

const generateContractId = (data) => {
    const name = data.parsed_data?.customer_name || '';
    const value = data.parsed_data?.total_contract_value || 0;
    return `${name.toLowerCase().replace(/\s+/g, '_')}_${value}`;
};

const saveContract = (data) => {
    const history = getRecentContracts();
    const newId = generateContractId(data);

    const existingIndex = history.findIndex(c => c.id === newId);
    if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
    }

    const contractRecord = {
        id: newId,
        customer_name: data.parsed_data?.customer_name || 'Unknown',
        total_value: data.parsed_data?.total_contract_value || 0,
        currency: data.parsed_data?.currency || 'CAD',
        date_processed: new Date().toISOString(),
        parsed_data: data.parsed_data,
        extracted_info: data.extracted_info,
        summary: data.summary,
        pdf_id: data.pdf_id || null
    };

    history.unshift(contractRecord);
    while (history.length > MAX_HISTORY) {
        history.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return contractRecord;
};

const clearRecentContracts = () => {
    localStorage.removeItem(STORAGE_KEY);
};

// Theme management
const THEME_KEY = 'contract_extractor_theme';
const getStoredTheme = () => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
};
const setStoredTheme = (theme) => {
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
};
const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
};
const initTheme = () => {
    const theme = getStoredTheme();
    applyTheme(theme);
    return theme;
};

// ============================================
// ICONS
// ============================================

const Icons = {
    Upload: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
    ),
    ArrowLeft: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
        </svg>
    ),
    ArrowRight: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
        </svg>
    ),
    Check: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    ),
    Copy: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
    ),
    X: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    ),
    AlertCircle: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
    ),
    FileText: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
    ),
    Mail: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
        </svg>
    ),
    Search: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
    ),
    Send: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
    ),
    Link: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
    ),
    HelpCircle: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    Pencil: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
        </svg>
    ),
    Sparkle: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            <path d="M5 3v4"/>
            <path d="M19 17v4"/>
            <path d="M3 5h4"/>
            <path d="M17 19h4"/>
        </svg>
    ),
    Eye: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
    ),
    EyeOff: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    ),
    ChevronDown: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    ),
    ChevronRight: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
        </svg>
    ),
    ZoomIn: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
    ),
    ZoomOut: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
    ),
    Slack: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="13" y="2" width="3" height="8" rx="1.5"/>
            <path d="M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5"/>
            <rect x="8" y="14" width="3" height="8" rx="1.5"/>
            <path d="M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5"/>
            <rect x="14" y="13" width="8" height="3" rx="1.5"/>
            <path d="M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5"/>
            <rect x="2" y="8" width="8" height="3" rx="1.5"/>
            <path d="M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5"/>
        </svg>
    ),
    Table: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
    ),
    Lock: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
    ),
    Download: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
    )
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (amount) => {
    return '$' + new Intl.NumberFormat('en-CA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const sanitizeFilename = (name) => {
    if (!name) return 'contract';
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
};

const getConfidenceColor = (score) => {
    if (score >= 85) return '#2E8B57';
    if (score >= 60) return '#C89820';
    return '#9B2226';
};

const getConfidenceLabel = (score) => {
    if (score >= 85) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
};

const getTagColor = (signal) => {
    const colors = {
        'MULTIPLE': '#2E5A34',
        'EXPLICIT': '#2E8B57',
        'INFERRED': '#9B2226',
        'PARTIAL': '#C89820',
        'NOT_FOUND': '#9a9b97'
    };
    return colors[signal] || '#9a9b97';
};

const parseExtractedText = (text) => {
    const tagRegex = /\[(EXPLICIT|INFERRED|PARTIAL|MULTIPLE|NOT_FOUND)(?::\d+(?:,\d+)*)?\]/g;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }
        segments.push({ type: 'tag', signal: match[1] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        segments.push({ type: 'text', content: text.slice(lastIndex) });
    }
    return segments;
};

const stripSourceTags = (text) => {
    return text.replace(/\[(?:EXPLICIT|INFERRED|PARTIAL|MULTIPLE|NOT_FOUND)(?::\d+(?:,\d+)*)?\]\s*/g, '');
};

const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const buildExportData = (parsed_data, editedFields = {}) => {
    const currency = parsed_data.currency || 'CAD';
    const formatFee = (amount) => amount ? formatCurrency(amount) + ' ' + currency : 'Not specified';
    const get = (key, original) => editedFields.hasOwnProperty(key) ? editedFields[key] : original;

    return {
        contractDetails: {
            customer: get('customer_name', parsed_data.customer_name) || 'Not specified',
            duration: get('duration', parsed_data.duration) || 'Not specified',
            startDate: get('subscription_start', parsed_data.subscription_start) || 'Not specified',
            endDate: get('subscription_end', parsed_data.subscription_end) || 'Not specified',
            contact: get('point_of_contact_name', parsed_data.point_of_contact?.name) || 'Not specified',
            email: get('point_of_contact_email', parsed_data.point_of_contact?.email) || 'Not specified'
        },
        termsAndFees: {
            onboardingFee: get('onboarding_fee', formatFee(parsed_data.onboarding_fee)),
            ...(parsed_data.annual_fees || []).reduce((acc, fee) => {
                const feeKey = `annual_fee_${fee.year}`;
                acc[`year${fee.year}Fee`] = get(feeKey, formatFee(fee.amount));
                return acc;
            }, {}),
            customerSignature: get('signature_customer', parsed_data.signatures?.customer?.name
                ? `${parsed_data.signatures.customer.name}${parsed_data.signatures.customer.date ? ` (${parsed_data.signatures.customer.date})` : ''}`
                : 'Not specified'),
            vendorSignature: get('signature_vendor', parsed_data.signatures?.vendor?.name
                ? `${parsed_data.signatures.vendor.name}${parsed_data.signatures.vendor.date ? ` (${parsed_data.signatures.vendor.date})` : ''}`
                : 'Not specified')
        }
    };
};

const exportToCSV = (parsed_data, editedFields = {}) => {
    const data = buildExportData(parsed_data, editedFields);
    const rows = [['Category', 'Field', 'Value']];
    rows.push(['Contract Details', 'Customer', data.contractDetails.customer]);
    rows.push(['Contract Details', 'Duration', data.contractDetails.duration]);
    rows.push(['Contract Details', 'Start Date', data.contractDetails.startDate]);
    rows.push(['Contract Details', 'End Date', data.contractDetails.endDate]);
    rows.push(['Contract Details', 'Contact', data.contractDetails.contact]);
    rows.push(['Contract Details', 'Email', data.contractDetails.email]);
    rows.push(['Terms & Fees', 'Onboarding Fee', data.termsAndFees.onboardingFee]);
    Object.keys(data.termsAndFees).forEach(key => {
        if (key.startsWith('year')) {
            const yearNum = key.match(/year(\d+)/)[1];
            rows.push(['Terms & Fees', `Year ${yearNum} Fee`, data.termsAndFees[key]]);
        }
    });
    rows.push(['Terms & Fees', 'Customer Signature', data.termsAndFees.customerSignature]);
    rows.push(['Terms & Fees', 'Vendor Signature', data.termsAndFees.vendorSignature]);

    const csvContent = rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const customerName = editedFields.hasOwnProperty('customer_name') ? editedFields.customer_name : parsed_data.customer_name;
    downloadFile(csvContent, sanitizeFilename(customerName) + '_extraction.csv', 'text/csv;charset=utf-8;');
};

const exportToJSON = (parsed_data, editedFields = {}) => {
    const data = buildExportData(parsed_data, editedFields);
    const jsonContent = JSON.stringify({ exportDate: new Date().toISOString(), ...data }, null, 2);
    const customerName = editedFields.hasOwnProperty('customer_name') ? editedFields.customer_name : parsed_data.customer_name;
    downloadFile(jsonContent, sanitizeFilename(customerName) + '_extraction.json', 'application/json');
};

const exportToExcel = (parsed_data, editedFields = {}) => {
    if (typeof XLSX === 'undefined') {
        alert('SheetJS library not loaded');
        return;
    }
    const data = buildExportData(parsed_data, editedFields);
    const rows = [
        ['Category', 'Field', 'Value'],
        ['Contract Details', 'Customer', data.contractDetails.customer],
        ['Contract Details', 'Duration', data.contractDetails.duration],
        ['Contract Details', 'Start Date', data.contractDetails.startDate],
        ['Contract Details', 'End Date', data.contractDetails.endDate],
        ['Contract Details', 'Contact', data.contractDetails.contact],
        ['Contract Details', 'Email', data.contractDetails.email],
        ['Terms & Fees', 'Onboarding Fee', data.termsAndFees.onboardingFee]
    ];
    Object.keys(data.termsAndFees).forEach(key => {
        if (key.startsWith('year')) {
            const yearNum = key.match(/year(\d+)/)[1];
            rows.push(['Terms & Fees', `Year ${yearNum} Fee`, data.termsAndFees[key]]);
        }
    });
    rows.push(['Terms & Fees', 'Customer Signature', data.termsAndFees.customerSignature]);
    rows.push(['Terms & Fees', 'Vendor Signature', data.termsAndFees.vendorSignature]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contract');
    const customerName = editedFields.hasOwnProperty('customer_name') ? editedFields.customer_name : parsed_data.customer_name;
    XLSX.writeFile(wb, sanitizeFilename(customerName) + '_extraction.xlsx');
};

// Build fields list from parsed data for the review workflow
const getVerifiableFields = (parsed_data) => {
    if (!parsed_data) return [];
    const fields = [];
    const currency = parsed_data.currency || 'CAD';

    if (parsed_data.customer_name) fields.push({ key: 'customer_name', label: 'Customer', value: parsed_data.customer_name, section: 'contract_details' });
    if (parsed_data.duration) fields.push({ key: 'duration', label: 'Duration', value: parsed_data.duration, section: 'contract_details' });
    if (parsed_data.subscription_start) fields.push({ key: 'subscription_start', label: 'Start Date', value: parsed_data.subscription_start, section: 'contract_details' });
    if (parsed_data.subscription_end) fields.push({ key: 'subscription_end', label: 'End Date', value: parsed_data.subscription_end, section: 'contract_details' });
    if (parsed_data.point_of_contact?.name) fields.push({ key: 'point_of_contact_name', label: 'Contact', value: parsed_data.point_of_contact.name, section: 'contract_details' });
    if (parsed_data.point_of_contact?.email) fields.push({ key: 'point_of_contact_email', label: 'Email', value: parsed_data.point_of_contact.email, section: 'contract_details', isLink: true });
    if (parsed_data.billing_contact?.name) fields.push({ key: 'billing_contact_name', label: 'Billing Contact', value: parsed_data.billing_contact.name, section: 'contract_details' });
    if (parsed_data.billing_contact?.email) fields.push({ key: 'billing_contact_email', label: 'Billing Email', value: parsed_data.billing_contact.email, section: 'contract_details', isLink: true });

    if (parsed_data.onboarding_fee > 0) fields.push({ key: 'onboarding_fee', label: 'Onboarding Fee', value: formatCurrency(parsed_data.onboarding_fee) + ' ' + currency, section: 'fees_revenue' });
    if (parsed_data.payment_terms) fields.push({ key: 'payment_terms', label: 'Payment Terms', value: parsed_data.payment_terms, section: 'fees_revenue' });
    if (parsed_data.annual_fees) {
        parsed_data.annual_fees.forEach(fee => {
            fields.push({ key: `annual_fee_year_${fee.year}`, label: `Year ${fee.year} Fee`, value: formatCurrency(fee.amount) + ' ' + currency, section: 'fees_revenue' });
        });
    }

    if (parsed_data.signatures?.customer?.name) fields.push({ key: 'signature_customer', label: 'Customer Signature', value: `${parsed_data.signatures.customer.name}${parsed_data.signatures.customer.date ? ` (${parsed_data.signatures.customer.date})` : ''}`, section: 'signatures' });
    if (parsed_data.signatures?.vendor?.name) fields.push({ key: 'signature_vendor', label: 'Vendor Signature', value: `${parsed_data.signatures.vendor.name}${parsed_data.signatures.vendor.date ? ` (${parsed_data.signatures.vendor.date})` : ''}`, section: 'signatures' });
    if (parsed_data.notes) fields.push({ key: 'notes', label: 'Notes', value: parsed_data.notes, section: 'signatures' });
    if (parsed_data.additional_terms) fields.push({ key: 'additional_terms', label: 'Additional Terms', value: parsed_data.additional_terms, section: 'signatures' });

    return fields;
};

// Get page refs for a field key from parsed_data
const getPageRef = (parsed_data, fieldKey) => {
    if (!parsed_data?.page_refs) return [];
    // Try direct match
    if (parsed_data.page_refs[fieldKey]) return parsed_data.page_refs[fieldKey];
    // Map composite keys
    const mapping = {
        'point_of_contact_name': 'point_of_contact',
        'point_of_contact_email': 'point_of_contact',
        'billing_contact_name': 'billing_contact',
        'billing_contact_email': 'billing_contact'
    };
    if (mapping[fieldKey] && parsed_data.page_refs[mapping[fieldKey]]) {
        return parsed_data.page_refs[mapping[fieldKey]];
    }
    return [];
};

// Build formatted clipboard text from parsed data
const buildClipboardSummary = (parsed_data, editedFields = {}) => {
    const get = (key, original) => editedFields.hasOwnProperty(key) ? editedFields[key] : original;
    const currency = parsed_data.currency || 'CAD';
    const lines = [];

    lines.push(`Contract Summary: ${get('customer_name', parsed_data.customer_name) || 'Unknown'}`);
    lines.push('');
    if (parsed_data.total_contract_value > 0) {
        lines.push(`Total Contract Value: ${formatCurrency(parsed_data.total_contract_value)} ${currency}`);
    }
    if (parsed_data.duration) lines.push(`Duration: ${get('duration', parsed_data.duration)}`);
    if (parsed_data.subscription_start) lines.push(`Start: ${get('subscription_start', parsed_data.subscription_start)}`);
    if (parsed_data.subscription_end) lines.push(`End: ${get('subscription_end', parsed_data.subscription_end)}`);
    if (parsed_data.point_of_contact?.name) {
        const name = get('point_of_contact_name', parsed_data.point_of_contact.name);
        const email = get('point_of_contact_email', parsed_data.point_of_contact.email);
        lines.push(`Contact: ${name}${email ? ` (${email})` : ''}`);
    }
    lines.push('');
    if (parsed_data.annual_fees?.length) {
        parsed_data.annual_fees.forEach(fee => {
            lines.push(`Year ${fee.year}: ${formatCurrency(fee.amount)} ${currency}`);
        });
    }
    if (parsed_data.onboarding_fee > 0) {
        lines.push(`Onboarding: ${formatCurrency(parsed_data.onboarding_fee)} ${currency}`);
    }

    return lines.join('\n');
};


// ============================================
// SHARED / SIMPLE COMPONENTS
// ============================================

const ConfidenceBadge = ({ score }) => {
    if (score === undefined || score === null) return null;
    return (
        <span className="confidence-badge" style={{ backgroundColor: getConfidenceColor(score) }} title={getConfidenceLabel(score)}>
            {score}%
        </span>
    );
};

const ExtractedTextDisplay = ({ text, showTags }) => {
    if (!showTags) {
        return <pre className="extracted-content">{stripSourceTags(text)}</pre>;
    }
    const segments = parseExtractedText(text);
    return (
        <pre className="extracted-content">
            {segments.map((segment, idx) => {
                if (segment.type === 'tag') {
                    return <span key={idx} className="source-tag" style={{ backgroundColor: getTagColor(segment.signal) }}>{segment.signal}</span>;
                }
                return <span key={idx}>{segment.content}</span>;
            })}
        </pre>
    );
};

// Theme Toggle Component - Segmented control
const ThemeToggle = ({ theme, onToggle }) => (
    <div className="theme-toggle">
        <button className={`theme-toggle-option ${theme === 'light' ? 'active' : ''}`} onClick={() => theme !== 'light' && onToggle()}>Light</button>
        <button className={`theme-toggle-option ${theme === 'dark' ? 'active' : ''}`} onClick={() => theme !== 'dark' && onToggle()}>Dark</button>
    </div>
);

// Top Bar
const TopBar = ({ title, showBack, onBack, status, onStop, theme, onThemeToggle }) => (
    <header className="topbar">
        <div className="topbar-left">
            {showBack && (
                <button className="back-link" onClick={onBack}>
                    <Icons.ArrowLeft />
                    <span>Back</span>
                </button>
            )}
            {title && <h1 className="topbar-title">{title}</h1>}
        </div>
        <div className="topbar-right">
            {status === 'processing' && (
                <>
                    <div className="status-badge running">Processing</div>
                    <button className="btn btn-secondary" onClick={onStop}>Stop</button>
                </>
            )}
            {status === 'complete' && (
                <div className="status-badge complete">Complete</div>
            )}
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
    </header>
);

// ============================================
// DATA TABLE - Generic reusable table component
// ============================================

const DataTable = ({ columns, data, onRowClick, searchable, pagination, emptyMessage, className, activeRowKey, rowKeyField }) => {
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [columnWidths, setColumnWidths] = useState(() => {
        const widths = {};
        columns.forEach(col => { if (col.width) widths[col.key] = col.width; });
        return widths;
    });
    const resizingRef = useRef(null);

    // Reset page when search changes
    useEffect(() => { setCurrentPage(0); }, [searchQuery]);

    // Filter
    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.toLowerCase();
        return data.filter(row =>
            columns.some(col => {
                const val = row[col.key];
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(q);
            })
        );
    }, [data, searchQuery, columns]);

    // Sort
    const sorted = useMemo(() => {
        if (!sortKey || !sortDir) return filtered;
        return [...filtered].sort((a, b) => {
            let aVal = a[sortKey], bVal = b[sortKey];
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
            }
            const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    // Paginate
    const pageSize = pagination?.enabled ? (pagination.pageSize || 10) : sorted.length;
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const paged = pagination?.enabled ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sorted;

    const handleSort = (key) => {
        if (sortKey === key) {
            if (sortDir === 'asc') setSortDir('desc');
            else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    // Column resize handlers
    const handleResizeStart = (e, colKey) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const th = e.target.closest('th');
        const startWidth = th.offsetWidth;

        const onMove = (me) => {
            const newWidth = Math.max(40, startWidth + (me.clientX - startX));
            setColumnWidths(prev => ({ ...prev, [colKey]: newWidth + 'px' }));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const SortIcon = ({ col }) => {
        if (!col.sortable) return null;
        const active = sortKey === col.key;
        return (
            <span className={`data-table-sort-icon ${active ? 'active' : ''}`}>
                {active && sortDir === 'asc' ? '\u25B2' : active && sortDir === 'desc' ? '\u25BC' : '\u25B4'}
            </span>
        );
    };

    return (
        <div className={`data-table-wrapper ${className || ''}`}>
            {searchable && (
                <div className="data-table-search">
                    <Icons.Search />
                    <input
                        type="text"
                        className="data-table-search-input"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="data-table-search-clear" onClick={() => setSearchQuery('')}>&times;</button>
                    )}
                </div>
            )}
            <div className="data-table-scroll">
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    style={{ width: columnWidths[col.key] || col.width || 'auto', minWidth: col.minWidth || 'auto' }}
                                    className={col.sortable ? 'sortable' : ''}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <span className="data-table-th-content">
                                        {col.label}
                                        <SortIcon col={col} />
                                    </span>
                                    {col.resizable !== false && (
                                        <div
                                            className="data-table-resize-handle"
                                            onMouseDown={e => handleResizeStart(e, col.key)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.length === 0 ? (
                            <tr><td colSpan={columns.length} className="data-table-empty">{emptyMessage || 'No data'}</td></tr>
                        ) : (
                            paged.map((row, idx) => (
                                <tr
                                    key={rowKeyField ? row[rowKeyField] : idx}
                                    className={`${onRowClick ? 'clickable' : ''} ${activeRowKey && rowKeyField && row[rowKeyField] === activeRowKey ? 'active' : ''}`}
                                    onClick={() => onRowClick && onRowClick(row)}
                                >
                                    {columns.map(col => (
                                        <td key={col.key} style={{ width: columnWidths[col.key] || col.width || 'auto' }}>
                                            {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '\u2014')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {pagination?.enabled && totalPages > 1 && (
                <div className="data-table-pagination">
                    <span className="data-table-page-info">{sorted.length} result{sorted.length !== 1 ? 's' : ''}</span>
                    <div className="data-table-page-controls">
                        <button className="data-table-page-btn" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>&lsaquo; Prev</button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button key={i} className={`data-table-page-btn ${currentPage === i ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>{i + 1}</button>
                        ))}
                        <button className="data-table-page-btn" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>Next &rsaquo;</button>
                    </div>
                </div>
            )}
        </div>
    );
};


// ============================================
// HOME VIEW COMPONENTS
// ============================================

const HomeContractTable = ({ contracts, onSelect, onClear }) => {
    if (contracts.length === 0) return null;

    const columns = [
        { key: 'customer_name', label: 'Customer', width: '30%', sortable: true },
        { key: 'duration', label: 'Duration', width: '15%', sortable: true },
        { key: 'total_value', label: 'Total Value', width: '20%', sortable: true, render: (val, row) => val > 0 ? `${formatCurrency(val)} ${row.currency}` : '\u2014' },
        { key: 'date_processed', label: 'Extracted', width: '20%', sortable: true, render: (val) => val ? new Date(val).toLocaleDateString() : '\u2014' },
        { key: 'status', label: 'Status', width: '15%', sortable: false, resizable: false, render: (val) => (
            <span className={`data-table-status-badge ${val === 'Reviewed' ? 'reviewed' : 'pending'}`}>{val}</span>
        )}
    ];

    const tableData = contracts.map(c => ({
        _contract: c,
        customer_name: c.customer_name || 'Unknown',
        duration: c.parsed_data?.duration || '\u2014',
        total_value: c.total_value || 0,
        currency: c.currency || 'CAD',
        date_processed: c.date_processed,
        status: 'Extracted'
    }));

    return (
        <div className="recent-extractions">
            <div className="recent-header">
                <h3 className="recent-title">Recent Extractions</h3>
                <button className="recent-clear" onClick={onClear}>Clear</button>
            </div>
            <DataTable
                columns={columns}
                data={tableData}
                onRowClick={(row) => onSelect(row._contract)}
                searchable={contracts.length > 3}
                pagination={{ enabled: true, pageSize: 5 }}
                emptyMessage="No contracts found"
                rowKeyField="customer_name"
            />
        </div>
    );
};


const Dropzone = ({ onFileSelect }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    return (
        <div
            className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length > 0) onFileSelect(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
        >
            <div className="dropzone-icon"><Icons.Upload /></div>
            <p className="dropzone-title">Drop your MSA here</p>
            <p className="dropzone-subtitle">or click to browse files</p>
            <input ref={fileInputRef} type="file" className="file-input" accept=".pdf" onChange={(e) => { if (e.target.files.length > 0) onFileSelect(e.target.files[0]); }} />
        </div>
    );
};

const HomeView = ({ recentContracts, onFileSelect, onSelectContract, onClearRecents, theme, onThemeToggle }) => (
    <div className="home-view">
        <div className="home-theme-toggle">
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
        <div className="home-header">
            <h1 className="home-title">MSA Extraction Machine</h1>
            <p className="home-tagline">Extract key terms, fees, and dates from Master Service Agreements in seconds.</p>
        </div>
        <HomeContractTable contracts={recentContracts} onSelect={onSelectContract} onClear={onClearRecents} />
        <div className="dropzone-container">
            <Dropzone onFileSelect={onFileSelect} />
            <p className="dropzone-hint">Drop your MSA to extract structured data.</p>
        </div>
    </div>
);

const DuplicateModal = ({ contract, onViewExisting, onProcessAnyway, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h2 className="modal-title">Contract Already Processed</h2>
                <button className="modal-close" onClick={onClose}><Icons.X /></button>
            </div>
            <div className="modal-body">
                <p className="duplicate-message">
                    A contract for <strong>{contract.customer_name}</strong> with value <strong>{formatCurrency(contract.total_value)} {contract.currency}</strong> was already processed.
                </p>
                <div className="duplicate-actions">
                    <button className="btn btn-primary" onClick={onViewExisting}>View Existing</button>
                    <button className="btn btn-secondary" onClick={onProcessAnyway}>Process Anyway</button>
                </div>
            </div>
        </div>
    </div>
);

// ============================================
// PROCESSING VIEW
// ============================================

const ProgressStep = ({ number, label, status, message }) => (
    <div className="progress-step">
        <div className={`step-number ${status}`}>
            {status === 'complete' ? <Icons.Check /> : number}
        </div>
        <div className="step-content">
            <div className="step-label">{label}</div>
            {message && <div className="step-message">{message}</div>}
        </div>
        {status === 'in_progress' && (
            <div className="step-progress-bar"><div className="step-progress-fill indeterminate"></div></div>
        )}
    </div>
);

const ProcessingView = ({ filename, steps }) => {
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const progress = (completedSteps / steps.length) * 100;
    return (
        <div className="processing-card">
            <div className="processing-header">
                <div className="processing-filename"><Icons.FileText /><span>{filename}</span></div>
            </div>
            <div className="progress-steps">
                {steps.map((step, index) => (
                    <ProgressStep key={index} number={index + 1} label={step.label} status={step.status} message={step.message} />
                ))}
            </div>
            <div className="overall-progress">
                <div className="overall-progress-header">
                    <span className="overall-progress-label">Overall Progress</span>
                    <span className="overall-progress-percent">{Math.round(progress)}%</span>
                </div>
                <div className="overall-progress-bar">
                    <div className="overall-progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CHART
// ============================================

const getChartColors = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
        primary: styles.getPropertyValue('--chart-primary').trim(),
        secondary: styles.getPropertyValue('--chart-secondary').trim(),
        textSecondary: styles.getPropertyValue('--text-secondary').trim(),
        borderSubtle: styles.getPropertyValue('--border-subtle').trim(),
        bgSurface: styles.getPropertyValue('--bg-surface').trim(),
        textPrimary: styles.getPropertyValue('--text-primary').trim(),
        borderDefault: styles.getPropertyValue('--border-default').trim()
    };
};

const RevenueChart = ({ annualFees, onboardingFee, currency, theme }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!chartRef.current || annualFees.length === 0) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const colors = getChartColors();
        const ctx = chartRef.current.getContext('2d');
        const labels = annualFees.map(f => `Year ${f.year}`);
        const hasOnboarding = onboardingFee && onboardingFee > 0;

        const datasets = [{
            label: 'Annual Fee',
            data: annualFees.map(f => f.amount),
            backgroundColor: colors.primary,
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            barThickness: 48
        }];

        if (hasOnboarding) {
            datasets.push({
                label: 'Onboarding',
                data: annualFees.map((f, i) => i === 0 ? onboardingFee : 0),
                backgroundColor: colors.secondary,
                borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                barThickness: 48
            });
        }

        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutQuart' },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false, drawBorder: false },
                        ticks: { color: colors.textSecondary, font: { family: 'Inter', size: 12 } }
                    },
                    y: {
                        stacked: true,
                        border: { display: false },
                        grid: { color: colors.borderSubtle, drawBorder: false },
                        ticks: { color: colors.textSecondary, font: { family: 'Inter', size: 12 }, callback: (v) => '$' + v.toLocaleString() }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.bgSurface,
                        titleColor: colors.textPrimary,
                        bodyColor: colors.textSecondary,
                        borderColor: colors.borderDefault,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: { label: (ctx) => ctx.dataset.label + ': ' + formatCurrency(ctx.raw) + ' ' + currency }
                    }
                }
            }
        });

        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [annualFees, onboardingFee, currency, theme]);

    return (
        <div className="review-chart">
            <div className="chart-header">
                <div className="chart-legend">
                    <div className="legend-item"><span className="legend-dot annual"></span>Annual Fee</div>
                    {onboardingFee > 0 && <div className="legend-item"><span className="legend-dot onboarding"></span>Onboarding</div>}
                </div>
            </div>
            <div className="chart-container"><canvas ref={chartRef}></canvas></div>
        </div>
    );
};

// ============================================
// EMAIL SECTION (existing, reused)
// ============================================

const EmailSection = ({ contractData, extractedInfo, gmailAuth, onAuthClick, onSendEmail, onClose }) => {
    const [toEmail, setToEmail] = useState('');
    const [ccEmail, setCcEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [showCc, setShowCc] = useState(false);
    const [feedback, setFeedback] = useState({ show: false, message: '', type: 'success' });

    useEffect(() => {
        if (contractData) {
            const customerName = contractData.customer_name || 'Contract';
            const signingDate = contractData.signatures?.customer?.date || contractData.subscription_start || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            setSubject(`${customerName} MSA - ${signingDate}`);
            setBody(extractedInfo || '');
            if (contractData.point_of_contact?.email) setToEmail(contractData.point_of_contact.email);
        }
    }, [contractData, extractedInfo]);

    const handleSend = async () => {
        if (!toEmail.trim()) {
            setFeedback({ show: true, message: 'Please enter a recipient email', type: 'error' });
            setTimeout(() => setFeedback({ show: false, message: '', type: 'success' }), 3000);
            return;
        }
        setSending(true);
        try {
            const response = await fetch('/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: toEmail, cc: ccEmail || undefined, subject, body })
            });
            const result = await response.json();
            if (result.success) {
                setFeedback({ show: true, message: 'Email sent!', type: 'success' });
                if (onSendEmail) onSendEmail(result);
            } else {
                setFeedback({ show: true, message: result.error || 'Failed to send', type: 'error' });
            }
        } catch (err) {
            setFeedback({ show: true, message: 'Failed: ' + err.message, type: 'error' });
        } finally {
            setSending(false);
            setTimeout(() => setFeedback({ show: false, message: '', type: 'success' }), 4000);
        }
    };

    if (!gmailAuth.authenticated) {
        return (
            <div className="dist-inline-panel">
                <div className="dist-inline-header">
                    <span>Connect Gmail to send</span>
                    {onClose && <button className="dist-inline-close" onClick={onClose}><Icons.X /></button>}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={onAuthClick}><Icons.Link /> Connect Gmail</button>
            </div>
        );
    }

    return (
        <div className="dist-inline-panel">
            <div className="dist-inline-header">
                <span>Send via Gmail</span>
                {gmailAuth.email && <span className="dist-inline-hint">as {gmailAuth.email}</span>}
                {onClose && <button className="dist-inline-close" onClick={onClose}><Icons.X /></button>}
            </div>
            <div className="email-form">
                <div className="email-field">
                    <label className="email-label">To</label>
                    <div className="email-input-row">
                        <input type="email" className="email-input" placeholder="recipient@example.com" value={toEmail} onChange={e => setToEmail(e.target.value)} />
                        {!showCc && <button className="email-add-cc" onClick={() => setShowCc(true)}>+ CC</button>}
                    </div>
                </div>
                {showCc && (
                    <div className="email-field">
                        <label className="email-label">CC</label>
                        <input type="email" className="email-input" placeholder="cc@example.com" value={ccEmail} onChange={e => setCcEmail(e.target.value)} />
                    </div>
                )}
                <div className="email-field">
                    <label className="email-label">Subject</label>
                    <input type="text" className="email-input" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div className="email-field">
                    <label className="email-label">Body</label>
                    <textarea className="email-textarea" value={body} onChange={e => setBody(e.target.value)} rows={8} />
                </div>
                <div className="email-actions">
                    <button className="btn btn-secondary btn-sm" onClick={handleSend} disabled={sending}>
                        {sending ? 'Sending...' : <><Icons.Send /> Send</>}
                    </button>
                </div>
                {feedback.show && <div className={`email-feedback ${feedback.type}`}>{feedback.message}</div>}
            </div>
        </div>
    );
};


// ============================================
// NEW REVIEW COMPONENTS
// ============================================

// Page Reference Pill - clickable, scrolls PDF
const PageRefPill = ({ pages, onClick }) => {
    if (!pages || pages.length === 0) return null;
    const label = pages.length === 1 ? `p.${pages[0]}` : `p.${pages.join(',')}`;
    return (
        <button className="page-ref-pill" onClick={(e) => { e.stopPropagation(); onClick(pages[0]); }} title={`Found on page ${pages.join(', ')}`}>
            {label}
        </button>
    );
};

// Verify Checkbox
const VerifyCheckbox = ({ checked, onChange }) => (
    <button className={`verify-checkbox ${checked ? 'checked' : ''}`} onClick={(e) => { e.stopPropagation(); onChange(!checked); }}>
        {checked && <Icons.Check />}
    </button>
);


// ReviewFieldTable - DataTable wrapper for field verification
const ReviewFieldTable = ({
    fields, parsed_data, verifiedFields, activeField, confidence,
    editingField, editValue, editedFields,
    onToggleVerify, onActivate, onScrollToPage, onStartEdit, onSaveEdit, onCancelEdit, onEditChange
}) => {
    const columns = [
        {
            key: 'verified', label: '', width: '40px', minWidth: '40px', sortable: false, resizable: false,
            render: (_, row) => (
                <VerifyCheckbox
                    checked={verifiedFields.has(row.key)}
                    onChange={() => onToggleVerify(row.key)}
                />
            )
        },
        { key: 'label', label: 'Field', width: '25%', sortable: true },
        {
            key: 'value', label: 'Value', sortable: true,
            render: (val, row) => {
                const isEditing = editingField === row.key;
                const displayValue = editedFields[row.key] !== undefined ? editedFields[row.key] : val;
                if (isEditing) {
                    return (
                        <div className="field-row-edit" onClick={e => e.stopPropagation()}>
                            <input type="text" className="edit-input" value={editValue}
                                onChange={e => onEditChange(e.target.value)} autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(row.key); if (e.key === 'Escape') onCancelEdit(); }}
                            />
                            <button className="edit-btn save" onClick={() => onSaveEdit(row.key)}>Save</button>
                            <button className="edit-btn cancel" onClick={() => onCancelEdit()}>Cancel</button>
                        </div>
                    );
                }
                return (
                    <span className="field-table-value-cell">
                        {row.isLink ? (
                            <a href={`mailto:${displayValue}`} className="field-row-value link" onClick={e => e.stopPropagation()}>{displayValue}</a>
                        ) : (
                            <span className="field-row-value">{displayValue || '\u2014'}</span>
                        )}
                        {editedFields[row.key] !== undefined && <span className="edited-tag">Edited</span>}
                    </span>
                );
            }
        },
        {
            key: 'confidence', label: 'Conf.', width: '72px', sortable: true,
            render: (val) => val !== undefined && val !== null ? <ConfidenceBadge score={val} /> : null
        },
        {
            key: 'pageRefs', label: 'Page', width: '60px', sortable: false, resizable: false,
            render: (val) => <PageRefPill pages={val} onClick={onScrollToPage} />
        },
        {
            key: 'edit', label: '', width: '40px', minWidth: '40px', sortable: false, resizable: false,
            render: (_, row) => editingField !== row.key ? (
                <button className="edit-pencil" onClick={(e) => { e.stopPropagation(); const dv = editedFields[row.key] !== undefined ? editedFields[row.key] : row.value; onStartEdit(row.key, dv); }} title="Edit">
                    <Icons.Pencil />
                </button>
            ) : null
        }
    ];

    const tableData = fields.map(f => ({
        key: f.key,
        label: f.label,
        value: f.value,
        isLink: f.isLink,
        confidence: confidence[f.key] || confidence[f.key.replace('_name', '').replace('_email', '')] || null,
        pageRefs: getPageRef(parsed_data, f.key),
        edit: null
    }));

    return (
        <DataTable
            columns={columns}
            data={tableData}
            onRowClick={(row) => onActivate(row.key)}
            activeRowKey={activeField}
            rowKeyField="key"
            className="review-field-table"
        />
    );
};

// SummaryCard - key metrics at a glance
const SummaryCard = ({ parsed_data }) => {
    const currency = parsed_data.currency || 'CAD';
    return (
        <div className="summary-card">
            <div className="summary-card-value">
                {parsed_data.total_contract_value > 0
                    ? formatCurrency(parsed_data.total_contract_value)
                    : '\u2014'}
                {parsed_data.total_contract_value > 0 && <span className="summary-card-currency">{currency}</span>}
            </div>
            <div className="summary-card-customer">{parsed_data.customer_name || 'Unknown Customer'}</div>
            <div className="summary-card-meta">
                {parsed_data.duration && <span>{parsed_data.duration}</span>}
                {parsed_data.duration && parsed_data.subscription_start && <span className="summary-card-sep">/</span>}
                {parsed_data.subscription_start && <span>{parsed_data.subscription_start} - {parsed_data.subscription_end || '?'}</span>}
            </div>
        </div>
    );
};

// VerificationProgress - sticky bar
const VerificationProgress = ({ verified, total, onMarkAll }) => {
    const pct = total > 0 ? (verified / total) * 100 : 0;
    return (
        <div className="verification-progress">
            <div className="verification-progress-text">
                <span>{verified} / {total} fields verified</span>
                {pct >= 50 && pct < 100 && (
                    <button className="verification-mark-all" onClick={onMarkAll}>Mark All Verified</button>
                )}
                {pct >= 100 && <span className="verification-complete">All verified</span>}
            </div>
            <div className="verification-progress-bar">
                <div className="verification-progress-fill" style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
};

// ExpandableSection
const ExpandableSection = ({ title, fieldCount, isExpanded, onToggle, children }) => (
    <div className={`expandable-section ${isExpanded ? 'expanded' : ''}`}>
        <button className="expandable-section-header" onClick={onToggle}>
            <span className={`expandable-chevron ${isExpanded ? 'rotated' : ''}`}>
                <Icons.ChevronRight />
            </span>
            <span className="expandable-section-title">{title}</span>
            {fieldCount !== undefined && <span className="expandable-section-count">{fieldCount}</span>}
        </button>
        {isExpanded && <div className="expandable-section-body">{children}</div>}
    </div>
);

// SlackPanel - inline
const SlackPanel = ({ parsed_data, onClose }) => {
    const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem(SLACK_WEBHOOK_KEY) || '');
    const [posting, setPosting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const handlePost = async () => {
        if (!webhookUrl.trim()) { setFeedback({ type: 'error', message: 'Enter a webhook URL' }); return; }
        localStorage.setItem(SLACK_WEBHOOK_KEY, webhookUrl);
        setPosting(true);
        try {
            const resp = await fetch('/send-slack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhook_url: webhookUrl, parsed_data })
            });
            const result = await resp.json();
            if (result.success) {
                setFeedback({ type: 'success', message: 'Posted to Slack' });
            } else {
                setFeedback({ type: 'error', message: result.error || 'Failed' });
            }
        } catch (err) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setPosting(false);
            setTimeout(() => setFeedback(null), 4000);
        }
    };

    return (
        <div className="dist-inline-panel">
            <div className="dist-inline-header">
                <span>Post to Slack</span>
                <button className="dist-inline-close" onClick={onClose}><Icons.X /></button>
            </div>
            <div className="dist-inline-field">
                <label className="email-label">Webhook URL</label>
                <input type="url" className="email-input" placeholder="https://hooks.slack.com/services/..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handlePost} disabled={posting}>
                {posting ? 'Posting...' : 'Post'}
            </button>
            {feedback && <div className={`email-feedback ${feedback.type}`}>{feedback.message}</div>}
        </div>
    );
};

// SheetsPanel - inline
const SheetsPanel = ({ parsed_data, editedFields, gmailAuth, onAuthClick, onClose }) => {
    const [sheetsId, setSheetsId] = useState(() => localStorage.getItem(SHEETS_ID_KEY) || '');
    const [pushing, setPushing] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const handlePush = async () => {
        if (!sheetsId.trim()) { setFeedback({ type: 'error', message: 'Enter a Google Sheet ID' }); return; }
        localStorage.setItem(SHEETS_ID_KEY, sheetsId);
        setPushing(true);
        try {
            const resp = await fetch('/push-to-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheet_id: sheetsId, parsed_data })
            });
            const result = await resp.json();
            if (result.success) {
                setFeedback({ type: 'success', message: 'Added to sheet' });
            } else {
                setFeedback({ type: 'error', message: result.error || 'Failed' });
            }
        } catch (err) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setPushing(false);
            setTimeout(() => setFeedback(null), 4000);
        }
    };

    return (
        <div className="dist-inline-panel">
            <div className="dist-inline-header">
                <span>Push to Sheets / Download</span>
                <button className="dist-inline-close" onClick={onClose}><Icons.X /></button>
            </div>

            {/* Download options */}
            <div className="sheets-download-row">
                <button className="btn btn-secondary btn-sm" onClick={() => exportToExcel(parsed_data, editedFields)}>
                    <Icons.Download /> Excel
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(parsed_data, editedFields)}>
                    <Icons.Download /> CSV
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToJSON(parsed_data, editedFields)}>
                    <Icons.Download /> JSON
                </button>
            </div>

            {/* Google Sheets push */}
            <div className="sheets-divider"><span>or push to Google Sheets</span></div>
            {!gmailAuth.authenticated ? (
                <button className="btn btn-secondary btn-sm" onClick={onAuthClick}><Icons.Link /> Connect Google</button>
            ) : (
                <>
                    <div className="dist-inline-field">
                        <label className="email-label">Spreadsheet ID</label>
                        <input type="text" className="email-input" placeholder="Sheet ID from URL" value={sheetsId} onChange={e => setSheetsId(e.target.value)} />
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handlePush} disabled={pushing}>
                        {pushing ? 'Pushing...' : 'Push Row'}
                    </button>
                </>
            )}
            {feedback && <div className={`email-feedback ${feedback.type}`}>{feedback.message}</div>}
        </div>
    );
};

// DistributionPanel - 4 action buttons, locked until threshold
const DistributionPanel = ({ isUnlocked, verificationPct, activeAction, onAction, parsed_data, editedFields, extractedInfo, gmailAuth, onGmailAuthClick, onSendEmail }) => {
    return (
        <div className={`distribution-panel ${isUnlocked ? 'unlocked' : 'locked'}`}>
            <div className="distribution-header">
                <span className="distribution-title">
                    {isUnlocked ? 'Distribute' : <><Icons.Lock /> Verify {Math.round(80 - verificationPct * 100)}% more to unlock</>}
                </span>
            </div>
            <div className="distribution-buttons">
                <button className="dist-btn" disabled={!isUnlocked} onClick={() => onAction('copy')}>
                    <Icons.Copy /><span>Copy</span>
                </button>
                <button className={`dist-btn ${activeAction === 'email' ? 'active' : ''}`} disabled={!isUnlocked} onClick={() => onAction(activeAction === 'email' ? null : 'email')}>
                    <Icons.Mail /><span>Email</span>
                </button>
                <button className={`dist-btn ${activeAction === 'slack' ? 'active' : ''}`} disabled={!isUnlocked} onClick={() => onAction(activeAction === 'slack' ? null : 'slack')}>
                    <Icons.Slack /><span>Slack</span>
                </button>
                <button className={`dist-btn ${activeAction === 'sheets' ? 'active' : ''}`} disabled={!isUnlocked} onClick={() => onAction(activeAction === 'sheets' ? null : 'sheets')}>
                    <Icons.Table /><span>Sheet</span>
                </button>
            </div>

            {activeAction === 'email' && isUnlocked && (
                <EmailSection
                    contractData={parsed_data}
                    extractedInfo={extractedInfo}
                    gmailAuth={gmailAuth}
                    onAuthClick={onGmailAuthClick}
                    onSendEmail={onSendEmail}
                    onClose={() => onAction(null)}
                />
            )}
            {activeAction === 'slack' && isUnlocked && (
                <SlackPanel parsed_data={parsed_data} onClose={() => onAction(null)} />
            )}
            {activeAction === 'sheets' && isUnlocked && (
                <SheetsPanel parsed_data={parsed_data} editedFields={editedFields} gmailAuth={gmailAuth} onAuthClick={onGmailAuthClick} onClose={() => onAction(null)} />
            )}
        </div>
    );
};


// ============================================
// REVIEW VIEW - The core left panel
// ============================================

const ReviewView = ({ data, pdfId, theme, gmailAuth, onGmailAuthClick, onSendEmail, scrollToPage, onScrollToPage, onCopyFeedback }) => {
    const parsed_data = data.parsed_data;
    const confidence = parsed_data.confidence || {};

    // Verification state
    const [verifiedFields, setVerifiedFields] = useState(new Set());
    const [activeField, setActiveField] = useState(null);
    const [expandedSections, setExpandedSections] = useState(new Set(['contract_details', 'fees_revenue']));
    const [distributionAction, setDistributionAction] = useState(null);

    // Edit state
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [editedFields, setEditedFields] = useState({});

    // Source tags
    const [showSourceTags, setShowSourceTags] = useState(true);

    // Derive fields list
    const verifiableFields = useMemo(() => getVerifiableFields(parsed_data), [parsed_data]);
    const verificationProgress = verifiableFields.length > 0 ? verifiedFields.size / verifiableFields.length : 0;
    const isDistributionUnlocked = verificationProgress >= 0.8;

    // Section fields
    const contractFields = verifiableFields.filter(f => f.section === 'contract_details');
    const feeFields = verifiableFields.filter(f => f.section === 'fees_revenue');
    const sigFields = verifiableFields.filter(f => f.section === 'signatures');

    const toggleVerify = (key) => {
        setVerifiedFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const markAllVerified = () => {
        setVerifiedFields(new Set(verifiableFields.map(f => f.key)));
    };

    const handleActivate = (key) => {
        setActiveField(key);
        const pages = getPageRef(parsed_data, key);
        if (pages.length > 0 && onScrollToPage) {
            onScrollToPage(pages[0]);
        }
    };

    const handleScrollToPage = (page) => {
        if (onScrollToPage) onScrollToPage(page);
    };

    const handleStartEdit = (key, value) => {
        setEditingField(key);
        setEditValue(value || '');
    };
    const handleSaveEdit = (key) => {
        setEditedFields(prev => ({ ...prev, [key]: editValue }));
        setEditingField(null);
        setEditValue('');
    };
    const handleCancelEdit = () => {
        setEditingField(null);
        setEditValue('');
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section); else next.add(section);
            return next;
        });
    };

    const handleDistributionAction = async (action) => {
        if (action === 'copy') {
            const text = buildClipboardSummary(parsed_data, editedFields);
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            if (onCopyFeedback) onCopyFeedback('Summary copied to clipboard');
            return;
        }
        setDistributionAction(action);
    };

    const fieldTableProps = {
        parsed_data, verifiedFields, activeField, confidence,
        editingField, editValue, editedFields,
        onToggleVerify: toggleVerify, onActivate: handleActivate,
        onScrollToPage: handleScrollToPage, onStartEdit: handleStartEdit,
        onSaveEdit: handleSaveEdit, onCancelEdit: handleCancelEdit,
        onEditChange: setEditValue
    };

    return (
        <div className="review-view">
            {/* Summary Card */}
            <SummaryCard parsed_data={parsed_data} />

            {/* Verification Progress */}
            <VerificationProgress
                verified={verifiedFields.size}
                total={verifiableFields.length}
                onMarkAll={markAllVerified}
            />

            {/* Contract Details */}
            {contractFields.length > 0 && (
                <ExpandableSection
                    title="Contract Details"
                    fieldCount={contractFields.length}
                    isExpanded={expandedSections.has('contract_details')}
                    onToggle={() => toggleSection('contract_details')}
                >
                    <ReviewFieldTable fields={contractFields} {...fieldTableProps} />
                </ExpandableSection>
            )}

            {/* Fees & Revenue */}
            {feeFields.length > 0 && (
                <ExpandableSection
                    title="Fees & Revenue"
                    fieldCount={feeFields.length}
                    isExpanded={expandedSections.has('fees_revenue')}
                    onToggle={() => toggleSection('fees_revenue')}
                >
                    <ReviewFieldTable fields={feeFields} {...fieldTableProps} />
                    {/* Revenue Chart embedded at bottom of this section */}
                    {parsed_data.annual_fees?.length > 0 && (
                        <RevenueChart
                            annualFees={parsed_data.annual_fees}
                            onboardingFee={parsed_data.onboarding_fee}
                            currency={parsed_data.currency}
                            theme={theme}
                        />
                    )}
                </ExpandableSection>
            )}

            {/* Signatures & Terms */}
            {sigFields.length > 0 && (
                <ExpandableSection
                    title="Signatures & Terms"
                    fieldCount={sigFields.length}
                    isExpanded={expandedSections.has('signatures')}
                    onToggle={() => toggleSection('signatures')}
                >
                    <ReviewFieldTable fields={sigFields} {...fieldTableProps} />
                </ExpandableSection>
            )}

            {/* Full Extracted Text */}
            <ExpandableSection
                title="Full Extracted Text"
                isExpanded={expandedSections.has('raw_text')}
                onToggle={() => toggleSection('raw_text')}
            >
                <div className="extracted-section-inner">
                    <div className="extracted-actions">
                        <button
                            className={`btn btn-secondary btn-sm source-toggle ${!showSourceTags ? 'active' : ''}`}
                            onClick={() => setShowSourceTags(!showSourceTags)}
                        >
                            <Icons.Sparkle />
                            <span>Clean: {showSourceTags ? 'OFF' : 'ON'}</span>
                        </button>
                    </div>
                    <ExtractedTextDisplay text={data.extracted_info} showTags={showSourceTags} />
                </div>
            </ExpandableSection>

            {/* Distribution Panel */}
            <DistributionPanel
                isUnlocked={isDistributionUnlocked}
                verificationPct={verificationProgress}
                activeAction={distributionAction}
                onAction={handleDistributionAction}
                parsed_data={parsed_data}
                editedFields={editedFields}
                extractedInfo={data.extracted_info}
                gmailAuth={gmailAuth}
                onGmailAuthClick={onGmailAuthClick}
                onSendEmail={onSendEmail}
            />
        </div>
    );
};


// ============================================
// PDF VIEWER with scroll-to-page
// ============================================

const PDFViewerPanel = ({ pdfId, scrollToPage: targetPage }) => {
    const containerRef = useRef(null);
    const canvasRefs = useRef({});
    const textLayerRefs = useRef({});
    const [pdfDoc, setPdfDoc] = useState(null);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.25);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [renderedPages, setRenderedPages] = useState(new Set());

    // Load PDF document
    useEffect(() => {
        if (!pdfId) return;
        setLoading(true);
        setError(null);
        setRenderedPages(new Set());

        const loadPdf = async () => {
            try {
                const pdf = await pdfjsLib.getDocument(`/pdf/${pdfId}`).promise;
                setPdfDoc(pdf);
                setTotalPages(pdf.numPages);
                setLoading(false);
            } catch (err) {
                setError('Failed to load PDF');
                setLoading(false);
            }
        };
        loadPdf();
    }, [pdfId]);

    // Render a single page to canvas + text layer
    const renderPage = async (pageNum) => {
        if (!pdfDoc || !canvasRefs.current[pageNum]) return;
        if (renderedPages.has(`${pageNum}-${scale}`)) return;

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current[pageNum];
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        // Render text layer for highlighting
        const textContent = await page.getTextContent();
        const textLayerDiv = textLayerRefs.current[pageNum];
        if (textLayerDiv) {
            textLayerDiv.innerHTML = '';
            textLayerDiv.style.width = viewport.width + 'px';
            textLayerDiv.style.height = viewport.height + 'px';

            textContent.items.forEach(item => {
                const span = document.createElement('span');
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                span.textContent = item.str;
                span.style.position = 'absolute';
                span.style.left = tx[4] + 'px';
                span.style.top = (viewport.height - tx[5]) + 'px';
                span.style.fontSize = Math.abs(tx[0]) + 'px';
                span.style.fontFamily = item.fontName || 'sans-serif';
                span.style.whiteSpace = 'pre';
                span.style.color = 'transparent';
                textLayerDiv.appendChild(span);
            });
        }

        setRenderedPages(prev => new Set([...prev, `${pageNum}-${scale}`]));
    };

    // Render all pages when PDF loads or scale changes
    useEffect(() => {
        if (!pdfDoc) return;
        setRenderedPages(new Set());

        const renderAllPages = async () => {
            for (let i = 1; i <= totalPages; i++) {
                await renderPage(i);
            }
        };
        renderAllPages();
    }, [pdfDoc, scale, totalPages]);

    // Scroll to page when targetPage changes
    useEffect(() => {
        if (targetPage && containerRef.current) {
            const target = containerRef.current.querySelector(`.pdf-page-wrapper:nth-child(${targetPage})`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [targetPage]);

    if (!pdfId) return null;

    return (
        <div className="pdf-panel">
            <div className="pdf-panel-header">
                <span className="pdf-panel-title">Source Document</span>
                <div className="pdf-zoom-controls">
                    <button className="pdf-zoom-btn" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}><Icons.ZoomOut /></button>
                    <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
                    <button className="pdf-zoom-btn" onClick={() => setScale(s => Math.min(2.0, s + 0.25))}><Icons.ZoomIn /></button>
                </div>
            </div>

            <div className="pdf-panel-content" ref={containerRef}>
                {loading && <div className="pdf-loading">Loading PDF...</div>}
                {error && <div className="pdf-error">{error}</div>}
                {!loading && !error && (
                    <div className="pdf-pages-container">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                            <div key={pageNum} className="pdf-page-wrapper">
                                <canvas ref={el => canvasRefs.current[pageNum] = el} className="pdf-canvas" />
                                <div ref={el => textLayerRefs.current[pageNum] = el} className="pdf-text-layer"></div>
                                <div className="pdf-page-number">Page {pageNum} of {totalPages}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================
// FEEDBACK & OVERLAY COMPONENTS
// ============================================

const CopyFeedback = ({ show, message }) => (
    <div className={`copy-feedback ${show ? 'show' : ''}`}>{message}</div>
);

const GrainOverlay = () => (
    <div className="grain-overlay" />
);


// ============================================
// MAIN APP
// ============================================

const App = () => {
    const [view, setView] = useState('home');
    const [recentContracts, setRecentContracts] = useState([]);
    const [currentContract, setCurrentContract] = useState(null);
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState({ show: false, message: '' });
    const [duplicateContract, setDuplicateContract] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [theme, setTheme] = useState(() => initTheme());
    const [steps, setSteps] = useState([
        { label: 'Validating file', status: 'pending', message: '' },
        { label: 'Extracting text from PDF', status: 'pending', message: '' },
        { label: 'Analyzing contract with AI', status: 'pending', message: '' },
        { label: 'Generating summary', status: 'pending', message: '' }
    ]);
    const [gmailAuth, setGmailAuth] = useState({ authenticated: false, email: null });
    const [pdfId, setPdfId] = useState(null);
    const [scrollToPage, setScrollToPage] = useState(null);


    const abortControllerRef = useRef(null);

    useEffect(() => {
        setRecentContracts(getRecentContracts());
        checkGmailAuthStatus();
    }, []);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'gmail_auth_success') checkGmailAuthStatus();
            else if (event.data?.type === 'gmail_auth_error') setError('Gmail authorization failed: ' + event.data.error);
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const checkGmailAuthStatus = async () => {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            setGmailAuth({ authenticated: data.authenticated, email: data.email });
        } catch (err) {
            console.error('Failed to check Gmail auth status:', err);
        }
    };

    const handleGmailAuthClick = async () => {
        try {
            const response = await fetch('/auth/gmail');
            const data = await response.json();
            if (data.success && data.authorization_url) {
                const width = 600, height = 700;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;
                window.open(data.authorization_url, 'Gmail Authorization', `width=${width},height=${height},left=${left},top=${top}`);
            } else {
                setError(data.error || 'Failed to start authorization');
            }
        } catch (err) {
            setError('Failed to connect: ' + err.message);
        }
    };

    const handleSendEmail = (result) => {
        setCopyFeedback({ show: true, message: 'Email sent!' });
        setTimeout(() => setCopyFeedback({ show: false, message: '' }), 3000);
    };

    const handleCopyFeedback = (message) => {
        setCopyFeedback({ show: true, message });
        setTimeout(() => setCopyFeedback({ show: false, message: '' }), 2000);
    };

    const processFile = async (selectedFile) => {
        setFile(selectedFile);
        setView('processing');
        setCurrentContract(null);
        setSteps(steps.map(s => ({ ...s, status: 'pending', message: '' })));

        const formData = new FormData();
        formData.append('file', selectedFile);

        const updateStep = (stepIndex, status, message) => {
            setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, status, message } : s));
        };

        try {
            updateStep(0, 'in_progress', 'Checking file...');
            await new Promise(r => setTimeout(r, 500));
            updateStep(0, 'complete', 'File validated');

            updateStep(1, 'in_progress', 'Reading PDF content...');
            abortControllerRef.current = new AbortController();

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
                signal: abortControllerRef.current.signal
            });

            updateStep(1, 'complete', 'Text extracted');
            updateStep(2, 'in_progress', 'Claude is analyzing the contract...');
            await new Promise(r => setTimeout(r, 300));
            updateStep(2, 'complete', 'Analysis complete');
            updateStep(3, 'in_progress', 'Preparing summary...');

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            updateStep(3, 'complete', 'Summary generated');
            await new Promise(r => setTimeout(r, 500));

            saveContract(result);
            setRecentContracts(getRecentContracts());
            if (result.pdf_id) setPdfId(result.pdf_id);
            setCurrentContract(result);
            setView('detail');
        } catch (err) {
            if (err.name === 'AbortError') { setView('home'); return; }
            setError(err.message || 'An error occurred during processing');
            setView('home');
        }
    };

    const handleFileSelect = async (selectedFile) => {
        if (selectedFile.type !== 'application/pdf') { setError('Please select a PDF file'); return; }
        processFile(selectedFile);
    };

    const handleStop = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setView('home');
        setSteps(steps.map(s => ({ ...s, status: 'pending', message: '' })));
    };

    const handleSelectContract = (contract) => {
        setCurrentContract({
            parsed_data: contract.parsed_data,
            extracted_info: contract.extracted_info,
            summary: contract.summary
        });
        setPdfId(contract.pdf_id || null);
        setView('detail');
    };

    const handleClearRecents = () => {
        clearRecentContracts();
        setRecentContracts([]);
    };

    const handleThemeToggle = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        applyTheme(newTheme);
        setStoredTheme(newTheme);
    };

    const handleBack = () => {
        setCurrentContract(null);
        setPdfId(null);
        setScrollToPage(null);
        setView('home');
    };

    const handleScrollToPage = (page) => {
        // Force re-trigger by toggling with null
        setScrollToPage(null);
        setTimeout(() => {
            setScrollToPage(page);
        }, 50);
    };

    const showTopBar = view !== 'home';
    const getStatus = () => {
        if (view === 'processing') return 'processing';
        if (view === 'detail') return 'complete';
        return null;
    };

    return (
        <div className="app-layout">
            <div className="content-pane">
                {showTopBar && (
                    <TopBar
                        title=""
                        showBack={true}
                        onBack={handleBack}
                        status={getStatus()}
                        onStop={handleStop}
                        theme={theme}
                        onThemeToggle={handleThemeToggle}
                    />
                )}

                <main className={`main-content ${!showTopBar ? 'no-topbar' : ''}`}>
                    <div className="content-area">
                        {error && (
                            <div className="error-banner">
                                <Icons.AlertCircle />
                                <span>{error}</span>
                                <button onClick={() => setError(null)}><Icons.X /></button>
                            </div>
                        )}

                        {view === 'home' && (
                            <HomeView
                                recentContracts={recentContracts}
                                onFileSelect={handleFileSelect}
                                onSelectContract={handleSelectContract}
                                onClearRecents={handleClearRecents}
                                theme={theme}
                                onThemeToggle={handleThemeToggle}
                            />
                        )}

                        {view === 'processing' && (
                            <ProcessingView filename={file?.name || 'document.pdf'} steps={steps} />
                        )}

                        {view === 'detail' && currentContract && (
                            <div className={`contract-detail-layout ${pdfId ? 'with-pdf' : ''}`}>
                                <div className="contract-detail-main">
                                    <ReviewView
                                        data={currentContract}
                                        pdfId={pdfId}
                                        theme={theme}
                                        gmailAuth={gmailAuth}
                                        onGmailAuthClick={handleGmailAuthClick}
                                        onSendEmail={handleSendEmail}
                                        scrollToPage={scrollToPage}
                                        onScrollToPage={handleScrollToPage}
                                        onCopyFeedback={handleCopyFeedback}
                                    />
                                </div>
                                <PDFViewerPanel pdfId={pdfId} scrollToPage={scrollToPage} />
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {duplicateContract && (
                <DuplicateModal
                    contract={duplicateContract}
                    onViewExisting={() => { handleSelectContract(duplicateContract); setDuplicateContract(null); setPendingFile(null); }}
                    onProcessAnyway={() => { setDuplicateContract(null); if (pendingFile) { processFile(pendingFile); setPendingFile(null); } }}
                    onClose={() => { setDuplicateContract(null); setPendingFile(null); }}
                />
            )}

            <CopyFeedback show={copyFeedback.show} message={copyFeedback.message} />
            <GrainOverlay />
        </div>
    );
};

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
