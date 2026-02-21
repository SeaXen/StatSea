import { useState, useMemo } from 'react';
import {
    Activity, Calendar, Clock, Database,
    Server, BarChart3, Zap, TrendingUp, Info
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

import {
    useInterfaces, useBandwidthSummary, useBandwidthFiveMinute,
    useBandwidthHourly, useBandwidthDaily, useBandwidthMonthly,
    useBandwidthYearly, useBandwidthTop
} from '../hooks/useBandwidth';
import { formatBytes, cn } from '../lib/utils';
import { PremiumCard } from './ui/PremiumCard';
import { CustomSelect } from './ui/CustomSelect';
import { motion } from 'framer-motion';

// ─── Constants ───
const COLORS = ['#84cc16', '#3f3f46', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];
const CHART_TOOLTIP_STYLE = { backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' };

// ─── Helpers ───
const formatRate = (rateBps: number) => {
    if (!rateBps || rateBps <= 0) return '0 bit/s';
    if (rateBps >= 1e9) return `${(rateBps / 1e9).toFixed(2)} Gbit/s`;
    if (rateBps >= 1e6) return `${(rateBps / 1e6).toFixed(2)} Mbit/s`;
    if (rateBps >= 1e3) return `${(rateBps / 1e3).toFixed(2)} kbit/s`;
    return `${rateBps.toFixed(0)} bit/s`;
};

const parseShortDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const parseMonth = (m: string) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

// ─── Summary Card (Premium style) ───
const SummaryCard = ({ title, data, icon: Icon, color, delay }: any) => (
    <PremiumCard
        delay={delay}
        className="p-6 flex flex-col gap-4 group min-h-[160px] relative overflow-hidden"
    >
        <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{title}</span>
            <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:scale-110 transition-all duration-500"
                style={{ boxShadow: `0 0 20px ${color}20` }}
            >
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
        </div>

        <div className="flex flex-col gap-1 relative z-10">
            <span className="text-3xl font-black text-white tracking-tighter">
                {formatBytes(data?.total || 0).split(' ')[0]}
                <span className="text-lg text-white/40 ml-1 font-medium">{formatBytes(data?.total || 0).split(' ')[1]}</span>
            </span>

            <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-[11px] font-black text-white/60 tracking-tight">{formatBytes(data?.rx || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <span className="text-[11px] font-black text-white/60 tracking-tight">{formatBytes(data?.tx || 0)}</span>
                </div>
            </div>
        </div>

        {/* Decorative background glow */}
        <div
            className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none"
            style={{ backgroundColor: color }}
        />
    </PremiumCard>
);

// ─── Rate Bar (vnStat green progress bar style) ───
const RateBar = ({ bps, maxBps }: { bps: number; maxBps: number }) => {
    const pct = maxBps > 0 ? Math.min((bps / maxBps) * 100, 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-[#84cc16] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ─── Table Components ───
const TableHeader = ({ columns }: { columns: string[] }) => (
    <thead className="border-b border-white/[0.03] bg-white/[0.01]">
        <tr className="text-white/30 text-[10px] font-black uppercase tracking-[0.15em]">
            {columns.map((c, i) => (
                <th key={i} className={cn("px-4 py-4 font-black", i === 0 ? 'text-left' : 'text-right')}>{c}</th>
            ))}
        </tr>
    </thead>
);

const EmptyRow = ({ cols, msg }: { cols: number; msg: string }) => (
    <tr><td colSpan={cols} className="px-4 py-12 text-center text-white/20 text-xs font-bold uppercase tracking-widest">{msg}</td></tr>
);

const LoadingRow = ({ cols }: { cols: number }) => (
    <tr><td colSpan={cols} className="px-3 py-6 text-center text-muted-foreground text-sm animate-pulse">Loading...</td></tr>
);

// ─── Section Card (Premium style) ───
const SectionCard = ({ title, icon: Icon, iconColor, children, className }: any) => (
    <PremiumCard className={cn("p-0 flex flex-col border-white/5 bg-[#111114]/30 backdrop-blur-2xl overflow-hidden", className)}>
        <div className="px-6 py-5 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                    <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
                </div>
                <h2 className="text-[13px] font-black text-white uppercase tracking-widest">{title}</h2>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white/60">
                <Info className="w-4 h-4" />
            </button>
        </div>
        <div className="flex-1 p-6">
            {children}
        </div>
    </PremiumCard>
);

// ─── Per-Interface Summary Panel (for "All Interfaces" view) ───
const InterfaceSummaryPanel = ({ iface, data }: { iface: string; data: any }) => (
    <PremiumCard className="p-5">
        <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <Server className="w-4 h-4 text-cyan-400" />
                </div>
                {iface}
            </h3>
            {data?.estimated && data.estimated.total > 0 && (
                <div className="px-3 py-1 rounded-full bg-zinc-800/50 border border-white/5 text-[10px] font-bold text-white/40">
                    Est. {formatBytes(data.estimated.total)} / mo
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="today" data={data?.today} />
            <MiniStat label="yesterday" data={data?.yesterday} />
            <MiniStat label="this month" data={data?.month} />
            <MiniStat label="all time" data={data?.all_time} />
        </div>
    </PremiumCard>
);



const MiniStat = ({ label, data }: { label: string; data: any }) => (
    <div className="flex flex-col gap-2 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all hover:scale-[1.02] group">
        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] group-hover:text-white/40 transition-colors">{label}</span>
        <span className="text-xl font-black text-white leading-none tracking-tighter">
            {formatBytes(data?.total || 0).split(' ')[0]}
            <span className="text-xs text-white/40 ml-1 font-medium">{formatBytes(data?.total || 0).split(' ')[1]}</span>
        </span>
        <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                <span className="text-[10px] font-black text-white/40 tracking-tight">{formatBytes(data?.rx || 0)}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                <span className="text-[10px] font-black text-white/40 tracking-tight">{formatBytes(data?.tx || 0)}</span>
            </div>
        </div>
    </div>
);


// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function BandwidthPage() {
    const { data: interfaces = [] } = useInterfaces();
    const [selectedInterface, setSelectedInterface] = useState<string>('');

    useMemo(() => {
        if (interfaces.length > 0 && !selectedInterface) {
            setSelectedInterface(interfaces[0]);
        }
    }, [interfaces, selectedInterface]);

    const activeInterface = selectedInterface || (interfaces.length > 0 ? interfaces[0] : '');
    const isAllView = !selectedInterface || selectedInterface === '';
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: summaryData } = useBandwidthSummary();
    const summary = summaryData ? summaryData[activeInterface] : null;

    const { data: fiveMin = [], isLoading: loadingFiveMin } = useBandwidthFiveMinute(activeInterface, 24);
    const { data: hourly = [], isLoading: loadingHourly } = useBandwidthHourly(activeInterface, todayStr);
    const { data: daily = [], isLoading: loadingDaily } = useBandwidthDaily(activeInterface, 30);
    const { data: monthly = [], isLoading: loadingMonthly } = useBandwidthMonthly(activeInterface);
    const { data: yearly = [], isLoading: loadingYearly } = useBandwidthYearly(activeInterface);
    const { data: top = [], isLoading: loadingTop } = useBandwidthTop(activeInterface, 10);

    // Max rate for progress bars
    const maxDailyRate = useMemo(() => Math.max(...daily.map((d: any) => d.avg_rate_bps || 0), 1), [daily]);
    const maxTopRate = useMemo(() => Math.max(...top.map((d: any) => d.avg_rate_bps || 0), 1), [top]);

    // Pie data for rx/tx of current interface
    const rxTxPie = useMemo(() => {
        if (!summary?.month) return [];
        return [
            { name: 'rx', value: summary.month.rx || 0 },
            { name: 'tx', value: summary.month.tx || 0 },
        ].filter(d => d.value > 0);
    }, [summary]);

    // Interface breakdown pie for "All" view
    const ifacePie = useMemo(() => {
        if (!summaryData) return [];
        return Object.entries(summaryData).map(([name, d]: [string, any]) => ({
            name,
            value: d?.month?.total || 0
        })).filter(d => d.value > 0);
    }, [summaryData]);

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            {/* ── Header ── */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 mb-2"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                            <Activity className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Traffic <span className="text-emerald-500">Flux</span></h1>
                    </motion.div>
                    <p className="text-gray-400 font-medium text-sm ml-15">Real-time throughput analysis and network data distribution</p>
                </div>

                <div className="flex items-center gap-4">
                    {interfaces.length > 0 && (
                        <div className="flex items-center bg-[#111114] rounded-2xl border border-white/5 p-1">
                            <CustomSelect
                                options={[
                                    { value: '', label: 'Global View' },
                                    ...interfaces.map(iface => ({ value: iface, label: iface }))
                                ]}
                                value={selectedInterface}
                                onChange={(val) => setSelectedInterface(val)}
                                className="border-none bg-transparent"
                            />
                        </div>
                    )}
                    <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-[0.98]">
                        Full Report
                    </button>
                </div>
            </header>

            {/* ── All Interfaces View ── */}
            {isAllView && summaryData && (
                <div className="space-y-3">
                    {Object.entries(summaryData).map(([iface, data]) => (
                        <InterfaceSummaryPanel key={iface} iface={iface} data={data} />
                    ))}
                </div>
            )}

            {/* ── Single Interface View ── */}
            {!isAllView && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <SummaryCard title="Current Day" data={summary?.today} icon={Calendar} color="#3b82f6" delay={0.1} />
                        <SummaryCard title="Prior Day" data={summary?.yesterday} icon={Clock} color="#8b5cf6" delay={0.2} />
                        <SummaryCard title="Monthly Usage" data={summary?.month} icon={Activity} color="#f59e0b" delay={0.3} />
                        <SummaryCard title="Historical Total" data={summary?.all_time} icon={Database} color="#10b981" delay={0.4} />
                        <SummaryCard title="Projected" data={summary?.estimated} icon={TrendingUp} color="#ef4444" delay={0.5} />
                    </div>

                    {/* ── Charts Row ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Main Charts */}
                        <div className="lg:col-span-2 space-y-5">

                            {/* Hourly Chart */}
                            <SectionCard title={`${activeInterface} / hourly`} icon={Clock} iconColor="#3b82f6">
                                <div className="h-[220px] p-4">
                                    {loadingHourly ? <div className="h-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">Loading...</div> :
                                        hourly.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={hourly} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                    <XAxis dataKey="hour" tickFormatter={v => `${v}`} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis tickFormatter={v => formatBytes(v)} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} width={55} />
                                                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#e4e4e7' }} labelFormatter={v => `${v}:00`} formatter={(v: number) => [formatBytes(v), '']} />
                                                    <Bar dataKey="rx" name="rx" stackId="a" fill="#84cc16" radius={[0, 0, 2, 2]} />
                                                    <Bar dataKey="tx" name="tx" stackId="a" fill="#3f3f46" radius={[2, 2, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No hourly data</div>}
                                </div>
                            </SectionCard>

                            {/* 5-Minute Chart */}
                            <SectionCard title={`${activeInterface} / 5 minute`} icon={Zap} iconColor="#f59e0b">
                                <div className="h-[220px] p-4">
                                    {loadingFiveMin ? <div className="h-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">Loading...</div> :
                                        fiveMin.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={fiveMin.slice(-60)} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                    <XAxis
                                                        dataKey="timestamp"
                                                        tickFormatter={(v) => {
                                                            const d = new Date(v);
                                                            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                                                        }}
                                                        stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd"
                                                    />
                                                    <YAxis tickFormatter={v => formatBytes(v)} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} width={55} />
                                                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#e4e4e7' }}
                                                        labelFormatter={(v) => { const d = new Date(v); return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }}
                                                        formatter={(v: number) => [formatBytes(v), '']}
                                                    />
                                                    <Bar dataKey="rx" name="rx" stackId="a" fill="#84cc16" radius={[0, 0, 1, 1]} />
                                                    <Bar dataKey="tx" name="tx" stackId="a" fill="#3f3f46" radius={[1, 1, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No 5-minute data</div>}
                                </div>
                            </SectionCard>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-5">
                            {/* RX/TX Pie */}
                            <SectionCard title="rx / tx ratio (month)" icon={BarChart3} iconColor="#84cc16">
                                <div className="h-[200px] p-3">
                                    {rxTxPie.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={rxTxPie} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                                                    <Cell fill="#84cc16" />
                                                    <Cell fill="#3f3f46" />
                                                </Pie>
                                                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#e4e4e7' }} formatter={(v: number) => [formatBytes(v), '']} />
                                                <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>}
                                </div>
                            </SectionCard>

                            {/* Interface Breakdown Pie */}
                            <SectionCard title="Usage by Interface" icon={Server} iconColor="#06b6d4">
                                <div className="h-[200px] p-3">
                                    {ifacePie.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={ifacePie} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                                                    {ifacePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#e4e4e7' }} formatter={(v: number) => [formatBytes(v), '']} />
                                                <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>}
                                </div>
                            </SectionCard>
                        </div>
                    </div>

                    {/* ── Tables Grid ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                        {/* Daily Table */}
                        <SectionCard title={`${activeInterface} / daily`} icon={Calendar} iconColor="#8b5cf6">
                            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <TableHeader columns={['Day', 'RX', 'TX', 'Total', 'Avg. Rate', '']} />
                                    <tbody>
                                        {loadingDaily ? <LoadingRow cols={6} /> :
                                            daily.length > 0 ? daily.map((d: any, i: number) => (
                                                <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-4 py-3.5 text-white/80 font-bold tracking-tight">{parseShortDate(d.date)}</td>
                                                    <td className="px-4 py-3.5 text-right text-emerald-400 font-bold font-mono">{formatBytes(d.rx)}</td>
                                                    <td className="px-4 py-3.5 text-right text-blue-400 font-bold font-mono">{formatBytes(d.tx)}</td>
                                                    <td className="px-4 py-3.5 text-right text-white font-black font-mono">{formatBytes(d.total)}</td>
                                                    <td className="px-4 py-3.5 text-right text-white/30 font-bold font-mono text-[10px]">{formatRate(d.avg_rate_bps)}</td>
                                                    <td className="px-4 py-3.5"><RateBar bps={d.avg_rate_bps} maxBps={maxDailyRate} /></td>
                                                </tr>
                                            )) : <EmptyRow cols={6} msg="No daily data" />}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>

                        {/* Top Days */}
                        <SectionCard title={`${activeInterface} / top ${top.length}`} icon={TrendingUp} iconColor="#ef4444">
                            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <TableHeader columns={['#', 'Day', 'RX', 'TX', 'Total', 'Avg. Rate', '']} />
                                    <tbody>
                                        {loadingTop ? <LoadingRow cols={7} /> :
                                            top.length > 0 ? top.map((d: any, i: number) => (
                                                <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-4 py-3.5 text-white/20 font-black font-mono text-center text-[10px]">{i + 1}</td>
                                                    <td className="px-4 py-3.5 text-white/80 font-bold tracking-tight">{parseShortDate(d.date)}</td>
                                                    <td className="px-4 py-3.5 text-right text-emerald-400 font-bold font-mono">{formatBytes(d.rx)}</td>
                                                    <td className="px-4 py-3.5 text-right text-blue-400 font-bold font-mono">{formatBytes(d.tx)}</td>
                                                    <td className="px-4 py-3.5 text-right text-white font-black font-mono">{formatBytes(d.total)}</td>
                                                    <td className="px-4 py-3.5 text-right text-white/30 font-bold font-mono text-[10px]">{formatRate(d.avg_rate_bps)}</td>
                                                    <td className="px-4 py-3.5"><RateBar bps={d.avg_rate_bps} maxBps={maxTopRate} /></td>
                                                </tr>
                                            )) : <EmptyRow cols={7} msg="No top days" />}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>

                        {/* Monthly Table */}
                        <SectionCard title={`${activeInterface} / monthly`} icon={BarChart3} iconColor="#f59e0b">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <TableHeader columns={['Month', 'RX', 'TX', 'Total', 'Avg. Rate']} />
                                    <tbody>
                                        {loadingMonthly ? <LoadingRow cols={5} /> :
                                            monthly.length > 0 ? (
                                                <>
                                                    {monthly.map((m: any, i: number) => (
                                                        <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-4 py-3.5 text-white/80 font-bold tracking-tight">{parseMonth(m.month)}</td>
                                                            <td className="px-4 py-3.5 text-right text-emerald-400 font-bold font-mono">{formatBytes(m.rx)}</td>
                                                            <td className="px-4 py-3.5 text-right text-blue-400 font-bold font-mono">{formatBytes(m.tx)}</td>
                                                            <td className="px-4 py-3.5 text-right text-white font-black font-mono">{formatBytes(m.total)}</td>
                                                            <td className="px-4 py-3.5 text-right text-white/30 font-bold font-mono text-[10px]">{formatRate(m.avg_rate_bps)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Estimated row for current month */}
                                                    {monthly[0]?.estimated_total && (
                                                        <tr className="border-b border-white/[0.02] bg-white/[0.01]">
                                                            <td className="px-4 py-3 text-white/20 italic font-bold text-[10px] uppercase tracking-widest pl-10">estimated</td>
                                                            <td className="px-4 py-3 text-right text-emerald-500/40 font-bold font-mono">{formatBytes(monthly[0].estimated_rx)}</td>
                                                            <td className="px-4 py-3 text-right text-blue-500/40 font-bold font-mono">{formatBytes(monthly[0].estimated_tx)}</td>
                                                            <td className="px-4 py-3 text-right text-white/40 font-black font-mono">{formatBytes(monthly[0].estimated_total)}</td>
                                                            <td className="px-4 py-3"></td>
                                                        </tr>
                                                    )}
                                                </>
                                            ) : <EmptyRow cols={5} msg="No monthly data" />}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>

                        {/* Yearly Table */}
                        <SectionCard title={`${activeInterface} / yearly`} icon={Database} iconColor="#10b981">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <TableHeader columns={['Year', 'RX', 'TX', 'Total', 'Avg. Rate']} />
                                    <tbody>
                                        {loadingYearly ? <LoadingRow cols={5} /> :
                                            yearly.length > 0 ? (
                                                <>
                                                    {yearly.map((y: any, i: number) => (
                                                        <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-4 py-3.5 text-white/80 font-bold tracking-tight">{y.year}</td>
                                                            <td className="px-4 py-3.5 text-right text-emerald-400 font-bold font-mono">{formatBytes(y.rx)}</td>
                                                            <td className="px-4 py-3.5 text-right text-blue-400 font-bold font-mono">{formatBytes(y.tx)}</td>
                                                            <td className="px-4 py-3.5 text-right text-white font-black font-mono">{formatBytes(y.total)}</td>
                                                            <td className="px-4 py-3.5 text-right text-white/30 font-bold font-mono text-[10px]">{formatRate(y.avg_rate_bps)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Estimated row for current year */}
                                                    {yearly[0]?.estimated_total && (
                                                        <tr className="border-b border-white/[0.02] bg-white/[0.01]">
                                                            <td className="px-4 py-3 text-white/20 italic font-bold text-[10px] uppercase tracking-widest pl-10">estimated</td>
                                                            <td className="px-4 py-3 text-right text-emerald-500/40 font-bold font-mono">{formatBytes(yearly[0].estimated_rx)}</td>
                                                            <td className="px-4 py-3 text-right text-blue-500/40 font-bold font-mono">{formatBytes(yearly[0].estimated_tx)}</td>
                                                            <td className="px-4 py-3 text-right text-white/40 font-black font-mono">{formatBytes(yearly[0].estimated_total)}</td>
                                                            <td className="px-4 py-3"></td>
                                                        </tr>
                                                    )}
                                                </>
                                            ) : <EmptyRow cols={5} msg="No yearly data" />}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    </div>
                </>
            )}
        </div>
    );
}
