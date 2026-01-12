/**
 * Contract Extractor V4 - Technical Dark Mode Console
 * Singular-purpose tool: Extract contract data from PDF
 */

const { useState, useEffect, useRef } = React;

// localStorage keys
const STORAGE_KEY = 'contract_extractor_history';
const MAX_HISTORY = 5;

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

const contractExists = (data) => {
    const history = getRecentContracts();
    const newId = generateContractId(data);
    return history.find(c => c.id === newId);
};

const saveContract = (data) => {
    const history = getRecentContracts();
    const newId = generateContractId(data);

    // Check if already exists
    const existingIndex = history.findIndex(c => c.id === newId);
    if (existingIndex !== -1) {
        // Move to front (most recent)
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
        summary: data.summary
    };

    // Add to front
    history.unshift(contractRecord);

    // Limit to MAX_HISTORY
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
    try {
        return localStorage.getItem(THEME_KEY) || 'light';
    } catch {
        return 'light';
    }
};

const setStoredTheme = (theme) => {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        // Ignore storage errors
    }
};

const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
};

// Initialize theme on load
const initTheme = () => {
    const theme = getStoredTheme();
    applyTheme(theme);
    return theme;
};

// Icons as SVG components (minimal set)
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
    Square: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        </svg>
    ),
    Sun: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
    ),
    Moon: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
    ),
    Mail: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
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
    )
};

// Format currency - returns "$X,XXX" format (no currency prefix like CA$ or US$)
const formatCurrency = (amount) => {
    return '$' + new Intl.NumberFormat('en-CA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Top Bar Component - Only shows on non-home views
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
                    <div className="status-badge running">
                        Processing
                    </div>
                    <button className="btn btn-secondary" onClick={onStop}>
                        Stop
                    </button>
                </>
            )}
            {status === 'complete' && (
                <div className="status-badge complete">
                    Complete
                </div>
            )}
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
    </header>
);

// Theme Toggle Component
const ThemeToggle = ({ theme, onToggle }) => (
    <button className="theme-toggle" onClick={onToggle} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
        {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
        <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
);

// Recent Extractions Component
const RecentExtractions = ({ contracts, onSelect, onClear }) => {
    if (contracts.length === 0) return null;

    return (
        <div className="recent-extractions">
            <div className="recent-header">
                <h3 className="recent-title">Recent Extractions</h3>
                <button className="recent-clear" onClick={onClear}>
                    Clear
                </button>
            </div>
            <div className="recent-list">
                {contracts.map((contract) => (
                    <button
                        key={contract.id}
                        className="recent-row"
                        onClick={() => onSelect(contract)}
                    >
                        <span className="recent-customer">{contract.customer_name}</span>
                        <span className="recent-value">
                            {formatCurrency(contract.total_value)} {contract.currency || 'CAD'}
                        </span>
                        <span className="recent-arrow">
                            <Icons.ArrowRight />
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// Dropzone Component (inline, not modal)
const Dropzone = ({ onFileSelect }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    };

    return (
        <div
            className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <div className="dropzone-icon">
                <Icons.Upload />
            </div>
            <p className="dropzone-title">Drop your MSA here</p>
            <p className="dropzone-subtitle">or click to browse files</p>
            <input
                ref={fileInputRef}
                type="file"
                className="file-input"
                accept=".pdf"
                onChange={handleFileChange}
            />
        </div>
    );
};

// Home View Component
const HomeView = ({ recentContracts, onFileSelect, onSelectContract, onClearRecents, theme, onThemeToggle }) => (
    <div className="home-view">
        <div className="home-theme-toggle">
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
        <div className="home-header">
            <h1 className="home-title">MSA Extraction Machine</h1>
            <p className="home-tagline">
                Extract key terms, fees, and dates from Master Service Agreements in seconds.
            </p>
        </div>
        <RecentExtractions contracts={recentContracts} onSelect={onSelectContract} onClear={onClearRecents} />
        <div className="dropzone-container">
            <Dropzone onFileSelect={onFileSelect} />
            <p className="dropzone-hint">Drop your MSA to extract structured data.</p>
        </div>
    </div>
);

// Duplicate Modal Component
const DuplicateModal = ({ contract, onViewExisting, onProcessAnyway, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h2 className="modal-title">Contract Already Processed</h2>
                <button className="modal-close" onClick={onClose}>
                    <Icons.X />
                </button>
            </div>
            <div className="modal-body">
                <p className="duplicate-message">
                    A contract for <strong>{contract.customer_name}</strong> with value <strong>{formatCurrency(contract.total_value)} {contract.currency}</strong> was already processed.
                </p>
                <div className="duplicate-actions">
                    <button className="btn btn-primary" onClick={onViewExisting}>
                        View Existing
                    </button>
                    <button className="btn btn-secondary" onClick={onProcessAnyway}>
                        Process Anyway
                    </button>
                </div>
            </div>
        </div>
    </div>
);

// Progress Step Component
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
            <div className="step-progress-bar">
                <div className="step-progress-fill indeterminate"></div>
            </div>
        )}
        {status === 'complete' && (
            <span className="step-check"></span>
        )}
    </div>
);

// Processing View Component
const ProcessingView = ({ filename, steps }) => {
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const totalSteps = steps.length;
    const progress = (completedSteps / totalSteps) * 100;

    return (
        <div className="processing-card">
            <div className="processing-header">
                <div className="processing-filename">
                    <Icons.FileText />
                    <span>{filename}</span>
                </div>
            </div>

            <div className="progress-steps">
                {steps.map((step, index) => (
                    <ProgressStep
                        key={index}
                        number={index + 1}
                        label={step.label}
                        status={step.status}
                        message={step.message}
                    />
                ))}
            </div>

            <div className="overall-progress">
                <div className="overall-progress-header">
                    <span className="overall-progress-label">Overall Progress</span>
                    <span className="overall-progress-percent">{Math.round(progress)}%</span>
                </div>
                <div className="overall-progress-bar">
                    <div
                        className="overall-progress-fill"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

// Get CSS variable values for chart theming
const getChartColors = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
        primary: styles.getPropertyValue('--chart-primary').trim(),
        secondary: styles.getPropertyValue('--chart-secondary').trim(),
        textSecondary: styles.getPropertyValue('--text-secondary').trim(),
        borderSubtle: styles.getPropertyValue('--border-subtle').trim(),
        bgElevated: styles.getPropertyValue('--bg-elevated').trim(),
        bgSurface: styles.getPropertyValue('--bg-surface').trim(),
        textPrimary: styles.getPropertyValue('--text-primary').trim(),
        borderDefault: styles.getPropertyValue('--border-default').trim()
    };
};

// Revenue Chart Component
const RevenueChart = ({ annualFees, onboardingFee, currency, theme }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!chartRef.current || annualFees.length === 0) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const colors = getChartColors();
        const ctx = chartRef.current.getContext('2d');

        const labels = annualFees.map(f => `Year ${f.year}`);
        const hasOnboarding = onboardingFee && onboardingFee > 0;

        // For uniform rounded corners on all bars:
        // - Annual Fee layer: rounded corners (will show on years 2+ where no onboarding)
        // - Onboarding layer: rounded corners (will show on year 1 where it stacks on top)
        // The key is that onboarding for years 2+ is 0, so Annual Fee's rounded corners show through

        const datasets = [
            {
                label: 'Annual Fee',
                data: annualFees.map(f => f.amount),
                backgroundColor: colors.primary,
                borderRadius: {
                    topLeft: 4,
                    topRight: 4,
                    bottomLeft: 0,
                    bottomRight: 0
                },
                barThickness: 48
            }
        ];

        // Add onboarding layer
        if (hasOnboarding) {
            datasets.push({
                label: 'Onboarding',
                data: annualFees.map((f, i) => i === 0 ? onboardingFee : 0),
                backgroundColor: colors.secondary,
                borderRadius: {
                    topLeft: 4,
                    topRight: 4,
                    bottomLeft: 0,
                    bottomRight: 0
                },
                barThickness: 48
            });
        }

        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            font: {
                                family: 'Inter',
                                size: 12
                            }
                        }
                    },
                    y: {
                        stacked: true,
                        border: {
                            display: false
                        },
                        grid: {
                            color: colors.borderSubtle,
                            drawBorder: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            font: {
                                family: 'Inter',
                                size: 12
                            },
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: colors.bgSurface,
                        titleColor: colors.textPrimary,
                        bodyColor: colors.textSecondary,
                        borderColor: colors.borderDefault,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.raw) + ' ' + currency;
                            }
                        }
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [annualFees, onboardingFee, currency, theme]);

    return (
        <div className="chart-section">
            <div className="chart-header">
                <h3 className="chart-title">Revenue Overview</h3>
                <div className="chart-legend">
                    <div className="legend-item">
                        <span className="legend-dot annual"></span>
                        Annual Fee
                    </div>
                    {onboardingFee > 0 && (
                        <div className="legend-item">
                            <span className="legend-dot onboarding"></span>
                            Onboarding
                        </div>
                    )}
                </div>
            </div>
            <div className="chart-container">
                <canvas ref={chartRef}></canvas>
            </div>
        </div>
    );
};

// Data Row Component for two-column grid
const DataRow = ({ label, value, isLink }) => (
    <div className="data-row">
        <span className="data-label">{label}</span>
        {isLink ? (
            <a href={`mailto:${value}`} className="data-value link">{value}</a>
        ) : (
            <span className="data-value">{value || '—'}</span>
        )}
    </div>
);

// Email Section Component - Primary action for sending contract details
const EmailSection = ({ contractData, extractedInfo, gmailAuth, onAuthClick, onSendEmail }) => {
    const [toEmail, setToEmail] = useState('');
    const [ccEmail, setCcEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [showCc, setShowCc] = useState(false);
    const [feedback, setFeedback] = useState({ show: false, message: '', type: 'success' });

    // Initialize default values when contract data changes
    useEffect(() => {
        if (contractData) {
            // Auto-generate subject: {Customer Name} MSA - {Signing Date}
            const customerName = contractData.customer_name || 'Contract';
            const signingDate = contractData.signatures?.customer?.date ||
                               contractData.subscription_start ||
                               new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            setSubject(`${customerName} MSA - ${signingDate}`);

            // Pre-fill body with extracted info
            setBody(extractedInfo || '');

            // Pre-fill recipient from contract point of contact
            if (contractData.point_of_contact?.email) {
                setToEmail(contractData.point_of_contact.email);
            }
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
                body: JSON.stringify({
                    to: toEmail,
                    cc: ccEmail || undefined,
                    subject: subject,
                    body: body
                })
            });

            const result = await response.json();

            if (result.success) {
                setFeedback({ show: true, message: 'Email sent successfully!', type: 'success' });
                if (onSendEmail) onSendEmail(result);
            } else {
                setFeedback({ show: true, message: result.error || 'Failed to send email', type: 'error' });
            }
        } catch (err) {
            setFeedback({ show: true, message: 'Failed to send email: ' + err.message, type: 'error' });
        } finally {
            setSending(false);
            setTimeout(() => setFeedback({ show: false, message: '', type: 'success' }), 4000);
        }
    };

    // If not authenticated, show connect button
    if (!gmailAuth.authenticated) {
        return (
            <div className="email-section">
                <div className="email-section-header">
                    <span className="email-section-title">
                        <Icons.Mail />
                        Send Email
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={onAuthClick}>
                        <Icons.Link />
                        Connect Gmail
                    </button>
                </div>
                <div className="email-connect-prompt">
                    <p>Connect your Gmail account to send contract details directly from here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="email-section">
            <div className="email-section-header">
                <span className="email-section-title">
                    <Icons.Mail />
                    Send Email
                </span>
                {gmailAuth.email && (
                    <span className="email-connected-as">Sending as {gmailAuth.email}</span>
                )}
            </div>

            <div className="email-form">
                <div className="email-field">
                    <label className="email-label">To</label>
                    <div className="email-input-row">
                        <input
                            type="email"
                            className="email-input"
                            placeholder="recipient@example.com"
                            value={toEmail}
                            onChange={(e) => setToEmail(e.target.value)}
                        />
                        {!showCc && (
                            <button className="email-add-cc" onClick={() => setShowCc(true)}>
                                + CC
                            </button>
                        )}
                    </div>
                </div>

                {showCc && (
                    <div className="email-field">
                        <label className="email-label">CC</label>
                        <input
                            type="email"
                            className="email-input"
                            placeholder="cc@example.com"
                            value={ccEmail}
                            onChange={(e) => setCcEmail(e.target.value)}
                        />
                    </div>
                )}

                <div className="email-field">
                    <label className="email-label">Subject</label>
                    <input
                        type="text"
                        className="email-input"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />
                </div>

                <div className="email-field">
                    <label className="email-label">Body</label>
                    <textarea
                        className="email-textarea"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                    />
                </div>

                <div className="email-actions">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleSend}
                        disabled={sending}
                    >
                        {sending ? (
                            <>Sending...</>
                        ) : (
                            <>
                                <Icons.Send />
                                Send Email
                            </>
                        )}
                    </button>
                </div>

                {feedback.show && (
                    <div className={`email-feedback ${feedback.type}`}>
                        {feedback.message}
                    </div>
                )}
            </div>
        </div>
    );
};

// Contract Detail View Component
const ContractDetailView = ({ data, onCopy, theme, gmailAuth, onGmailAuthClick, onSendEmail }) => {
    const parsed_data = data.parsed_data;

    return (
        <div className="contract-detail-view">
            {/* Total Contract Value - Prominent */}
            {parsed_data.total_contract_value > 0 && (
                <div className="total-value-section">
                    <div className="total-value-label">Total Contract Value</div>
                    <div className="total-value-customer">{parsed_data.customer_name}</div>
                    <div className="total-value-amount">
                        {formatCurrency(parsed_data.total_contract_value)}
                        <span className="total-value-currency">{parsed_data.currency}</span>
                    </div>
                </div>
            )}

            {/* Two-Column Data Grid */}
            <div className="data-grid">
                {/* Left Column - Contract Details */}
                <div className="data-section">
                    <h3 className="data-section-title">Contract Details</h3>
                    <DataRow label="Customer" value={parsed_data.customer_name} />
                    <DataRow label="Duration" value={parsed_data.duration} />
                    <DataRow label="Start Date" value={parsed_data.subscription_start} />
                    <DataRow label="End Date" value={parsed_data.subscription_end} />
                    {parsed_data.point_of_contact?.name && (
                        <DataRow label="Contact" value={parsed_data.point_of_contact.name} />
                    )}
                    {parsed_data.point_of_contact?.email && (
                        <DataRow label="Email" value={parsed_data.point_of_contact.email} isLink />
                    )}
                </div>

                {/* Right Column - Terms & Fees */}
                <div className="data-section">
                    <h3 className="data-section-title">Terms & Fees</h3>
                    {parsed_data.onboarding_fee > 0 && (
                        <DataRow
                            label="Onboarding Fee"
                            value={formatCurrency(parsed_data.onboarding_fee) + ' ' + parsed_data.currency}
                        />
                    )}
                    {parsed_data.annual_fees?.length > 0 && parsed_data.annual_fees.map((fee, idx) => (
                        <DataRow
                            key={idx}
                            label={`Year ${fee.year} Fee`}
                            value={formatCurrency(fee.amount) + ' ' + parsed_data.currency}
                        />
                    ))}
                    {parsed_data.signatures?.customer?.name && (
                        <DataRow
                            label="Customer Signature"
                            value={`${parsed_data.signatures.customer.name}${parsed_data.signatures.customer.date ? ` (${parsed_data.signatures.customer.date})` : ''}`}
                        />
                    )}
                    {parsed_data.signatures?.vendor?.name && (
                        <DataRow
                            label="Vendor Signature"
                            value={`${parsed_data.signatures.vendor.name}${parsed_data.signatures.vendor.date ? ` (${parsed_data.signatures.vendor.date})` : ''}`}
                        />
                    )}
                </div>
            </div>

            {/* Revenue Chart */}
            {parsed_data.annual_fees?.length > 0 && (
                <RevenueChart
                    annualFees={parsed_data.annual_fees}
                    onboardingFee={parsed_data.onboarding_fee}
                    currency={parsed_data.currency}
                    theme={theme}
                />
            )}

            {/* Extracted Text with Copy buttons */}
            <div className="extracted-section">
                <div className="extracted-header">
                    <span className="extracted-title">Full Extracted Details</span>
                    <div className="extracted-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => onCopy('summary')}>
                            Copy Summary
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => onCopy('full')}>
                            Copy Full
                        </button>
                    </div>
                </div>
                <pre className="extracted-content">{data.extracted_info}</pre>
            </div>

            {/* Email Section */}
            <EmailSection
                contractData={parsed_data}
                extractedInfo={data.extracted_info}
                gmailAuth={gmailAuth}
                onAuthClick={onGmailAuthClick}
                onSendEmail={onSendEmail}
            />
        </div>
    );
};

// Copy Feedback Component
const CopyFeedback = ({ show, message }) => (
    <div className={`copy-feedback ${show ? 'show' : ''}`}>
        {message}
    </div>
);

// Main App Component
const App = () => {
    const [view, setView] = useState('home'); // 'home', 'processing', 'detail'
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

    const abortControllerRef = useRef(null);

    // Load history on mount and check Gmail auth status
    useEffect(() => {
        setRecentContracts(getRecentContracts());
        checkGmailAuthStatus();
    }, []);

    // Listen for OAuth popup messages
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'gmail_auth_success') {
                checkGmailAuthStatus();
            } else if (event.data?.type === 'gmail_auth_error') {
                setError('Gmail authorization failed: ' + event.data.error);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Check Gmail authentication status
    const checkGmailAuthStatus = async () => {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            setGmailAuth({
                authenticated: data.authenticated,
                email: data.email
            });
        } catch (err) {
            console.error('Failed to check Gmail auth status:', err);
        }
    };

    // Handle Gmail OAuth flow
    const handleGmailAuthClick = async () => {
        try {
            const response = await fetch('/auth/gmail');
            const data = await response.json();

            if (data.success && data.authorization_url) {
                // Open OAuth popup
                const width = 600;
                const height = 700;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;

                window.open(
                    data.authorization_url,
                    'Gmail Authorization',
                    `width=${width},height=${height},left=${left},top=${top}`
                );
            } else {
                setError(data.error || 'Failed to start Gmail authorization');
            }
        } catch (err) {
            setError('Failed to connect to Gmail: ' + err.message);
        }
    };

    // Handle successful email send
    const handleSendEmail = (result) => {
        setCopyFeedback({
            show: true,
            message: 'Email sent successfully!'
        });
        setTimeout(() => setCopyFeedback({ show: false, message: '' }), 3000);
    };

    const processFile = async (selectedFile) => {
        setFile(selectedFile);
        setView('processing');
        setCurrentContract(null);
        setSteps(steps.map(s => ({ ...s, status: 'pending', message: '' })));

        const formData = new FormData();
        formData.append('file', selectedFile);

        const updateStep = (stepIndex, status, message) => {
            setSteps(prev => prev.map((s, i) =>
                i === stepIndex ? { ...s, status, message } : s
            ));
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

            if (result.error) {
                throw new Error(result.error);
            }

            updateStep(3, 'complete', 'Summary generated');

            await new Promise(r => setTimeout(r, 500));

            // Save to history
            saveContract(result);
            setRecentContracts(getRecentContracts());

            setCurrentContract(result);
            setView('detail');

        } catch (err) {
            if (err.name === 'AbortError') {
                setView('home');
                return;
            }
            setError(err.message || 'An error occurred during processing');
            setView('home');
        }
    };

    const handleFileSelect = async (selectedFile) => {
        if (selectedFile.type !== 'application/pdf') {
            setError('Please select a PDF file');
            return;
        }

        // We can't check for duplicates before processing since we don't know the content yet
        // So we'll just process it
        processFile(selectedFile);
    };

    const handleStop = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setView('home');
        setSteps(steps.map(s => ({ ...s, status: 'pending', message: '' })));
    };

    const handleCopy = async (type) => {
        const data = currentContract;
        const text = type === 'summary' ? data.summary : data.extracted_info;

        try {
            await navigator.clipboard.writeText(text);
            setCopyFeedback({
                show: true,
                message: type === 'summary' ? 'Summary copied!' : 'Full details copied!'
            });
            setTimeout(() => setCopyFeedback({ show: false, message: '' }), 2000);
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopyFeedback({
                show: true,
                message: type === 'summary' ? 'Summary copied!' : 'Full details copied!'
            });
            setTimeout(() => setCopyFeedback({ show: false, message: '' }), 2000);
        }
    };

    const handleSelectContract = (contract) => {
        // View from history - reconstruct the data format
        setCurrentContract({
            parsed_data: contract.parsed_data,
            extracted_info: contract.extracted_info,
            summary: contract.summary
        });
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
        setView('home');
    };

    // Determine if we should show the topbar
    const showTopBar = view !== 'home';

    const getTitle = () => {
        // No title in topbar - customer name now shown in Total Contract Value box
        return '';
    };

    const getStatus = () => {
        if (view === 'processing') return 'processing';
        if (view === 'detail') return 'complete';
        return null;
    };

    return (
        <div className="app-layout">
            {showTopBar && (
                <TopBar
                    title={getTitle()}
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
                            <button onClick={() => setError(null)}>
                                <Icons.X />
                            </button>
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
                        <ProcessingView
                            filename={file?.name || 'document.pdf'}
                            steps={steps}
                        />
                    )}

                    {view === 'detail' && currentContract && (
                        <ContractDetailView
                            data={currentContract}
                            onCopy={handleCopy}
                            theme={theme}
                            gmailAuth={gmailAuth}
                            onGmailAuthClick={handleGmailAuthClick}
                            onSendEmail={handleSendEmail}
                        />
                    )}
                </div>
            </main>

            {duplicateContract && (
                <DuplicateModal
                    contract={duplicateContract}
                    onViewExisting={() => {
                        handleSelectContract(duplicateContract);
                        setDuplicateContract(null);
                        setPendingFile(null);
                    }}
                    onProcessAnyway={() => {
                        setDuplicateContract(null);
                        if (pendingFile) {
                            processFile(pendingFile);
                            setPendingFile(null);
                        }
                    }}
                    onClose={() => {
                        setDuplicateContract(null);
                        setPendingFile(null);
                    }}
                />
            )}

            <CopyFeedback show={copyFeedback.show} message={copyFeedback.message} />
        </div>
    );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
