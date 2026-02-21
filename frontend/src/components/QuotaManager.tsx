import { useState, useEffect } from 'react';
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

    const [dailyLimit, setDailyLimit] = useState<number | null>(null);
    const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);

    // Sync fetched quota into local state
    useEffect(() => {
        if (quotaData) {
            setDailyLimit(quotaData.daily_limit_bytes);
            setMonthlyLimit(quotaData.monthly_limit_bytes);
        }
    }, [quotaData]);

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

    // Helpers for input (editing in GB)
    const [dailyInput, setDailyInput] = useState<string>("");
    const [monthlyInput, setMonthlyInput] = useState<string>("");

    useEffect(() => {
        if (dailyLimit !== null) setDailyInput((dailyLimit / (1024 * 1024 * 1024)).toString());
        if (monthlyLimit !== null) setMonthlyInput((monthlyLimit / (1024 * 1024 * 1024)).toString());
    }, [dailyLimit, monthlyLimit]);

    const handleDailyChange = (val: string) => {
        setDailyInput(val);
        const floatVal = parseFloat(val);
        setDailyLimit(isNaN(floatVal) || floatVal === 0 ? null : Math.floor(floatVal * 1024 * 1024 * 1024));
    };

    const handleMonthlyChange = (val: string) => {
        setMonthlyInput(val);
        const floatVal = parseFloat(val);
        setMonthlyLimit(isNaN(floatVal) || floatVal === 0 ? null : Math.floor(floatVal * 1024 * 1024 * 1024));
    };

    if (loading) return <div className="animate-pulse h-20 bg-white/5 rounded-xl"></div>;

    const getProgressColor = (usage: number, limit: number) => {
        const pct = (usage / limit) * 100;
        if (pct >= 100) return "bg-red-500";
        if (pct >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    return (
        <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/5 mb-8">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-white">Bandwidth Quotas</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Quota */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">Daily Limit (GB)</label>
                        {dailyLimit && (
                            <span className={`text-xs font-bold ${dailyUsage > dailyLimit ? "text-red-500" : "text-green-500"}`}>
                                {((dailyUsage / dailyLimit) * 100).toFixed(1)}% Used
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            step="0.1"
                            value={dailyInput}
                            onChange={(e) => handleDailyChange(e.target.value)}
                            placeholder="No Limit"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    {dailyLimit && (
                        <div className="mt-3">
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(dailyUsage, dailyLimit)}`}
                                    style={{ width: `${Math.min((dailyUsage / dailyLimit) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500 font-mono">
                                <span>{toMB(dailyUsage)} MB Used</span>
                                <span>{toGB(dailyLimit)} GB Limit</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Monthly Quota */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">Monthly Limit (GB)</label>
                        {monthlyLimit && (
                            <span className={`text-xs font-bold ${monthlyUsage > monthlyLimit ? "text-red-500" : "text-green-500"}`}>
                                {((monthlyUsage / monthlyLimit) * 100).toFixed(1)}% Used
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            step="1"
                            value={monthlyInput}
                            onChange={(e) => handleMonthlyChange(e.target.value)}
                            placeholder="No Limit"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    {monthlyLimit && (
                        <div className="mt-3">
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(monthlyUsage, monthlyLimit)}`}
                                    style={{ width: `${Math.min((monthlyUsage / monthlyLimit) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500 font-mono">
                                <span>{toGB(monthlyUsage)} GB Used</span>
                                <span>{toGB(monthlyLimit)} GB Limit</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saveQuotaMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors border border-blue-500/20"
                >
                    <Save className="w-4 h-4" />
                    {saveQuotaMutation.isPending ? "Saving..." : "Save Quotas"}
                </button>
            </div>
        </div>
    );
}
