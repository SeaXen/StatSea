import React from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { usePrediction, useAnomalies } from '../hooks/useAnalytics';

interface PredictionData {
    predicted_bytes: number;
    current_usage: number;
    trend: 'up' | 'down' | string;
    growth_rate_pct: number;
    error?: string;
}

interface Anomaly {
    device_mac: string;
    device_name: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    current_usage: number;
    avg_usage: number;
    z_score: number;
}

const PredictionWidget: React.FC = () => {
    const { data: prediction, isLoading: predLoading } = usePrediction() as { data: PredictionData | undefined; isLoading: boolean };
    const { data: anomalies = [], isLoading: anomLoading } = useAnomalies() as { data: Anomaly[]; isLoading: boolean };
    const loading = predLoading || anomLoading;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (loading) return (
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Month Forecast */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Brain size={120} />
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Zap className="text-primary" size={20} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">AI Monthly Forecast</h3>
                </div>

                {prediction?.error ? (
                    <div className="text-slate-400 text-sm italic">Learning usage patterns... (Requires 3+ days of data)</div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">Predicted Total</p>
                                <p className="text-3xl font-bold text-white font-mono">
                                    {formatBytes(prediction?.predicted_bytes || 0)}
                                </p>
                            </div>
                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${prediction?.trend === 'up' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                {prediction?.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {prediction?.growth_rate_pct.toFixed(1)}% Trend
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Current Progress</span>
                                <span className="text-white font-mono">
                                    {((prediction?.current_usage || 0) / (prediction?.predicted_bytes || 1) * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] transition-all duration-1000"
                                    style={{ width: `${Math.min(100, (prediction?.current_usage || 0) / (prediction?.predicted_bytes || 1) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Anomalies */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <ShieldCheck className="text-amber-500" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Anomaly Detection</h3>
                    </div>
                    <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full">Last 14 Days</span>
                </div>

                <div className="space-y-4 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                    {anomalies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                            <ShieldCheck size={32} className="mb-2 opacity-20" />
                            <p className="text-sm">No unusual activity detected</p>
                        </div>
                    ) : (
                        anomalies.map((anom, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="text-rose-500" size={16} />
                                    <div>
                                        <p className="text-sm font-medium text-white">{anom.device_name}</p>
                                        <p className="text-xs text-slate-500 uppercase">{anom.device_mac}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-rose-400">+{((anom.current_usage / anom.avg_usage - 1) * 100).toFixed(0)}% Spike</p>
                                    <p className="text-[10px] text-slate-500 uppercase">Severe Anomaly</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PredictionWidget;
