import { useState } from 'react';
import {
    Download, Mail,
    CheckCircle2, FileSpreadsheet,
    FileJson, BarChart3, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../config/axiosInstance';
import { PremiumCard } from './ui/PremiumCard';

export default function ReportSettings() {
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [emailReports, setEmailReports] = useState(false);
    const [reportFrequency, setReportFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

    const handleDownload = async (type: string, format: 'pdf' | 'csv' | 'json' = 'pdf') => {
        setIsGenerating(type);
        try {
            let endpoint = '';
            if (format === 'pdf') {
                endpoint = `/reports/pdf/${type}`;
            } else {
                endpoint = `/reports/export/${type}?format=${format}`;
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
            color: 'text-indigo-400',
            bgColor: 'bg-indigo-500/10',
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
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            formats: ['csv', 'json']
        }
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportTypes.map((report) => (
                    <PremiumCard key={report.id} className="p-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl ${report.bgColor} flex items-center justify-center border border-white/5`}>
                                <report.icon className={`w-6 h-6 ${report.color}`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1">{report.title}</h3>
                                <p className="text-sm text-muted-foreground mb-6">{report.description}</p>

                                <div className="flex flex-wrap gap-2">
                                    {report.formats.map((format) => (
                                        <button
                                            key={format}
                                            onClick={() => handleDownload(report.id, format as any)}
                                            disabled={isGenerating !== null}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white/70 hover:text-white transition-all border border-white/5 flex items-center gap-2"
                                        >
                                            {isGenerating === report.id ? (
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Download className="w-3 h-3" />
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

            <PremiumCard className="p-8 border-indigo-500/20 bg-indigo-500/5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <Mail className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Scheduled Email Reports</h3>
                            <p className="text-sm text-muted-foreground">Receive automated security and network summaries directly in your inbox.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                            {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                                <button
                                    key={freq}
                                    onClick={() => setReportFrequency(freq)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${reportFrequency === freq
                                        ? 'bg-indigo-600 text-white shadow-lg'
                                        : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    {freq.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setEmailReports(!emailReports);
                                toast.success('Settings Updated', {
                                    description: `Email reports are now ${!emailReports ? 'enabled' : 'disabled'}.`
                                });
                            }}
                            className={`w-14 h-8 rounded-full relative transition-all duration-300 ${emailReports ? 'bg-indigo-600' : 'bg-white/10'
                                }`}
                        >
                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 ${emailReports ? 'left-7 shadow-lg' : 'left-1'
                                }`} />
                        </button>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm text-white/60">PDF & JSON attachments</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm text-white/60">Security anomaly alerts</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm text-white/60">Multi-recipient support</span>
                    </div>
                </div>
            </PremiumCard>
        </div>
    );
}
