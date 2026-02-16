import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Router, Monitor, Smartphone, Laptop, Tablet, Box, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

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

    useEffect(() => {
        const fetchTopology = async () => {
            try {
                const response = await fetch('/api/network/topology');
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error('Failed to fetch topology:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTopology();
        const interval = setInterval(fetchTopology, 30000); // Refresh every 30s
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
        <div className="relative w-full h-[calc(100vh-120px)] overflow-hidden bg-[#050505] rounded-3xl border border-white/5">
            {/* Background Grain/Grid */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(21,93,252,0.05)_0%,transparent_70%)]" />

            {/* Topology Canvas */}
            <div className="relative w-full h-full flex items-center justify-center">

                {/* Router (Center) */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-20"
                >
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#155dfc] to-[#0037a5] p-[2px] shadow-[0_0_50px_rgba(21,93,252,0.3)]">
                        <div className="w-full h-full rounded-full bg-[#0a0a0c] flex flex-col items-center justify-center border border-white/20">
                            <Router className="w-10 h-10 text-[#155dfc] mb-1" />
                            <span className="text-[10px] uppercase font-bold tracking-widest text-[#155dfc]">Edge Core</span>
                        </div>
                    </div>
                    {/* Orbit Rings */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-white/5 rounded-full pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-white/5 rounded-full pointer-events-none" />
                </motion.div>

                {/* Device Nodes (Orbits) */}
                {deviceNodes.map((node, index) => {
                    const angle = (index / deviceNodes.length) * 2 * Math.PI;
                    const radius = deviceNodes.length > 5 ? 280 : 220;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    return (
                        <div key={node.id} className="absolute z-30">
                            {/* Connecting Line */}
                            <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0 }}>
                                <motion.line
                                    x1={0}
                                    y1={0}
                                    x2={-x}
                                    y2={-y}
                                    stroke="url(#lineGradient)"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 0.3 }}
                                />
                                <defs>
                                    <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#155dfc" stopOpacity="0" />
                                        <stop offset="50%" stopColor="#155dfc" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#155dfc" stopOpacity="1" />
                                    </linearGradient>
                                </defs>
                            </svg>

                            {/* Node */}
                            <motion.div
                                initial={{ scale: 0, x: 0, y: 0 }}
                                animate={{ scale: 1, x, y }}
                                whileHover={{ scale: 1.1 }}
                                onClick={() => setSelectedNode(node)}
                                className={cn(
                                    "cursor-pointer group flex flex-col items-center",
                                    selectedNode?.id === node.id ? "z-50" : "z-30"
                                )}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                                    "bg-[#111114] border border-white/10 group-hover:border-[#155dfc]/50 group-hover:shadow-[0_0_20px_rgba(21,93,252,0.2)]",
                                    selectedNode?.id === node.id && "border-[#155dfc] bg-[#155dfc]/10"
                                )}>
                                    <div className="text-white/60 group-hover:text-[#155dfc] transition-colors">
                                        {getIcon(node.type)}
                                    </div>
                                </div>
                                <span className="mt-2 text-[10px] font-medium text-white/40 group-hover:text-white transition-colors">
                                    {node.label}
                                </span>
                            </motion.div>
                        </div>
                    );
                })}
            </div>

            {/* Selection Panel (Overlay) */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-8 left-8 p-6 rounded-2xl bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 shadow-2xl z-50 max-w-sm"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-[#155dfc]/10 flex items-center justify-center text-[#155dfc]">
                                {getIcon(selectedNode.type)}
                            </div>
                            <div>
                                <h3 className="text-white font-bold">{selectedNode.label}</h3>
                                <p className="text-white/40 text-xs font-mono">{selectedNode.ip}</p>
                            </div>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="ml-auto text-white/20 hover:text-white transition-colors"
                            >
                                <ShieldCheck className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-[10px] uppercase text-white/30 block mb-1">Status</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs font-bold text-white">Encrypted</span>
                                </div>
                            </div>
                            <div className="flex-1 p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-[10px] uppercase text-white/30 block mb-1">Traffic</span>
                                <div className="flex items-center gap-1.5">
                                    <Activity className="w-3 h-3 text-[#155dfc]" />
                                    <span className="text-xs font-bold text-white">Active</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Stats */}
            <div className="absolute top-8 right-8 flex flex-col gap-4">
                <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#155dfc]" />
                    <span className="text-xs font-medium text-white/60">
                        {deviceNodes.length} Devices Online
                    </span>
                </div>
            </div>
        </div>
    );
}
