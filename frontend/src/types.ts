export interface Device {
    id: number;
    vendor: string;
    hostname?: string;
    ip_address?: string;
    mac_address: string;
    type: string;
    is_online: boolean;
    download?: string;
    upload?: string;
    last_seen: string;
    nickname?: string;
    notes?: string;
    tags?: string[];
    group_id?: number;
}

export interface DeviceStatusLog {
    id: number;
    device_id: number;
    status: 'online' | 'offline';
    timestamp: string;
}

export interface DeviceStats {
    timestamp: number;
    u: number;
    d: number;
}

export interface DeviceGroup {
    id: number;
    name: string;
    color: string;
}
