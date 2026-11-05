import { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useQuota, useSaveQuota } from '../hooks/useQuotas';

interface QuotaManagerProps {
    deviceId: number;
    dailyUsage: number;
    monthlyUsage: number;
}

export function QuotaManager({ deviceId, dailyUsage, monthlyUsage }: QuotaManagerProps) {
    const { data: quotaData, isLoading: loading } = useQuota(deviceId);
    const saveQuotaMutation = useSaveQuota();

    // Track user input overrides; fallback to server quotaData when not modified
    const [userDailyInput, setUserDailyInput] = useState<string | null>(null);
    const [userMonthlyInput, setUserMonthlyInput] = useState<string | null>(null);

    const serverDailyGB = quotaData?.daily_limit_bytes != null
        ? (quotaData.daily_limit_bytes / (1024 * 1024 * 1024)).toString()
        : "";
    const serverMonthlyGB = quotaData?.monthly_limit_bytes != null
        ? (quotaData.monthly_limit_bytes / (1024 * 1024 * 1024)).toString()
        : "";

    const dailyInput = userDailyInput !== null ? userDailyInput : serverDailyGB;
    const monthlyInput = userMonthlyInput !== null ? userMonthlyInput : serverMonthlyGB;

    const parseBytes = (input: string) => {
        const floatVal = parseFloat(input);
        return isNaN(floatVal) || floatVal <= 0 ? null : Math.floor(floatVal * 1024 * 1024 * 1024);
    };

    const dailyLimit = parseBytes(dailyInput);
    const monthlyLimit = parseBytes(monthlyInput);

    const handleSave = async () => {
        saveQuotaMutation.mutate({
            deviceId,
            daily_limit_bytes: dailyLimit,
            monthly_limit_bytes: monthlyLimit,
        }, {
            onSuccess: () => toast.success("Quota updated successfully"),
            onError: () => toast.error("Failed to update quota"),
        });
    };

    // Helper to convert bytes to GB/MB for display
    const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
    const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

    const handleDailyChange = (val: string) => {
        setUserDailyInput(val);
    };

    const handleMonthlyChange = (val: string) => {
        setUserMonthlyInput(val);
    };

    if (loading) return <div className="animate-pulse h-20 bg-raised rounded-[var(--r-panel)] border border-line"></div>;

    const getProgressColor = (usage: number, limit: number) => {
        const pct = (usage / limit) * 100;
        if (pct >= 100) return "bg-red-500";
        if (pct >= 80) return "bg-yellow-500";
        return "bg-accent";
    };

    return (
        <div className="panel rounded-[var(--r-panel)] p-5 md:p-6 border border-line bg-panel mb-8">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-text">Bandwidth Quotas</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Daily Quota */}
                <div className="p-4 rounded-[7px] bg-raised border border-line">
                    <div className="flex justify-between mb-2">
                        <label htmlFor="daily-limit-input" className="text-xs font-bold uppercase tracking-wider text-faint">Daily Limit (GB)</label>
                        {dailyLimit && (
                            <span className={`text-xs font-mono font-bold ${dailyUsage > dailyLimit ? "text-red-500" : "text-emerald-500"}`}>
                                {((dailyUsage / dailyLimit) * 100).toFixed(1)}% Used
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            id="daily-limit-input"
                            type="number"
                            step="0.1"
                            value={dailyInput}
                            onChange={(e) => handleDailyChange(e.target.value)}
                            placeholder="No Limit"
                            className="bg-panel border border-line rounded-[7px] px-3 py-2 text-sm text-text w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-line-strong font-mono"
                        />
                    </div>

                    {dailyLimit && (
                        <div className="mt-3">
                            <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${getProgressColor(dailyUsage, dailyLimit)}`}
                                    style={{ width: `${Math.min((dailyUsage / dailyLimit) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-faint font-mono">
                                <span>{toMB(dailyUsage)} MB Used</span>
                                <span>{toGB(dailyLimit)} GB Limit</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Monthly Quota */}
                <div className="p-4 rounded-[7px] bg-raised border border-line">
                    <div className="flex justify-between mb-2">
                        <label htmlFor="monthly-limit-input" className="text-xs font-bold uppercase tracking-wider text-faint">Monthly Limit (GB)</label>
                        {monthlyLimit && (
                            <span className={`text-xs font-mono font-bold ${monthlyUsage > monthlyLimit ? "text-red-500" : "text-emerald-500"}`}>
                                {((monthlyUsage / monthlyLimit) * 100).toFixed(1)}% Used
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            id="monthly-limit-input"
                            type="number"
                            step="1"
                            value={monthlyInput}
                            onChange={(e) => handleMonthlyChange(e.target.value)}
                            placeholder="No Limit"
                            className="bg-panel border border-line rounded-[7px] px-3 py-2 text-sm text-text w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-line-strong font-mono"
                        />
                    </div>
                    {monthlyLimit && (
                        <div className="mt-3">
                            <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${getProgressColor(monthlyUsage, monthlyLimit)}`}
                                    style={{ width: `${Math.min((monthlyUsage / monthlyLimit) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-faint font-mono">
                                <span>{toGB(monthlyUsage)} GB Used</span>
                                <span>{toGB(monthlyLimit)} GB Limit</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveQuotaMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-accent/15 hover:bg-accent/25 text-accent rounded-[7px] text-xs font-bold transition-colors border border-accent/25 uppercase tracking-wider disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                    <Save className="w-4 h-4" />
                    {saveQuotaMutation.isPending ? "Saving…" : "Save Quotas"}
                </button>
            </div>
        </div>
    );
};
