import { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { Share2, RefreshCw } from 'lucide-react';
import axiosInstance from '../config/axiosInstance';

interface Node {
    id: string;
    label: string;
    type: string;
    ip: string;
    group: string;
    x?: number;
    y?: number;
    fx?: number;
    fy?: number;
    val?: number;
}

interface RawTopologyEdge {
    from: string;
    to: string;
    value?: number;
}

interface Link {
    source: string | Node;
    target: string | Node;
    value?: number;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
}

export function NetworkTopology() {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const fgRef = useRef<ForceGraphMethods<Node, Link>>();
    const [hoverNode, setHoverNode] = useState<Node | null>(null);

    const fetchTopology = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axiosInstance.get('/network/topology');

            // Map 'from' and 'to' in edges to 'source' and 'target' for react-force-graph
            const mappedLinks = (data.edges || []).map((e: RawTopologyEdge) => ({
                source: e.from,
                target: e.to,
                value: e.value || 1
            }));

            // Make router larger
            const mappedNodes = (data.nodes || []).map((n: Node) => ({
                ...n,
                val: n.group === 'core' ? 20 : 5 // Increased base size
            }));

            setGraphData({
                nodes: mappedNodes,
                links: mappedLinks
            });
            setError(null);
        } catch (err: unknown) {
            console.error("Failed to load topology:", err);
            setError("Failed to load network topology");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTopology();
    }, [fetchTopology]);

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);

        // Initial zoom after a short delay
        const timer = setTimeout(() => {
            if (fgRef.current) {
                fgRef.current.zoomToFit(400, 50);
            }
        }, 800);

        return () => {
            window.removeEventListener('resize', updateDimensions);
            clearTimeout(timer);
        };
    }, []);

    const getNodeColor = (node: Node) => {
        if (node.group === 'core') return '#06b6d4'; // Cyan for core router

        switch (node.type?.toLowerCase()) {
            case 'mobile': return '#10b981'; // Emerald
            case 'pc': return '#3b82f6'; // Blue
            case 'iot': return '#f59e0b'; // Amber
            default: return '#14b8a6'; // Teal
        }
    };

    return (
        <div className="panel rounded-[var(--r-panel)] p-5 md:p-6 border border-line bg-panel relative h-[500px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-accent/10 flex items-center justify-center border border-accent/20">
                        <Share2 className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-text tracking-tight">Network Map</h2>
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider">LIVE TOPOLOGY</p>
                    </div>
                </div>
                <button
                    onClick={fetchTopology}
                    disabled={loading}
                    aria-label="Refresh network topology"
                    className="p-2 rounded-[7px] bg-raised hover:bg-panel text-faint hover:text-text transition-all border border-line disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 relative w-full rounded-[7px] overflow-hidden bg-raised border border-line" ref={containerRef}>
                {loading && graphData.nodes.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center z-20 bg-panel/85 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                            <div className="text-xs font-bold text-accent uppercase tracking-wider">Scanning Network...</div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm font-medium z-20">
                        {error}
                    </div>
                ) : (
                    <>
                        {dimensions.width > 0 && dimensions.height > 0 && (
                            <ForceGraph2D
                                ref={fgRef}
                                width={dimensions.width}
                                height={dimensions.height}
                                graphData={graphData}
                                nodeLabel={(node: Node) => `${node.label} (${node.ip || 'Unknown IP'})`}
                                nodeColor={(node: Node) => node === hoverNode ? '#fff' : getNodeColor(node)}
                                nodeRelSize={7}
                                linkWidth={2}
                                linkColor={() => 'rgba(255,255,255,0.1)'}
                                backgroundColor="transparent"
                                onNodeHover={(node: Node | null) => setHoverNode(node)}
                                onNodeDragEnd={(node: Node) => {
                                    node.fx = node.x;
                                    node.fy = node.y;
                                }}
                                nodeCanvasObjectMode={() => 'after'}
                                nodeCanvasObject={(node: Node, ctx: CanvasRenderingContext2D, globalScale: number) => {
                                    const label = node.label;
                                    const fontSize = 12 / globalScale;
                                    ctx.font = `${fontSize}px Sans-Serif`;
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillStyle = node === hoverNode ? '#fff' : 'rgba(255, 255, 255, 0.6)';

                                    // Make router label bigger and always visible
                                    if (node.group === 'core' || globalScale > 1.5 || node === hoverNode) {
                                        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + ((node.val ?? 1) * 2) + fontSize);
                                    }
                                }}
                            />
                        )}

                        {/* Legend */}
                        <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10 bg-[#09090b]/80 backdrop-blur-md p-3 rounded-xl border border-white/10 pointer-events-none">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Router</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Computers</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Mobile</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">IoT / Other</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
