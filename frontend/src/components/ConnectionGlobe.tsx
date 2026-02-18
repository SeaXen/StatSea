
import { useEffect, useState, useRef } from 'react';
import Globe from 'react-globe.gl';
import { Globe as GlobeIcon } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface Connection {
    ip: string;
    city: string;
    country: string;
    lat: number;
    lon: number;
    bytes: number;
    hits: number;
}

export const ConnectionGlobe = () => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const globeRef = useRef<any>();

    // Mock home location (Center of Map for demo, or detected)
    const homeLocation = { lat: 23.8103, lon: 90.4125, label: 'Statsea Hub' };

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NETWORK.CONNECTIONS}`);
                const data = await response.json();
                setConnections(data);
            } catch (error) {
                console.error("Failed to fetch connections:", error);
            }
        };

        fetchConnections();
        const interval = setInterval(fetchConnections, 5000);
        return () => clearInterval(interval);
    }, []);

    // Sample data for initial 'Wow' factor if no real connections yet
    const sampleConnections: Connection[] = [
        { ip: '8.8.8.8', city: 'Mountain View', country: 'USA', lat: 37.386, lon: -122.0838, bytes: 1024, hits: 10 },
        { ip: '1.1.1.1', city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, bytes: 2048, hits: 5 },
        { ip: '142.250.72.110', city: 'Frankfurt', country: 'Germany', lat: 50.1109, lon: 8.6821, bytes: 512, hits: 2 },
    ];

    const displayConnections = connections.length > 0 ? connections : sampleConnections;

    const getCountryFlag = (countryCode: string) => {
        // Simple helper to convert country code to flag emoji
        // This assumes countryCode is ISO 3166-1 alpha-2 (e.g. US, DE)
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
        color: ['#3b82f6', '#10b981'],
        name: `${conn.city}, ${conn.country} (${conn.ip})`
    }));

    // Combine home location with connection destinations for points
    const pointsData = [
        homeLocation,
        ...displayConnections.map(conn => ({
            label: `${conn.city}, ${conn.country} \n${conn.ip}`,
            ...conn
        }))
    ];

    const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

    // Aggregate top countries
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
        <div className="glass-card relative overflow-hidden bg-slate-900/50 border border-white/5 backdrop-blur-xl h-[600px] rounded-xl flex">
            {/* Left: Globe Area */}
            <div className="flex-1 relative h-full">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="p-2 bg-blue-500/20 rounded-lg backdrop-blur-md">
                        <GlobeIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-100 shadow-black drop-shadow-md">Global Connection Map</h3>
                        <p className="text-xs text-slate-400 shadow-black drop-shadow-md">Live external traffic visualization</p>
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className="px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 flex items-center gap-2 backdrop-blur-md">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-[10px] text-slate-300 font-medium">
                            {displayConnections.length} Active Nodes
                        </span>
                    </div>
                </div>

                <Globe
                    ref={globeRef}
                    backgroundColor="rgba(0,0,0,0)"
                    width={800} // This might need responsive handling or resize observer
                    height={600}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                    pointsData={pointsData}
                    pointColor={(d: any) => d === homeLocation ? '#3b82f6' : d === selectedPoint ? '#ef4444' : '#10b981'}
                    pointAltitude={(d: any) => d === selectedPoint ? 0.3 : 0.05}
                    pointRadius={(d: any) => d === homeLocation ? 0.5 : d === selectedPoint ? 0.8 : 0.4}
                    pointsMerge={false} // changing to false to allow individual interaction
                    onPointClick={(point: any) => {
                        setSelectedPoint(point);
                        globeRef.current.pointOfView({ lat: point.lat, lon: point.lon, altitude: 2 }, 1000);
                    }}
                    arcsData={arcData}
                    arcColor="color"
                    arcDashLength={0.4}
                    arcDashGap={2}
                    arcDashAnimateTime={2000}
                    arcStroke={0.5}
                    labelsData={pointsData}
                    labelLat={(d: any) => d.lat}
                    labelLng={(d: any) => d.lon}
                    labelText={(d: any) => d === homeLocation ? d.label : ''} // Only show home label by default
                    labelSize={1.5}
                    labelDotRadius={0.5}
                    labelColor={() => '#3b82f6'}
                    labelResolution={2}
                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.15}
                />

                {/* Connection Details Overlay */}
                {selectedPoint && selectedPoint !== homeLocation && (
                    <div className="absolute bottom-4 left-4 right-4 p-4 bg-slate-900/90 border border-white/10 rounded-xl backdrop-blur-xl z-20 animate-in slide-in-from-bottom-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-white flex items-center gap-2">
                                    {getCountryFlag(selectedPoint.country_code || 'US')} {selectedPoint.city}, {selectedPoint.country}
                                </h4>
                                <div className="text-xs text-slate-400 font-mono mt-1">{selectedPoint.ip}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-500 uppercase font-bold">Traffic</div>
                                <div className="text-sm text-blue-400 font-mono">{(selectedPoint.bytes / 1024).toFixed(2)} KB</div>
                            </div>
                        </div>
                        <button
                            className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-1 border border-white/10 hover:bg-slate-700 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedPoint(null); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Top Countries Sidebar */}
            <div className="w-64 border-l border-white/5 bg-black/20 backdrop-blur-xl p-4 flex flex-col gap-4 overflow-y-auto hidden md:flex">
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Top Locations</h4>
                    <div className="space-y-3">
                        {topCountries.map((country, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">
                                        {getCountryFlag(country.country.slice(0, 2) || 'US')}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                                            {country.country}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {country.count} connections
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs font-mono text-slate-400">
                                    {Math.round(country.bytes / 1024)}K
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 box-shadow-green" />
                            <span className="text-xs font-medium text-blue-200">Network Healthy</span>
                        </div>
                        <p className="text-[10px] text-blue-300/70 leading-relaxed">
                            Global traffic distribution is normal. No anomalous geo-locations detected.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
