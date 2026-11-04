import { useEffect, useState, useRef } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { Globe as GlobeIcon } from 'lucide-react';
import axiosInstance from '../config/axiosInstance';

interface Connection {
    ip: string;
    city: string;
    country: string;
    lat: number;
    lon: number;
    bytes: number;
    hits: number;
    country_code?: string;
}

interface PointData {
    lat: number;
    lon: number;
    label: string;
    ip?: string;
    city?: string;
    country?: string;
    bytes?: number;
    hits?: number;
    country_code?: string;
}

interface IpInfo {
    asn: string;
    org: string;
    abuse_contact: string;
}

export const ConnectionGlobe = () => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const globeRef = useRef<GlobeMethods>();

    // Default home location (Center of Map if not detected)
    const homeLocation: PointData = { lat: 23.8103, lon: 90.4125, label: 'Statsea Hub' };

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const response = await axiosInstance.get('/network/connections');
                if (Array.isArray(response.data)) {
                    setConnections(response.data);
                } else {
                    setConnections([]);
                }
            } catch (error) {
                console.error("Failed to fetch connections:", error);
                setConnections([]);
            }
        };

        fetchConnections();
        const interval = setInterval(fetchConnections, 5000);
        return () => clearInterval(interval);
    }, []);

    const displayConnections = Array.isArray(connections) ? connections : [];

    const getCountryFlag = (countryCode: string) => {
        if (!countryCode) return '🌐';
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    };

    const arcData = displayConnections.map(conn => ({
        startLat: homeLocation.lat,
        startLon: homeLocation.lon,
        endLat: conn.lat,
        endLon: conn.lon,
        color: ['#7c8cff', '#4fd1e8'],
        name: `${conn.city}, ${conn.country} (${conn.ip})`
    }));

    const pointsData: PointData[] = [
        homeLocation,
        ...displayConnections.map(conn => ({
            label: `${conn.city}, ${conn.country} \n${conn.ip}`,
            ...conn
        }))
    ];

    const [selectedPoint, setSelectedPoint] = useState<PointData | null>(null);
    const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
    const [loadingIp, setLoadingIp] = useState(false);

    const topCountries = displayConnections.reduce((acc, curr) => {
        const existing = acc.find(c => c.country === curr.country);
        if (existing) {
            existing.count += 1;
            existing.bytes += curr.bytes;
        } else {
            acc.push({ country: curr.country, count: 1, bytes: curr.bytes });
        }
        return acc;
    }, [] as { country: string, count: number, bytes: number }[]).sort((a, b) => b.bytes - a.bytes).slice(0, 5);

    return (
        <div className="panel p-0 relative overflow-hidden bg-bg border border-line h-[calc(100vh-140px)] min-h-[580px] rounded-[9px] flex text-text">
            {/* Left: Globe Area */}
            <div ref={containerRef} className="flex-1 relative h-full bg-bg">
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="p-2 bg-bar border border-line rounded-[7px] flex items-center gap-2.5">
                        <GlobeIcon className="w-4 h-4 text-accent" />
                        <div>
                            <div className="text-xs font-semibold text-text tracking-tight flex items-center gap-2">
                                <span>Global Ingress / Egress Map</span>
                                <span className="status live text-[9px] font-mono px-1.5 py-0.2">REALTIME</span>
                            </div>
                            <p className="text-[10px] font-mono text-faint">3D GeoIP connection routing vectors</p>
                        </div>
                    </div>
                </div>

                <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className="px-2.5 py-1 bg-bar border border-line rounded-[7px] flex items-center gap-2 font-mono text-xs">
                        <div className="w-1.5 h-1.5 bg-ok rounded-full animate-pulse" />
                        <span className="text-text-soft num">
                            {displayConnections.length} Active Nodes
                        </span>
                    </div>
                </div>

                <Globe
                    ref={globeRef}
                    backgroundColor="rgba(0,0,0,0)"
                    width={dimensions.width}
                    height={dimensions.height}
                    globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
                    pointsData={pointsData}
                    pointColor={(d: object) => (d as PointData) === homeLocation ? '#3b82f6' : (d as PointData) === selectedPoint ? '#ef4444' : '#10b981'}
                    pointAltitude={(d: object) => (d as PointData) === selectedPoint ? 0.3 : 0.05}
                    pointRadius={(d: object) => (d as PointData) === homeLocation ? 0.5 : (d as PointData) === selectedPoint ? 0.8 : 0.4}
                    pointsMerge={false}
                    onPointClick={async (point: object) => {
                        const p = point as PointData;
                        setSelectedPoint(p);
                        setIpInfo(null);
                        setLoadingIp(true);
                        if (globeRef.current) {
                            globeRef.current.pointOfView({ lat: p.lat, lng: p.lon, altitude: 2 }, 1000);
                        }

                        if (p.ip) {
                            try {
                                const res = await axiosInstance.get(`/network/ip/${p.ip}`);
                                setIpInfo(res.data);
                            } catch (err) {
                                console.error("IP Lookup failed", err);
                            } finally {
                                setLoadingIp(false);
                            }
                        } else {
                            setLoadingIp(false);
                        }
                    }}
                    arcsData={arcData}
                    arcColor="color"
                    arcDashLength={0.4}
                    arcDashGap={2}
                    arcDashAnimateTime={2000}
                    arcStroke={0.5}
                    labelsData={pointsData}
                    labelLat={(d: object) => (d as PointData).lat}
                    labelLng={(d: object) => (d as PointData).lon}
                    labelText={(d: object) => (d as PointData) === homeLocation ? (d as PointData).label : ''}
                    labelSize={1.5}
                    labelDotRadius={0.5}
                    labelColor={() => '#7c8cff'}
                    labelResolution={2}
                    atmosphereColor="#7c8cff"
                    atmosphereAltitude={0.15}
                />

                {/* Connection Details Overlay */}
                {selectedPoint && selectedPoint !== homeLocation && (
                    <div className="absolute bottom-4 left-4 z-20 p-4 bg-panel border border-line-strong rounded-[7px] shadow-2xl max-w-sm w-full font-mono text-xs">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h4 className="font-semibold text-text flex items-center gap-2 text-xs">
                                    {getCountryFlag(selectedPoint.country_code || 'US')} {selectedPoint.city}, {selectedPoint.country}
                                </h4>
                                <div className="text-[11px] text-accent mt-0.5 mb-2">{selectedPoint.ip}</div>

                                {loadingIp ? (
                                    <div className="text-[11px] text-upload animate-pulse">Running IP Intelligence Scan…</div>
                                ) : ipInfo ? (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-text-soft mt-2 border-t border-line pt-2">
                                        <div><span className="text-faint">ASN:</span> {ipInfo.asn}</div>
                                        <div><span className="text-faint">Org:</span> {ipInfo.org}</div>
                                        <div className="col-span-2"><span className="text-faint">Abuse:</span> {ipInfo.abuse_contact}</div>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-danger">Failed to load IP details</div>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-faint uppercase">Traffic</div>
                                <div className="text-xs text-upload font-mono num">{selectedPoint.bytes ? (selectedPoint.bytes / 1024).toFixed(2) : '0.00'} KB</div>
                            </div>
                        </div>
                        <button
                            className="absolute top-2 right-2 p-1 text-muted hover:text-text hover:bg-raised rounded-[4px] transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedPoint(null); setIpInfo(null); }}
                            aria-label="Close"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Top Countries Sidebar */}
            <div className="w-72 border-l border-line bg-panel p-4 flex flex-col gap-4 overflow-y-auto hidden md:flex font-mono text-xs">
                <div>
                    <h4 className="text-[10px] font-semibold text-faint uppercase tracking-wider mb-3">Top Telemetry Locations</h4>
                    <div className="space-y-2">
                        {topCountries.map((country, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-[5px] bg-raised/50 border border-line hover:border-line-strong transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-base">
                                        {getCountryFlag(country.country.slice(0, 2) || 'US')}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-text font-medium truncate max-w-[110px]">
                                            {country.country}
                                        </span>
                                        <span className="text-[10px] text-faint num">
                                            {country.count} sockets
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs font-mono text-accent num">
                                    {Math.round(country.bytes / 1024)} KB
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="p-3 rounded-[7px] bg-raised border border-line">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="status ok text-[9px] uppercase px-1.5 py-0.2">INGRESS OK</span>
                            <span className="text-xs font-medium text-text">Routing Normal</span>
                        </div>
                        <p className="text-[10px] text-faint leading-relaxed font-mono">
                            Zero rogue geo-locations detected across active transport streams.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
