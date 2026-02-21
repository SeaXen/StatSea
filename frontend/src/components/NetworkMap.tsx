import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Network, Router, Monitor, Smartphone, Laptop, Tablet, Box, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import axiosInstance from '../config/axiosInstance';
import { PremiumCard } from './ui/PremiumCard';

interface Node {
    id: string;
    label: string;
    type: string;
    ip: string;
    group: string;
}

interface Edge {
    from: string;
    to: string;
    value: number;
}

interface TopologyData {
    nodes: Node[];
    edges: Edge[];
}

export function NetworkMap() {
    const [data, setData] = useState<TopologyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleDrag = (nodeId: string, info: PanInfo) => {
        setNodePositions((prev) => {
            if (!prev[nodeId]) return prev;
            return {
                ...prev,
                [nodeId]: {
                    x: prev[nodeId].x + info.delta.x,
                    y: prev[nodeId].y + info.delta.y,
                },
            };
        });
    };

    useEffect(() => {
        const fetchTopology = async () => {
            try {
                const response = await axiosInstance.get('/network/topology');
                const newData = response.data;
                setData(newData);

                // Initialize positions if not already set
                setNodePositions(prev => {
                    const next = { ...prev };
                    const deviceNodes = newData.nodes.filter((n: Node) => n.id !== 'router');

                    deviceNodes.forEach((node: Node, index: number) => {
                        if (!next[node.id]) {
                            // Multi-orbit logic: inner orbit for first 4 devices, outer for rest
                            const isInner = index < 4;
                            const orbitNodes = isInner ? Math.min(deviceNodes.length, 4) : Math.max(0, deviceNodes.length - 4);
                            const orbitIndex = isInner ? index : index - 4;

                            const angle = (orbitIndex / (orbitNodes || 1)) * 2 * Math.PI;
                            const radius = isInner ? 220 : 380;

                            next[node.id] = {
                                x: Math.cos(angle) * radius,
                                y: Math.sin(angle) * radius
                            };
                        }
                    });
                    return next;
                });
            } catch (error) {
                console.error('Failed to fetch topology:', error);
                setData({ nodes: [], edges: [] });
            } finally {
                setLoading(false);
            }
        };

        fetchTopology();
        const interval = setInterval(fetchTopology, 30000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'router': return <Router className="w-8 h-8" />;
            case 'pc': return <Monitor className="w-6 h-6" />;
            case 'mobile': return <Smartphone className="w-6 h-6" />;
            case 'laptop': return <Laptop className="w-6 h-6" />;
            case 'tablet': return <Tablet className="w-6 h-6" />;
            case 'iot': return <Box className="w-6 h-6" />;
            default: return <Box className="w-6 h-6" />;
        }
    };



    if (loading) {
        return (
            <div className="flex h-[calc(100vh-120px)] items-center justify-center">
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 border-t-2 border-r-2 border-[#155dfc] rounded-full"
                    />
                    <Network className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white/40" />
                </div>
            </div>
        );
    }

    const deviceNodes = data?.nodes.filter(n => n.id !== 'router') || [];

    return (
        <div
            ref={containerRef}
            className="relative w-full h-[calc(100vh-120px)] overflow-hidden bg-[#050505] rounded-[32px] border border-white/5 shadow-2xl"
        >
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] pointer-events-none mix-blend-overlay" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)]" />

            {/* Decorative background orbits */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] border border-white/[0.03] rounded-full pointer-events-none shadow-[inset_0_0_20px_rgba(255,255,255,0.01)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] border border-white/[0.02] rounded-full pointer-events-none" />

            {/* Topology Canvas */}
            <div className="relative w-full h-full flex items-center justify-center">

                {/* Connection Lines (SVG Layer) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <defs>
                        <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse" x1="50%" y1="50%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {deviceNodes.map((node) => {
                        const pos = nodePositions[node.id];
                        if (!pos) return null;

                        return (
                            <React.Fragment key={`line-${node.id}`}>
                                <motion.line
                                    x1="50%"
                                    y1="50%"
                                    x2={`calc(50% + ${pos.x}px)`}
                                    y2={`calc(50% + ${pos.y}px)`}
                                    stroke="url(#lineGradient)"
                                    strokeWidth="1.5"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 1 }}
                                />
                                {/* Pulsing Data Flow Particle */}
                                <motion.circle
                                    r="2.5"
                                    fill="#6366f1"
                                    filter="url(#glow)"
                                    animate={{
                                        cx: ["50%", `calc(50% + ${pos.x}px)`],
                                        cy: ["50%", `calc(50% + ${pos.y}px)`],
                                        opacity: [0, 1, 0],
                                        scale: [1, 1.5, 1]
                                    }}
                                    transition={{
                                        duration: 2 + Math.random() * 2,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: Math.random() * 2
                                    }}
                                />
                            </React.Fragment>
                        );
                    })}
                </svg>

                {/* Router (Center) */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-20"
                >
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 p-[1px] shadow-[0_0_80px_rgba(79,70,229,0.2)] group">
                        <div className="w-full h-full rounded-full bg-[#0a0a0c] flex flex-col items-center justify-center border border-white/10 overflow-hidden relative">
                            {/* Scanning Pulse Effect */}
                            <motion.div
                                animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                                className="absolute inset-0 bg-indigo-500/20 rounded-full"
                            />
                            <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors" />
                            <Router className="w-12 h-12 text-indigo-400 mb-2 relative z-10" />
                            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-500/80 relative z-10">Gateway</span>

                            {/* Spinning border fragment */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 border-t border-indigo-500/40 rounded-full pointer-events-none"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Device Nodes */}
                {deviceNodes.map((node) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;

                    return (
                        <motion.div
                            key={node.id}
                            drag
                            dragConstraints={containerRef}
                            onDrag={(_, info) => handleDrag(node.id, info)}
                            initial={{ scale: 0, x: 0, y: 0 }}
                            animate={{ scale: 1, x: pos.x, y: pos.y }}
                            whileHover={{ scale: 1.05 }}
                            whileDrag={{ scale: 1.1, zIndex: 60 }}
                            onClick={() => setSelectedNode(node)}
                            className={cn(
                                "absolute z-30 cursor-grab active:cursor-grabbing group flex flex-col items-center",
                                selectedNode?.id === node.id && "z-50"
                            )}
                        >
                            <div className={cn(
                                "w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 relative",
                                "bg-[#111114]/60 backdrop-blur-2xl border border-white/10 group-hover:border-indigo-500/40 group-hover:shadow-[0_0_40px_rgba(99,101,241,0.15)]",
                                selectedNode?.id === node.id && "border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_50px_rgba(99,101,241,0.25)]"
                            )}>
                                <div className={cn(
                                    "transition-colors duration-500",
                                    selectedNode?.id === node.id ? "text-indigo-400" : "text-white/40 group-hover:text-white"
                                )}>
                                    {getIcon(node.type)}
                                </div>
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0a0a0c] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            </div>
                            <div className="mt-4 flex flex-col items-center">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-500",
                                    selectedNode?.id === node.id ? "text-white" : "text-white/30 group-hover:text-white/70"
                                )}>
                                    {node.label}
                                </span>
                                <span className="text-[9px] font-bold text-white/5 uppercase tracking-widest mt-1 group-hover:text-white/10 transition-colors">
                                    {node.ip}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Selection Panel */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        className="absolute bottom-10 left-10 z-50 w-[380px]"
                    >
                        <PremiumCard className="p-8 border-white/10 bg-[#0a0a0c]/80 backdrop-blur-3xl shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                                    {getIcon(selectedNode.type)}
                                </div>
                                <div>
                                    <h3 className="text-white text-xl font-black tracking-tight">{selectedNode.label}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <p className="text-indigo-400/80 text-[11px] font-black uppercase tracking-widest leading-none">{selectedNode.ip}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    className="ml-auto w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/20 hover:text-white transition-all shadow-lg group/close"
                                >
                                    <ShieldCheck className="w-5 h-5 group-hover/close:scale-110 transition-transform" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.05] transition-all">
                                    <span className="text-[10px] uppercase font-black text-white/20 tracking-widest block mb-2.5">Data Transmission</span>
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-emerald-400" />
                                        <span className="text-[13px] font-black text-white/90">2.4 MB/s</span>
                                    </div>
                                </div>
                                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.05] transition-all">
                                    <span className="text-[10px] uppercase font-black text-white/20 tracking-widest block mb-2.5">Latency</span>
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-indigo-400 rotate-90" />
                                        <span className="text-[13px] font-black text-white/90">14 ms</span>
                                    </div>
                                </div>
                                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.05] transition-all col-span-2">
                                    <span className="text-[10px] uppercase font-black text-white/20 tracking-widest block mb-3">Recent Security Activity</span>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                            <span className="text-[11px] font-bold text-white/60">No threats detected</span>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-400/80 uppercase">Secured</span>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full mt-6 py-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] text-indigo-300 hover:text-white transition-all shadow-xl">
                                Detailed Traffic Analysis
                            </button>
                        </PremiumCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend / Stats Floating */}
            <div className="absolute top-10 right-10 flex flex-col gap-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-6 py-4 rounded-[2rem] bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center gap-4 shadow-2xl"
                >
                    <div className="flex -space-x-2">
                        {[Router, Monitor, Smartphone].map((Icon, i) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-[#111114] border border-white/10 flex items-center justify-center">
                                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                            </div>
                        ))}
                    </div>
                    <div className="w-[1px] h-6 bg-white/10 mx-1" />
                    <div className="flex flex-col">
                        <span className="text-[14px] font-black text-white leading-none">
                            {deviceNodes.length + 1}
                        </span>
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.15em] mt-1">
                            Active Entities
                        </span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
