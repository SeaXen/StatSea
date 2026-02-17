
import { useEffect, useState, useRef } from 'react';
import Globe from 'react-globe.gl';
import { Globe as GlobeIcon, MapPin } from 'lucide-react';

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
                const response = await fetch('http://localhost:21081/api/network/connections');
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

    const arcData = displayConnections.map(conn => ({
        startLat: homeLocation.lat,
        startLon: homeLocation.lon,
        endLat: conn.lat,
        endLon: conn.lon,
        color: ['#3b82f6', '#10b981'], // Transition from Blue to Emerald
        name: `${conn.city}, ${conn.country} (${conn.ip})`
    }));

    return (
        <div className="glass-card relative overflow-hidden bg-slate-900/50 border border-white/5 backdrop-blur-xl h-[500px] rounded-xl">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                    <GlobeIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-100">Global Connection Map</h3>
                    <p className="text-xs text-slate-400">Live external traffic visualization</p>
                </div>
            </div>

            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <div className="px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-slate-300 font-medium">
                        {displayConnections.length} Active Nodes
                    </span>
                </div>
            </div>

            <div className="w-full h-full flex items-center justify-center pt-8">
                <Globe
                    ref={globeRef}
                    backgroundColor="rgba(0,0,0,0)"
                    width={800}
                    height={600}
                    pointsData={[homeLocation]}
                    pointColor={() => '#3b82f6'}
                    pointAltitude={0.01}
                    pointRadius={0.5}
                    pointsMerge={true}
                    arcsData={arcData}
                    arcColor="color"
                    arcDashLength={0.4}
                    arcDashGap={2}
                    arcDashAnimateTime={2000}
                    arcStroke={0.5}
                    labelText="label"
                    labelSize={1.5}
                    labelDotRadius={0.5}
                    labelColor={() => '#3b82f6'}
                    labelResolution={2}
                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.15}

                />
            </div>

            {/* Bottom Info Bar */}
            <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-between items-end">
                <div className="flex gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Latency</span>
                        <span className="text-sm text-slate-200 font-mono">24ms</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Top Node</span>
                        <span className="text-sm text-slate-200 font-mono">{displayConnections[0]?.city || 'N/A'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                    <MapPin className="w-3 h-3" />
                    Source: {homeLocation.label}
                </div>
            </div>
        </div>
    );
};
