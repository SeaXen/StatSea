import React, { useState } from 'react';
import { Shield, Plus, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useCertificates, useCreateCertificate, useDeleteCertificate } from '../hooks/useCertificates';
import { toast } from 'sonner';

export const CertMonitor: React.FC = () => {
    const [newDomain, setNewDomain] = useState('');
    const [newPort, setNewPort] = useState('443');

    const { data: certs = [], isLoading } = useCertificates();
    const createCert = useCreateCertificate();
    const deleteCert = useDeleteCertificate();

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDomain) return;

        try {
            await createCert.mutateAsync({
                domain: newDomain,
                port: parseInt(newPort, 10) || 443,
                is_active: true
            });
            setNewDomain('');
            setNewPort('443');
            toast.success('Certificate monitor added successfully');
        } catch (error) {
            toast.error('Failed to add certificate monitor');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteCert.mutateAsync(id);
            toast.success('Certificate monitor removed');
        } catch (error) {
            toast.error('Failed to remove certificate monitor');
        }
    };

    const getStatusIcon = (cert: any) => {
        if (cert.error_message) return <XCircle className="w-5 h-5 text-red-500" />;
        if (cert.days_until_expiration === undefined || cert.days_until_expiration === null) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        if (cert.days_until_expiration <= 0) return <XCircle className="w-5 h-5 text-red-500" />;
        if (cert.days_until_expiration <= 14) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-400" />
                        SSL/TLS Certificate Monitor
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Monitor SSL certificates for expiration and issues. Get notified 14 days before expiry via your active channels.
                    </p>
                </div>
            </div>

            <form onSubmit={handleAdd} className="flex gap-4 items-end bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Domain</label>
                    <input
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="example.com"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        required
                    />
                </div>
                <div className="w-32">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Port</label>
                    <input
                        type="number"
                        value={newPort}
                        onChange={(e) => setNewPort(e.target.value)}
                        placeholder="443"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                </div>
                <button
                    type="submit"
                    disabled={createCert.isPending || !newDomain}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </form>

            <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-900/50">
                        <tr>
                            <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Expires In</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Issuer</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading certificates...</td>
                            </tr>
                        ) : certs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 flex flex-col items-center justify-center text-gray-400">
                                    <Shield className="w-8 h-8 text-gray-500 mb-2" />
                                    No certificates monitored yet
                                </td>
                            </tr>
                        ) : (
                            certs.map((cert) => (
                                <tr key={cert.id} className="hover:bg-gray-700/20 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(cert)}
                                            <span className={`text-sm ${cert.error_message ? 'text-red-400' :
                                                    cert.days_until_expiration && cert.days_until_expiration <= 14 ? 'text-yellow-400' :
                                                        'text-green-400'
                                                }`}>
                                                {cert.error_message ? 'Error' :
                                                    cert.days_until_expiration === undefined || cert.days_until_expiration === null ? 'Pending' :
                                                        cert.days_until_expiration <= 0 ? 'Expired' :
                                                            'Valid'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-white">{cert.domain}</span>
                                            <span className="text-xs text-gray-500">Port {cert.port}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-300">
                                            {cert.days_until_expiration !== undefined && cert.days_until_expiration !== null ?
                                                `${cert.days_until_expiration} days` : '-'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {cert.expiration_date ? new Date(cert.expiration_date).toLocaleDateString() : 'Unknown'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-300 truncate max-w-[200px]" title={cert.issuer || ''}>
                                            {cert.issuer || '-'}
                                        </div>
                                        {cert.error_message && (
                                            <div className="text-xs text-red-400 truncate max-w-[200px]" title={cert.error_message}>
                                                {cert.error_message}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => handleDelete(cert.id)}
                                            disabled={deleteCert.isPending}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                                            title="Remove monitor"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
