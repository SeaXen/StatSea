import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Network, Router, Monitor, Smartphone, Laptop, Tablet, Box, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import axiosInstance from '../config/axiosInstance';

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

                const rawNodes = Array.isArray(newData?.nodes) ? newData.nodes : [];
                const deviceNodes = rawNodes.filter((n: Node) => n.id !== 'router');

                // Initialize positions if not already set
                setNodePositions(prev => {
                    const next = { ...prev };

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

    const safeNodes = Array.isArray(data?.nodes) ? data.nodes : [];
    const deviceNodes = safeNodes.filter(n => n.id !== 'router');

    return (
        <div
            ref={containerRef}
            className="panel p-0 relative w-full h-[calc(100vh-140px)] min-h-[580px] overflow-hidden bg-bg border border-line rounded-[9px]"
        >
            {/* Topbar Info Pill */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-none">
                <div className="p-2 bg-bar border border-line rounded-[7px] flex items-center gap-2.5">
                    <Network className="w-4 h-4 text-accent" />
                    <div>
                        <div className="text-xs font-semibold text-text tracking-tight flex items-center gap-2">
                            <span>Local Network Topology</span>
                            <span className="status ok text-[9px] font-mono px-1.5 py-0.2">MAP ACTIVE</span>
                        </div>
                        <p className="text-[10px] font-mono text-faint">Drag nodes to re-orient telemetry layout</p>
                    </div>
                </div>
            </div>

            {/* Decorative Subdued Orbits */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-line/40 rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] border border-line/20 rounded-full pointer-events-none" />

            {/* Topology Canvas */}
            <div className="relative w-full h-full flex items-center justify-center">

                {/* Connection Lines (SVG Layer) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <defs>
                        <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse" x1="50%" y1="50%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#7c8cff" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#4fd1e8" stopOpacity="0.5" />
                        </linearGradient>
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
                                    strokeWidth="1.2"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 1 }}
                                />
                                {/* Pulsing Data Flow Particle */}
                                <motion.g
                                    animate={{
                                        x: [0, pos.x],
                                        y: [0, pos.y],
                                        opacity: [0, 1, 0],
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={{
                                        duration: 2.5 + ((node.id.charCodeAt(0) || 0) % 3) * 0.5,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: ((node.id.charCodeAt(node.id.length - 1) || 0) % 5) * 0.4
                                    }}
                                >
                                    <circle
                                        cx="50%"
                                        cy="50%"
                                        r="2"
                                        fill="#7c8cff"
                                    />
                                </motion.g>
                            </React.Fragment>
                        );
                    })}
                </svg>

                {/* Router (Center Gateway Node) */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-20"
                >
                    <div className="w-28 h-28 rounded-[9px] bg-bar border border-line-strong flex flex-col items-center justify-center relative shadow-2xl">
                        <Router className="w-7 h-7 text-accent mb-1 relative z-10" />
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-text relative z-10">Gateway</span>
                        <span className="text-[9px] font-mono text-faint">192.168.1.1</span>
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-ok" />
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
                                "w-14 h-14 rounded-[7px] flex items-center justify-center transition-colors relative",
                                "bg-panel border border-line group-hover:border-line-strong",
                                selectedNode?.id === node.id && "border-accent bg-raised text-accent"
                            )}>
                                <div className={cn(
                                    "transition-colors",
                                    selectedNode?.id === node.id ? "text-accent" : "text-muted group-hover:text-text"
                                )}>
                                    {getIcon(node.type)}
                                </div>
                                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-ok" />
                            </div>
                            <div className="mt-1 flex flex-col items-center font-mono">
                                <span className={cn(
                                    "text-[10px] font-medium tracking-tight transition-colors truncate max-w-[90px]",
                                    selectedNode?.id === node.id ? "text-accent" : "text-text-soft group-hover:text-text"
                                )}>
                                    {node.label}
                                </span>
                                <span className="text-[9px] text-faint">
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
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="absolute bottom-4 left-4 z-50 w-[340px]"
                    >
                        <div className="panel p-4 bg-panel border border-line-strong rounded-[7px] shadow-2xl font-mono text-xs">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-[5px] bg-raised border border-line flex items-center justify-center text-accent">
                                    {getIcon(selectedNode.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-text font-semibold text-xs tracking-tight truncate">{selectedNode.label}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="status ok text-[9px] px-1 py-0.2">ONLINE</span>
                                        <p className="text-accent text-[11px] font-mono tabular-nums">{selectedNode.ip}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    aria-label="Close detail modal"
                                    className="p-1 rounded-[5px] text-muted hover:text-text hover:bg-raised transition-colors"
                                >
                                    <ShieldCheck className="w-4 h-4 text-ok" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2.5 rounded-[5px] bg-raised border border-line">
                                    <span className="text-[10px] uppercase font-mono text-faint block mb-1">Throughput</span>
                                    <div className="flex items-center gap-1.5 text-text num font-semibold">
                                        <Activity className="w-3.5 h-3.5 text-ok" />
                                        <span>2.4 MB/s</span>
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-[5px] bg-raised border border-line">
                                    <span className="text-[10px] uppercase font-mono text-faint block mb-1">Latency</span>
                                    <div className="flex items-center gap-1.5 text-text num font-semibold">
                                        <Activity className="w-3.5 h-3.5 text-accent rotate-90" />
                                        <span>14 ms</span>
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-[5px] bg-raised border border-line col-span-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-text-soft">
                                            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                                            <span>Security Status</span>
                                        </div>
                                        <span className="text-ok text-[10px] uppercase font-semibold">Clean / Verified</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend / Stats Floating */}
            <div className="absolute top-3 right-3 flex flex-col gap-2">
                <div className="px-3 py-1.5 bg-bar border border-line rounded-[7px] flex items-center gap-3 font-mono text-xs">
                    <span className="text-faint uppercase text-[10px]">Active Nodes</span>
                    <span className="num font-bold text-accent">{deviceNodes.length + 1}</span>
                </div>
            </div>
        </div>
    );
}
