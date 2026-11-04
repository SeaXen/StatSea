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
import { CustomSelect } from './ui/CustomSelect';

// ─── Constants ───
const COLORS = ['#84cc16', '#3f3f46', '#10b981', '#0ea5e9', '#ef4444', '#f59e0b', '#06b6d4'];
const CHART_TOOLTIP_STYLE = { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

// ─── Helpers ───
const formatRate = (rateBps?: number) => {
    if (!rateBps || rateBps <= 0) return '0 bit/s';
    if (rateBps >= 1e9) return `${(rateBps / 1e9).toFixed(2)} Gbit/s`;
    if (rateBps >= 1e6) return `${(rateBps / 1e6).toFixed(2)} Mbit/s`;
    if (rateBps >= 1e3) return `${(rateBps / 1e3).toFixed(2)} kbit/s`;
    return `${rateBps.toFixed(0)} bit/s`;
};

const parseShortDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const parseMonth = (m?: string) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

interface BandwidthMetric {
    rx?: number;
    tx?: number;
    total?: number;
    [key: string]: unknown;
}

interface InterfaceSummary {
    today?: BandwidthMetric;
    yesterday?: BandwidthMetric;
    month?: BandwidthMetric;
    all_time?: BandwidthMetric;
    estimated?: { total: number };
    [key: string]: unknown;
}

interface BandwidthRow {
    date?: string;
    month?: string;
    year?: number | string;
    rx?: number;
    tx?: number;
    total?: number;
    avg_rate_bps?: number;
    estimated_rx?: number;
    estimated_tx?: number;
    estimated_total?: number;
}

interface SummaryCardProps {
    title: string;
    data?: BandwidthMetric;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    delay?: number;
}

interface SectionCardProps {
    title: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    iconColor?: string;
    children: React.ReactNode;
    className?: string;
}

// ─── Summary Card (Console style) ───
const SummaryCard = ({ title, data, icon: Icon, color }: SummaryCardProps) => (
    <div className="panel p-3 rounded-[7px] border border-line bg-panel flex flex-col justify-between hover:border-line-strong transition-colors">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint">{title}</span>
            <div className="w-5 h-5 rounded-[4px] flex items-center justify-center bg-raised border border-line">
                <Icon className="h-3 w-3" style={{ color }} />
            </div>
        </div>

        <div className="mt-2">
            <div className="text-lg font-semibold text-text font-mono num leading-none">
                {formatBytes(data?.total || 0).split(' ')[0]}
                <span className="text-xs text-text-soft ml-1 font-normal">{formatBytes(data?.total || 0).split(' ')[1]}</span>
            </div>

            <div className="flex items-center gap-3 mt-2 font-mono text-[10px]">
                <span className="text-ok">↓ {formatBytes(data?.rx || 0)}</span>
                <span className="text-upload">↑ {formatBytes(data?.tx || 0)}</span>
            </div>
        </div>
    </div>
);

// ─── Rate Bar (Console progress bar style) ───
const RateBar = ({ bps = 0, maxBps = 1 }: { bps?: number; maxBps?: number }) => {
    const pct = maxBps > 0 ? Math.min((bps / maxBps) * 100, 100) : 0;
    return (
        <div className="meter w-16 inline-block">
            <div className="track">
                <div className="fill bg-ok" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ─── Table Components ───
const TableHeader = ({ columns }: { columns: string[] }) => (
    <thead className="border-b border-line bg-raised/50 font-mono text-[10px] text-faint uppercase">
        <tr>
            {columns.map((c, i) => (
                <th key={i} className={cn("px-3 py-2 font-medium tracking-wider", i === 0 ? 'text-left' : 'text-right')}>{c}</th>
            ))}
        </tr>
    </thead>
);

const EmptyRow = ({ cols, msg }: { cols: number; msg: string }) => (
    <tr><td colSpan={cols} className="px-4 py-8 text-center text-text-soft font-mono text-xs">{msg}</td></tr>
);

const LoadingRow = ({ cols }: { cols: number }) => (
    <tr><td colSpan={cols} className="px-3 py-6 text-center text-text-soft font-mono text-xs animate-pulse">Loading…</td></tr>
);

// ─── Section Card (Console style) ───
const SectionCard = ({ title, icon: Icon, iconColor, children, className }: SectionCardProps) => (
    <div className={cn("panel p-0 overflow-hidden", className)}>
        <div className="panel-head border-b border-line px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
                <span className="font-mono text-xs uppercase tracking-wider text-text font-medium">{title}</span>
            </div>
            <button
                aria-label="Section info"
                title="Section info"
                className="p-1 hover:bg-raised rounded text-faint hover:text-text transition-colors"
            >
                <Info className="w-3.5 h-3.5" />
            </button>
        </div>
        <div className="p-3">
            {children}
        </div>
    </div>
);

// ─── Per-Interface Summary Panel (for "All Interfaces" view) ───
const InterfaceSummaryPanel = ({ iface, data }: { iface: string; data?: InterfaceSummary }) => (
    <div className="panel p-3">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-[4px] bg-raised border border-line flex items-center justify-center text-accent">
                    <Server className="w-3.5 h-3.5" />
                </div>
                <span className="font-mono text-xs font-semibold text-text">{iface}</span>
            </div>
            {data?.estimated && data.estimated.total > 0 && (
                <span className="status ok text-[10px] font-mono px-2 py-0.5">
                    Est. {formatBytes(data.estimated.total)} / mo
                </span>
            )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <MiniStat label="today" data={data?.today} />
            <MiniStat label="yesterday" data={data?.yesterday} />
            <MiniStat label="this month" data={data?.month} />
            <MiniStat label="all time" data={data?.all_time} />
        </div>
    </div>
);

const MiniStat = ({ label, data }: { label: string; data?: BandwidthMetric }) => (
    <div className="p-2.5 rounded-[5px] bg-raised border border-line font-mono flex flex-col justify-between">
        <span className="text-[10px] text-faint uppercase">{label}</span>
        <div className="text-sm font-semibold text-text num my-1">
            {formatBytes(data?.total || 0).split(' ')[0]}
            <span className="text-[10px] text-text-soft ml-1 font-normal">{formatBytes(data?.total || 0).split(' ')[1]}</span>
        </div>
        <div className="flex gap-2 text-[10px]">
            <span className="text-ok">↓ {formatBytes(data?.rx || 0)}</span>
            <span className="text-upload">↑ {formatBytes(data?.tx || 0)}</span>
        </div>
    </div>
);


// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function BandwidthPage() {
    const { data: interfaces = [] } = useInterfaces();
    const [selectedInterface, setSelectedInterface] = useState<string>('');

    const activeInterface = selectedInterface || (interfaces.length > 0 ? interfaces[0] : '');
    const isAllView = !selectedInterface || selectedInterface === '';
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: summaryData } = useBandwidthSummary();
    const summaryDataTyped = summaryData as Record<string, InterfaceSummary> | undefined;
    const summary: InterfaceSummary | null = (summaryDataTyped && activeInterface ? summaryDataTyped[activeInterface] : null) as InterfaceSummary | null;

    const { data: fiveMin = [], isLoading: loadingFiveMin } = useBandwidthFiveMinute(activeInterface, 24);
    const { data: hourly = [], isLoading: loadingHourly } = useBandwidthHourly(activeInterface, todayStr);
    const { data: daily = [], isLoading: loadingDaily } = useBandwidthDaily(activeInterface, 30);
    const { data: monthly = [], isLoading: loadingMonthly } = useBandwidthMonthly(activeInterface);
    const { data: yearly = [], isLoading: loadingYearly } = useBandwidthYearly(activeInterface);
    const { data: top = [], isLoading: loadingTop } = useBandwidthTop(activeInterface, 10);

    // Max rate for progress bars
    const maxDailyRate = useMemo(() => Math.max(...(daily as BandwidthRow[]).map(d => d.avg_rate_bps || 0), 1), [daily]);
    const maxTopRate = useMemo(() => Math.max(...(top as BandwidthRow[]).map(d => d.avg_rate_bps || 0), 1), [top]);

    // Pie data for rx/tx of current interface
    const rxTxPie = useMemo(() => {
        const currentSummary = summary as InterfaceSummary | null;
        if (!currentSummary?.month) return [];
        return [
            { name: 'rx', value: currentSummary.month.rx || 0 },
            { name: 'tx', value: currentSummary.month.tx || 0 },
        ].filter(d => d.value > 0);
    }, [summary]);

    // Interface breakdown pie for "All" view
    const ifacePie = useMemo(() => {
        if (!summaryData) return [];
        return Object.entries(summaryData as Record<string, InterfaceSummary>).map(([name, d]) => ({
            name,
            value: d?.month?.total || 0
        })).filter(d => d.value > 0);
    }, [summaryData]);

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="panel p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">Traffic Flux</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">
                                {isAllView ? 'ALL INTERFACES' : activeInterface}
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">
                            Real-time throughput analysis and bandwidth telemetry
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {interfaces.length > 0 && (
                        <CustomSelect
                            options={[
                                { value: '', label: 'Global View' },
                                ...interfaces.map(iface => ({ value: iface, label: iface }))
                            ]}
                            value={selectedInterface}
                            onChange={(val) => setSelectedInterface(val)}
                        />
                    )}
                    <button className="px-3.5 py-1.5 bg-accent hover:opacity-90 text-[#0f1115] rounded-[7px] text-xs font-semibold font-mono transition-opacity">
                        FULL REPORT
                    </button>
                </div>
            </div>

            {/* ── All Interfaces View ── */}
            {isAllView && summaryDataTyped && (
                <div className="space-y-3">
                    {Object.entries(summaryDataTyped).map(([iface, data]) => (
                        <InterfaceSummaryPanel key={iface} iface={iface} data={data as InterfaceSummary} />
                    ))}
                </div>
            )}

            {/* ── Single Interface View ── */}
            {!isAllView && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <SummaryCard title="Current Day" data={summary?.today} icon={Calendar} color="#3b82f6" delay={0.1} />
                        <SummaryCard title="Prior Day" data={summary?.yesterday} icon={Clock} color="#06b6d4" delay={0.2} />
                        <SummaryCard title="Monthly Usage" data={summary?.month} icon={Activity} color="#f59e0b" delay={0.3} />
                        <SummaryCard title="Historical Total" data={summary?.all_time} icon={Database} color="#10b981" delay={0.4} />
                        <SummaryCard title="Projected" data={summary?.estimated as BandwidthMetric | undefined} icon={TrendingUp} color="#ef4444" delay={0.5} />
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
                                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                        <SectionCard title={`${activeInterface} / daily`} icon={Calendar} iconColor="#3b82f6">
                            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <TableHeader columns={['Day', 'RX', 'TX', 'Total', 'Avg. Rate', '']} />
                                    <tbody>
                                        {loadingDaily ? <LoadingRow cols={6} /> :
                                            daily.length > 0 ? (daily as BandwidthRow[]).map((d, i: number) => (
                                                <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
                                                    <td className="px-4 py-3.5 text-foreground font-semibold tracking-tight">{parseShortDate(d.date)}</td>
                                                    <td className="px-4 py-3.5 text-right text-emerald-500 font-bold font-mono tabular-nums">{formatBytes(d.rx || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-blue-500 font-bold font-mono tabular-nums">{formatBytes(d.tx || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-foreground font-black font-mono tabular-nums">{formatBytes(d.total || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-muted-foreground/70 font-bold font-mono text-[10px] tabular-nums">{formatRate(d.avg_rate_bps)}</td>
                                                    <td className="px-4 py-3.5"><RateBar bps={d.avg_rate_bps || 0} maxBps={maxDailyRate} /></td>
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
                                            top.length > 0 ? (top as BandwidthRow[]).map((d, i: number) => (
                                                <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
                                                    <td className="px-4 py-3.5 text-muted-foreground/50 font-black font-mono text-center text-[10px]">{i + 1}</td>
                                                    <td className="px-4 py-3.5 text-foreground font-semibold tracking-tight">{parseShortDate(d.date)}</td>
                                                    <td className="px-4 py-3.5 text-right text-emerald-500 font-bold font-mono tabular-nums">{formatBytes(d.rx || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-blue-500 font-bold font-mono tabular-nums">{formatBytes(d.tx || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-foreground font-black font-mono tabular-nums">{formatBytes(d.total || 0)}</td>
                                                    <td className="px-4 py-3.5 text-right text-muted-foreground/70 font-bold font-mono text-[10px] tabular-nums">{formatRate(d.avg_rate_bps)}</td>
                                                    <td className="px-4 py-3.5"><RateBar bps={d.avg_rate_bps || 0} maxBps={maxTopRate} /></td>
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
                                                    {(monthly as BandwidthRow[]).map((m, i: number) => (
                                                        <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                                                            <td className="px-4 py-3.5 text-foreground font-semibold tracking-tight">{parseMonth(m.month)}</td>
                                                            <td className="px-4 py-3.5 text-right text-emerald-500 font-bold font-mono tabular-nums">{formatBytes(m.rx || 0)}</td>
                                                            <td className="px-4 py-3.5 text-right text-blue-500 font-bold font-mono tabular-nums">{formatBytes(m.tx || 0)}</td>
                                                            <td className="px-4 py-3.5 text-right text-foreground font-black font-mono tabular-nums">{formatBytes(m.total || 0)}</td>
                                                            <td className="px-4 py-3.5 text-right text-muted-foreground/70 font-bold font-mono text-[10px] tabular-nums">{formatRate(m.avg_rate_bps)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Estimated row for current month */}
                                                    {Boolean((monthly as BandwidthRow[])[0]?.estimated_total) && (
                                                        <tr className="border-b border-border/40 bg-muted/20">
                                                            <td className="px-4 py-3 text-muted-foreground/60 italic font-bold text-[10px] uppercase tracking-widest pl-10">estimated</td>
                                                            <td className="px-4 py-3 text-right text-emerald-500/70 font-bold font-mono tabular-nums">{formatBytes((monthly as BandwidthRow[])[0]?.estimated_rx || 0)}</td>
                                                            <td className="px-4 py-3 text-right text-blue-500/70 font-bold font-mono tabular-nums">{formatBytes((monthly as BandwidthRow[])[0]?.estimated_tx || 0)}</td>
                                                            <td className="px-4 py-3 text-right text-foreground/80 font-black font-mono tabular-nums">{formatBytes((monthly as BandwidthRow[])[0]?.estimated_total || 0)}</td>
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
                                                    {(yearly as BandwidthRow[]).map((y, i: number) => (
                                                        <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                                                            <td className="px-4 py-3.5 text-foreground font-semibold tracking-tight">{y.year}</td>
                                                            <td className="px-4 py-3.5 text-right text-emerald-500 font-bold font-mono tabular-nums">{formatBytes(y.rx || 0)}</td>
                                                            <td className="px-4 py-3.5 text-right text-blue-500 font-bold font-mono tabular-nums">{formatBytes(y.tx || 0)}</td>
                                                            <td className="px-4 py-3.5 text-right text-foreground font-black font-mono tabular-nums">{formatBytes(y.total || 0)}</td>
                                                            <td className="px-4 py-3.5 text-right text-muted-foreground/70 font-bold font-mono text-[10px] tabular-nums">{formatRate(y.avg_rate_bps)}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Estimated row for current year */}
                                                    {yearly[0]?.estimated_total && (
                                                        <tr className="border-b border-border/40 bg-muted/20">
                                                            <td className="px-4 py-3 text-muted-foreground/60 italic font-bold text-[10px] uppercase tracking-widest pl-10">estimated</td>
                                                            <td className="px-4 py-3 text-right text-emerald-500/70 font-bold font-mono tabular-nums">{formatBytes(Number(yearly[0].estimated_rx) || 0)}</td>
                                                            <td className="px-4 py-3 text-right text-blue-500/70 font-bold font-mono tabular-nums">{formatBytes(Number(yearly[0].estimated_tx) || 0)}</td>
                                                            <td className="px-4 py-3 text-right text-foreground/80 font-black font-mono tabular-nums">{formatBytes(Number(yearly[0].estimated_total) || 0)}</td>
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
