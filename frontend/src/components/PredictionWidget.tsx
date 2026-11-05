import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { usePrediction, useAnomalies } from '../hooks/useAnalytics';
import { cn } from '../lib/utils';

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
        <div className="panel p-6 h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent" />
        </div>
    );

    const progressPct = Math.min(100, Math.round(((prediction?.current_usage || 0) / (prediction?.predicted_bytes || 1)) * 100));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Month Forecast */}
            <div className="panel p-4 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[5px] bg-raised border border-line flex items-center justify-center text-accent">
                            <Zap className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold">AI Monthly Forecast</h3>
                    </div>
                    {prediction?.trend && (
                        <span className={cn(
                            "status text-[10px] uppercase font-mono px-2 py-0.5",
                            prediction.trend === 'up' ? 'warn' : 'ok'
                        )}>
                            {prediction.trend === 'up' ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                            {prediction.growth_rate_pct.toFixed(1)}% Trend
                        </span>
                    )}
                </div>

                {prediction?.error ? (
                    <div className="text-text-soft text-xs font-mono py-4">Learning usage patterns (requires 3+ days of baseline traffic)</div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-faint">Predicted Total Bandwidth</span>
                            <div className="text-2xl font-semibold text-text font-mono num leading-tight mt-0.5">
                                {formatBytes(prediction?.predicted_bytes || 0)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-text-soft">Current Cycle Consumption</span>
                                <span className="text-accent num font-semibold">{progressPct}%</span>
                            </div>
                            <div className="w-full h-2 rounded-[3px] bg-raised overflow-hidden border border-line">
                                <div
                                    className="h-full bg-accent transition-[width] duration-700"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Anomalies */}
            <div className="panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[5px] bg-raised border border-line flex items-center justify-center text-accent">
                            <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Anomaly Detector</h3>
                    </div>
                    <span className="text-[10px] font-mono text-faint uppercase px-2 py-0.5 bg-raised rounded-[4px] border border-line">
                        14-DAY WINDOW
                    </span>
                </div>

                <div className="space-y-2 max-h-[130px] overflow-y-auto pr-1 custom-scrollbar">
                    {anomalies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-faint text-xs font-mono">
                            <ShieldCheck className="w-6 h-6 mb-1 text-ok opacity-60" />
                            <span>No traffic anomalies detected on subnet</span>
                        </div>
                    ) : (
                        anomalies.map((anom, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-[5px] bg-raised border border-line">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="text-danger w-3.5 h-3.5 flex-shrink-0" />
                                    <div>
                                        <div className="text-xs font-medium text-text">{anom.device_name}</div>
                                        <div className="text-[10px] font-mono text-faint uppercase">{anom.device_mac}</div>
                                    </div>
                                </div>
                                <div className="text-right font-mono">
                                    <div className="text-xs font-semibold text-danger num">+{((anom.current_usage / anom.avg_usage - 1) * 100).toFixed(0)}% Spike</div>
                                    <div className="text-[9px] text-faint uppercase">Z-Score {anom.z_score.toFixed(1)}</div>
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
