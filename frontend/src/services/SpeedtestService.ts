import { API_CONFIG } from '../config/apiConfig';

// Raw response from backend (matches SQLAlchemy model)
interface SpeedtestResultDTO {
    id: number;
    timestamp: string;
    ping: number;
    download: number;
    upload: number;
    server_id?: number;
    server_name?: string;
    server_country?: string;
    provider: 'ookla' | 'cloudflare';
}

// Frontend Domain Model
export interface SpeedtestResult {
    id: number;
    timestamp: string;
    ping: number;
    jitter: number;
    download: number;
    upload: number;
    packetLoss?: number;
    isp: string;
    server: {
        id: string;
        name: string;
        country: string;
        sponsor?: string;
    };
    provider: 'ookla' | 'cloudflare';
}

class SpeedtestService {
    private mapToDomain(dto: SpeedtestResultDTO): SpeedtestResult {
        return {
            id: dto.id,
            timestamp: dto.timestamp,
            ping: dto.ping,
            jitter: 0, // Backend doesn't provide this yet
            download: dto.download,
            upload: dto.upload,
            packetLoss: 0, // Backend doesn't provide this yet
            isp: 'Unknown', // Backend doesn't provide this yet
            server: {
                id: String(dto.server_id || 0),
                name: dto.server_name?.split(',')[0].trim() || 'Auto',
                country: dto.server_country || dto.server_name?.split(',').pop()?.trim() || 'Unknown',
                sponsor: ''
            },
            provider: dto.provider
        };
    }

    async getHistory(): Promise<SpeedtestResult[]> {
        const response = await fetch(`${API_CONFIG.BASE_URL}/speedtest`);
        if (!response.ok) {
            throw new Error(`Failed to fetch history: ${response.statusText}`);
        }
        const data: SpeedtestResultDTO[] = await response.json();
        return data.map(this.mapToDomain);
    }

    async runSpeedtest(provider: 'ookla' | 'cloudflare'): Promise<SpeedtestResult> {
        const response = await fetch(`${API_CONFIG.BASE_URL}/speedtest?provider=${provider}`, {
            method: 'POST',
        });


        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Speedtest failed: ${response.statusText}`);
        }

        const data: SpeedtestResultDTO = await response.json();
        return this.mapToDomain(data);
    }
}

export default new SpeedtestService();
