import React from 'react';
import { Shield, X, Plus, Settings, Trash2, Save } from 'lucide-react';
import { SecurityRule } from '../AnalyticsDashboard';

interface RulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    rules: SecurityRule[];
    rulesLoading: boolean;
    editingRule: SecurityRule | null;
    setEditingRule: (rule: SecurityRule | null) => void;
    onSaveRule: (rule: SecurityRule) => void;
    onDeleteRule: (id: number) => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({
    isOpen,
    onClose,
    rules,
    rulesLoading,
    editingRule,
    setEditingRule,
    onSaveRule,
    onDeleteRule,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur z-10">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Security Alert Rules
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close rules configuration"
                        className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {!editingRule ? (
                        <>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-sm text-muted-foreground">Manage real-time alert rules for network traffic anomalies.</p>
                                <button
                                    onClick={() => setEditingRule({ name: '', description: '', condition: '', action: 'alert', is_active: true })}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded shadow-sm transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                                >
                                    <Plus className="w-3.5 h-3.5" /> New Rule
                                </button>
                            </div>

                            {rulesLoading ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">Loading rules…</div>
                            ) : rules.length === 0 ? (
                                <div className="py-8 text-center border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                                    No alert rules configured yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {rules.map((rule) => (
                                        <div
                                            key={rule.id}
                                            className={`p-4 rounded-lg border ${rule.is_active ? 'bg-secondary/40 border-border/50' : 'bg-card/40 border-border/80'} flex items-center justify-between group`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-green-400' : 'bg-muted-foreground/60'}`} />
                                                    <h4 className={`font-medium text-sm ${rule.is_active ? 'text-foreground/90' : 'text-muted-foreground'}`}>{rule.name}</h4>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary border border-border text-muted-foreground uppercase">{rule.action}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{rule.description || 'No description'}</p>
                                                <div className="mt-2 text-xs font-mono text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded inline-block">
                                                    {rule.condition}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingRule(rule)}
                                                    className="p-1.5 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                                                    aria-label="Edit rule"
                                                    title="Edit rule"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => rule.id && onDeleteRule(rule.id)}
                                                    className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:outline-none"
                                                    aria-label="Delete rule"
                                                    title="Delete rule"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <form
                            className="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                onSaveRule(editingRule);
                            }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/80">Rule Name <span className="text-red-400">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={editingRule.name}
                                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                        placeholder="e.g. High HTTP Traffic"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/80">Action</label>
                                    <select
                                        value={editingRule.action}
                                        onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    >
                                        <option value="alert">Alert Only</option>
                                        <option value="block">Block</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Description</label>
                                <input
                                    type="text"
                                    value={editingRule.description}
                                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    placeholder="Optional description..."
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Condition Expression <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    type="text"
                                    value={editingRule.condition}
                                    onChange={(e) => setEditingRule({ ...editingRule, condition: e.target.value })}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono text-cyan-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    placeholder="e.g. bytes > 500000 && proto == 'HTTP'"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Available variables: bytes, packets, proto, src_ip, dst_ip</p>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={editingRule.is_active}
                                    onChange={(e) => setEditingRule({ ...editingRule, is_active: e.target.checked })}
                                    className="w-3.5 h-3.5 bg-background border-border rounded text-primary focus:ring-0"
                                />
                                <label htmlFor="isActive" className="text-sm text-foreground/80 cursor-pointer">Rule is active</label>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setEditingRule(null)}
                                    className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded shadow-sm transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                                >
                                    <Save className="w-4 h-4" /> Save Rule
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
