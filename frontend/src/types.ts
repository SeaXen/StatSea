export interface DevicePort {
    id: number;
    device_id: number;
    port: number;
    protocol: string;
    service?: string;
    state: string;
    last_discovered: string;
}

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
    icon_type?: string;
    notes?: string;
    tags?: string[];
    group_id?: number;
    ports?: DevicePort[];
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

export interface TrafficCategory {
    category: string;
    download_bytes: number;
    upload_bytes: number;
}

export type NotificationChannelType = 'email' | 'slack' | 'discord' | 'ntfy' | 'telegram' | 'push';

export interface NotificationChannel {
    id: number;
    name: string;
    type: NotificationChannelType;
    config: Record<string, any>;
    events: string[];
    is_enabled: boolean;
    created_at?: string;
}

export type NotificationChannelCreate = Omit<NotificationChannel, 'id' | 'created_at'>;
export type NotificationChannelUpdate = Partial<NotificationChannelCreate>;

export interface MonitoredCertificate {
    id: number;
    domain: string;
    port: number;
    is_active: boolean;
    last_checked?: string;
    expiration_date?: string;
    issuer?: string;
    days_until_expiration?: number;
    error_message?: string;
    created_at: string;
}

export type CertificateCreate = Pick<MonitoredCertificate, 'domain' | 'port' | 'is_active'>;
export type CertificateUpdate = Partial<CertificateCreate>;

export interface AgentResponse {
    id: string;
    name: string;
    ip_address?: string;
    status: string;
    last_seen?: string;
    system_info?: any;
    organization_id?: number;
    created_at: string;
}
