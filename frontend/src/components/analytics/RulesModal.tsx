import React from 'react';
import { Shield, X, Plus, Settings, Trash2, Save } from 'lucide-react';
import { SecurityRule } from '../AnalyticsDashboard';
import { useModalA11y } from '../../hooks/useModalA11y';

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
    const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="rules-modal-title"
                className="panel bg-panel border border-line rounded-[var(--r-panel)] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="px-5 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-raised z-10">
                    <h2 id="rules-modal-title" className="text-sm font-semibold text-text flex items-center gap-2 font-mono">
                        <Shield className="w-4 h-4 text-accent" />
                        Security Alert Rules
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close rules configuration"
                        className="p-1 hover:bg-panel rounded text-faint hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {!editingRule ? (
                        <>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs text-faint font-mono">Manage real-time alert rules for network traffic anomalies.</p>
                                <button
                                    type="button"
                                    onClick={() => setEditingRule({ name: '', description: '', condition: '', action: 'alert', is_active: true })}
                                    className="px-3 py-1.5 bg-accent text-accent-foreground text-xs font-mono font-medium rounded-[7px] shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    <Plus className="w-3.5 h-3.5" /> New Rule
                                </button>
                            </div>

                            {rulesLoading ? (
                                <div className="py-8 text-center text-xs font-mono text-faint">Loading rules…</div>
                            ) : rules.length === 0 ? (
                                <div className="py-8 text-center border border-dashed border-line rounded-[var(--r-panel)] text-faint font-mono text-xs">
                                    No alert rules configured yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {rules.map((rule) => (
                                        <div
                                            key={rule.id}
                                            className={`p-3.5 rounded-[var(--r-panel)] border ${rule.is_active ? 'bg-raised border-line' : 'bg-panel border-line/60'} flex items-center justify-between group`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-ok' : 'bg-faint'}`} />
                                                    <h4 className={`font-medium font-mono text-xs ${rule.is_active ? 'text-text' : 'text-faint'}`}>{rule.name}</h4>
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-panel border border-line text-faint uppercase font-mono">{rule.action}</span>
                                                </div>
                                                <p className="text-xs text-text-soft mt-1 max-w-md truncate font-mono">{rule.description || 'No description'}</p>
                                                <div className="mt-2 text-[11px] font-mono text-accent bg-accent-soft px-2 py-0.5 rounded inline-block">
                                                    {rule.condition}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingRule(rule)}
                                                    className="p-1.5 text-faint hover:text-accent hover:bg-accent-soft rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                                    aria-label="Edit rule"
                                                    title="Edit rule"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => rule.id && onDeleteRule(rule.id)}
                                                    className="p-1.5 text-faint hover:text-danger hover:bg-danger/10 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
                            className="space-y-4 font-mono text-xs"
                            onSubmit={(e) => {
                                e.preventDefault();
                                onSaveRule(editingRule);
                            }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="rule-name-input" className="text-xs font-medium text-text">Rule Name <span className="text-danger">*</span></label>
                                    <input
                                        id="rule-name-input"
                                        required
                                        type="text"
                                        value={editingRule.name}
                                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                                        className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
                                        placeholder="e.g. High HTTP Traffic"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="rule-action-select" className="text-xs font-medium text-text">Action</label>
                                    <select
                                        id="rule-action-select"
                                        value={editingRule.action}
                                        onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value })}
                                        className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
                                    >
                                        <option value="alert">Alert Only</option>
                                        <option value="block">Block</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="rule-desc-input" className="text-xs font-medium text-text">Description</label>
                                <input
                                    id="rule-desc-input"
                                    type="text"
                                    value={editingRule.description}
                                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
                                    placeholder="Optional description…"
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="rule-condition-input" className="text-xs font-medium text-text">Condition Expression <span className="text-danger">*</span></label>
                                <input
                                    id="rule-condition-input"
                                    required
                                    type="text"
                                    value={editingRule.condition}
                                    onChange={(e) => setEditingRule({ ...editingRule, condition: e.target.value })}
                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs font-mono text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
                                    placeholder="e.g. bytes > 500000 && proto == 'HTTP'"
                                />
                                <p className="text-[10px] text-faint mt-1">Available variables: bytes, packets, proto, src_ip, dst_ip</p>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={editingRule.is_active}
                                    onChange={(e) => setEditingRule({ ...editingRule, is_active: e.target.checked })}
                                    className="w-3.5 h-3.5 rounded text-accent focus:ring-0 focus-visible:ring-1 focus-visible:ring-accent"
                                />
                                <label htmlFor="isActive" className="text-xs text-text cursor-pointer">Rule is active</label>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
                                <button
                                    type="button"
                                    onClick={() => setEditingRule(null)}
                                    className="px-3 py-1.5 text-xs text-faint hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 bg-accent text-accent-foreground font-medium rounded-[7px] shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    <Save className="w-3.5 h-3.5" /> Save Rule
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
