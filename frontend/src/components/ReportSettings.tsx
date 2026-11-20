import { useEffect, useState } from 'react';
import {
    Download, Mail,
    CheckCircle2, FileSpreadsheet,
    FileJson, BarChart3, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../config/axiosInstance';
import { PremiumCard } from './ui/PremiumCard';

type Frequency = 'daily' | 'weekly' | 'monthly';
const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly'];

// Report cards use friendly ids; the export API accepts resource table names.
const EXPORT_RESOURCE: Record<string, string> = {
    network_summary: 'traffic_logs',
    security_audit: 'alerts',
    traffic: 'traffic_logs',
    devices: 'devices',
};

export default function ReportSettings() {
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [emailReports, setEmailReports] = useState(false);
    const [reportFrequency, setReportFrequency] = useState<Frequency>('weekly');
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        let cancelled = false;
        axiosInstance.get('/reports/settings')
            .then(({ data }) => {
                if (cancelled) return;
                if (typeof data?.reports_email_enabled === 'boolean') {
                    setEmailReports(data.reports_email_enabled);
                }
                if (FREQUENCIES.includes(data?.reports_frequency)) {
                    setReportFrequency(data.reports_frequency);
                }
            })
            .catch(() => {
                // Keep sensible defaults when the endpoint is unavailable.
            })
            .finally(() => {
                if (!cancelled) setLoadingSettings(false);
            });
        return () => { cancelled = true; };
    }, []);

    const persistSettings = async (payload: Record<string, unknown>, successDescription: string) => {
        try {
            await axiosInstance.post('/reports/settings', payload);
            toast.success('Settings Updated', { description: successDescription });
        } catch (error) {
            console.error('Failed to save report settings:', error);
            toast.error('Failed to Update Settings', {
                description: 'Your report preferences could not be saved.'
            });
            throw error;
        }
    };

    const handleToggleEmail = () => {
        const next = !emailReports;
        setEmailReports(next);
        persistSettings(
            { reports_email_enabled: next },
            `Email reports are now ${next ? 'enabled' : 'disabled'}.`
        ).catch(() => setEmailReports(!next));
    };

    const handleFrequencyChange = (freq: Frequency) => {
        if (freq === reportFrequency) return;
        const previous = reportFrequency;
        setReportFrequency(freq);
        persistSettings({ reports_frequency: freq }, `Report frequency set to ${freq}.`)
            .catch(() => setReportFrequency(previous));
    };

    const handleDownload = async (type: string, format: 'pdf' | 'csv' | 'json' = 'pdf') => {
        setIsGenerating(type);
        try {
            let endpoint = '';
            if (format === 'pdf') {
                endpoint = `/reports/pdf/${type}`;
            } else {
                endpoint = `/reports/export/${EXPORT_RESOURCE[type] ?? type}?format=${format}`;
            }

            const response = await axiosInstance.get(endpoint, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = format === 'pdf' ? 'pdf' : format;
            link.setAttribute('download', `statsea_${type}_${new Date().toISOString().split('T')[0]}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Report Ready', {
                description: `Your ${type.replace('_', ' ')} has been generated successfully.`
            });
        } catch (error) {
            console.error('Generation failed:', error);
            toast.error('Generation Failed', {
                description: 'Failed to generate the requested report.'
            });
        } finally {
            setIsGenerating(null);
        }
    };

    const reportTypes = [
        {
            id: 'network_summary',
            title: 'Network Summary',
            description: 'Comprehensive overview of traffic, bandwidth, and device activity.',
            icon: BarChart3,
            color: 'text-primary',
            bgColor: 'bg-primary/10',
            formats: ['pdf', 'json']
        },
        {
            id: 'security_audit',
            title: 'Security Audit',
            description: 'Detailed analysis of security events, blocked threats, and anomalies.',
            icon: ShieldCheck,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
            formats: ['pdf', 'json']
        },
        {
            id: 'traffic',
            title: 'Traffic Raw Data',
            description: 'Raw capture data including protocols, endpoints, and byte counts.',
            icon: FileSpreadsheet,
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            formats: ['csv', 'json']
        },
        {
            id: 'devices',
            title: 'Device Inventory',
            description: 'Full list of discovered devices with their specifications and history.',
            icon: FileJson,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            formats: ['csv', 'json']
        }
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportTypes.map((report) => (
                    <PremiumCard key={report.id} className="p-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-[7px] ${report.bgColor} flex items-center justify-center border border-line`}>
                                <report.icon className={`w-5 h-5 ${report.color}`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-text mb-1">{report.title}</h3>
                                <p className="text-xs text-faint mb-5">{report.description}</p>

                                <div className="flex flex-wrap gap-2">
                                    {report.formats.map((format) => (
                                        <button
                                            key={format}
                                            type="button"
                                            onClick={() => handleDownload(report.id, format as 'pdf' | 'csv' | 'json')}
                                            disabled={isGenerating !== null}
                                            className="px-3 py-1.5 bg-raised hover:bg-panel rounded-[5px] text-xs font-bold text-faint hover:text-text transition-colors border border-line flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                        >
                                            {isGenerating === report.id ? (
                                                <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                                            ) : (
                                                <Download className="w-3 h-3 text-accent" />
                                            )}
                                            {format.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </PremiumCard>
                ))}
            </div>

            <PremiumCard className="p-6 border-line bg-raised">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[7px] bg-accent/10 flex items-center justify-center border border-accent/20">
                            <Mail className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-text mb-1">Scheduled Email Reports</h3>
                            <p className="text-xs text-faint">Receive automated security and network summaries directly in your inbox.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div role="tablist" aria-label="Report frequency" className="flex bg-panel p-1 rounded-[7px] border border-line">
                            {FREQUENCIES.map((freq) => (
                                <button
                                    key={freq}
                                    type="button"
                                    role="tab"
                                    aria-selected={reportFrequency === freq}
                                    disabled={loadingSettings}
                                    onClick={() => handleFrequencyChange(freq)}
                                    className={`px-3 py-1.5 rounded-[5px] text-xs font-bold transition-colors uppercase tracking-wider focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50 ${reportFrequency === freq
                                        ? 'bg-accent text-black shadow-sm'
                                        : 'text-faint hover:text-text'
                                        }`}
                                >
                                    {freq.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            role="switch"
                            aria-checked={emailReports}
                            disabled={loadingSettings}
                            onClick={handleToggleEmail}
                            aria-label="Toggle scheduled email reports"
                            className={`w-12 h-6 rounded-full relative transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${emailReports ? 'bg-accent' : 'bg-raised border border-line'
                                }`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-[left] duration-300 ${emailReports ? 'left-6 shadow-md' : 'left-0.5'
                                }`} />
                        </button>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-border/70 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">PDF & JSON attachments</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">Security anomaly alerts</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">Multi-recipient support</span>
                    </div>
                </div>
            </PremiumCard>
        </div>
    );
}
