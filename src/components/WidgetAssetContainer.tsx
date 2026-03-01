import React, { useState } from 'react';
import WidgetUploadModal from './WidgetUploadModal';
import WidgetCodeEditor from './WidgetCodeEditor';
import { UPLOAD_URL } from '../App';

interface WidgetAssetContainerProps {
    onClose?: () => void;
    widgets: any[];
    fonts: any[];
    onAdd: (newWidget: any) => void;
    onUpdate: (id: string, updatedWidget: any) => void;
    onDoubleClickAsset?: (url: string, type: string, meta?: any) => void;
    showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
}

const WidgetAssetContainer: React.FC<WidgetAssetContainerProps> = ({ onClose, widgets, fonts, onAdd, onUpdate, onDoubleClickAsset, showNotification }) => {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddWidget = (newWidget: { id: string; icon: string; label: string; color: string; url: string, widgetHtml?: string, widgetCss?: string, widgetJs?: string }) => {
        onAdd(newWidget);
    };

    const handleSaveWidget = async (name: string, html: string, css: string, js: string, icon: string, properties: any[]) => {
        setIsLoading(true);
        try {
            const companyId = '66db07778b5e35892545578c';
            const brandId = '671a1666d786fa251fca95d0';
            const templateId = '670fa914c2f0842143d5932';
            
            const isUpdate = !!editingWidget && !!editingWidget.timestamp;
            let endpoint = isUpdate ? `${UPLOAD_URL}/update-widget` : `${UPLOAD_URL}/upload-widget`;
            
            console.log(`[WidgetAssetContainer] ${isUpdate ? 'Updating' : 'Uploading'} widget code to server...`);
            
            const payload: any = {
                html: html,
                javascript: js,
                css: css,
                companyId,
                brandId,
                templateId,
                properties: properties
            };

            if (isUpdate) {
                payload.name = editingWidget.timestamp.toString();
            } else {
                payload.tagname = name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'custom-widget';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`${isUpdate ? 'Update' : 'Upload'} failed: ${response.status} ${response.statusText}. ${errData.error || ''}`);
            }

            const data = await response.json();
            console.log(`[WidgetAssetContainer] ${isUpdate ? 'Update' : 'Upload'} successful:`, data);

            if (editingWidget) {
                // Update existing widget
                const updatedWidget = {
                    ...editingWidget,
                    icon: icon || editingWidget.icon,
                    label: name || editingWidget.label,
                    url: data.urls?.html || editingWidget.url,
                    widgetHtml: html,
                    widgetCss: css,
                    widgetJs: js,
                    widgetProperties: properties,
                    // Keep the same timestamp/id
                };
                onUpdate(editingWidget.id, updatedWidget);
            } else {
                // Create new widget
                const id = `widget_custom_${Math.random().toString(36).substring(2, 9)}`;
                const newWidget = {
                    id,
                    timestamp: data.timestamp, // Store the server-provided timestamp for future updates
                    icon: icon || 'code_blocks',
                    label: name || 'Custom Code Widget',
                    color: 'blue' as const,
                    url: data.urls?.html || '',
                    widgetHtml: html,
                    widgetCss: css,
                    widgetJs: js,
                    widgetProperties: properties,
                    hasCustomCode: true
                };
                handleAddWidget(newWidget);
            }
            
            setIsCodeEditorOpen(false);
            setEditingWidget(null);
        } catch (error) {
            console.error('[WidgetAssetContainer] Error saving widget:', error);
            if (showNotification) {
                showNotification(`Failed to save widget: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            } else {
                alert(`Failed to save widget: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEditor = (widget?: any) => {
        if (widget) {
            setEditingWidget(widget);
        } else {
            setEditingWidget(null);
        }
        setIsCodeEditorOpen(true);
    };

    const filteredWidgets = widgets.filter(widget => 
        widget.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
                        <div className="relative size-12">
                            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-600 animate-pulse uppercase tracking-wider">Syncing with CDN...</span>
                    </div>
                )}
                <div className="p-5 border-b border-gray-100 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-gray-800">Widgets</h2>
                        <button 
                            onClick={() => setIsCodeEditorOpen(true)}
                            className="h-9 px-4 bg-entry hover:bg-[#059669] text-white text-[12px] font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            New Widget
                        </button>
                    </div>
                    
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                            <span className="material-symbols-outlined text-[20px]">search</span>
                        </span>
                        <input 
                            className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-entry/20 focus:border-entry bg-gray-50/50 transition-all focus:outline-hidden" 
                            placeholder="Search widgets..." 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                </div>

                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                    <div className="mb-6">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Interactive Widgets</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {filteredWidgets.map((widget, idx) => (
                                <div 
                                    key={idx} 
                                    className="aspect-square bg-white border border-gray-100 rounded-xl overflow-hidden group cursor-pointer hover:border-entry hover:shadow-lg transition-all flex flex-col relative"
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', widget.label);
                                        e.dataTransfer.setData('assetType', 'widget');
                                        
                                        const meta = {
                                            icon: widget.icon,
                                            url: widget.url || '',
                                            widgetId: widget.id || '',
                                            color: widget.color,
                                            label: widget.label,
                                            widgetHtml: (widget as any).widgetHtml,
                                            widgetCss: (widget as any).widgetCss,
                                            widgetJs: (widget as any).widgetJs,
                                            properties: (widget as any).widgetProperties,
                                            hasCustomCode: (widget as any).hasCustomCode
                                        };
                                        e.dataTransfer.setData('asset-meta', JSON.stringify(meta));
                                        
                                        // Fix: Explicitly set the drag image to the current element
                                        e.dataTransfer.setDragImage(e.currentTarget, e.currentTarget.clientWidth / 2, e.currentTarget.clientHeight / 2);
                                        
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        onDoubleClickAsset?.(widget.label, 'widget', {
                                            icon: widget.icon,
                                            url: widget.url || '',
                                            widgetId: widget.id || '',
                                            color: widget.color,
                                            label: widget.label,
                                            widgetHtml: (widget as any).widgetHtml,
                                            widgetCss: (widget as any).widgetCss,
                                            widgetJs: (widget as any).widgetJs,
                                            properties: (widget as any).widgetProperties,
                                            hasCustomCode: (widget as any).hasCustomCode
                                        });
                                    }}
                                >
                                    <div className="flex-1 flex flex-col items-center justify-center pointer-events-none">
                                        <div 
                                            className={`w-12 h-12 rounded-lg flex items-center justify-center mb-1 group-hover:scale-105 transition-transform ${
                                                widget.color === 'orange' ? 'bg-orange-50 text-orange-500' :
                                                widget.color === 'pink' ? 'bg-pink-50 text-pink-500' :
                                                widget.color === 'purple' ? 'bg-purple-50 text-purple-500' :
                                                widget.color === 'red' ? 'bg-red-50 text-red-500' :
                                                widget.color === 'blue' ? 'bg-blue-50 text-blue-500' :
                                                widget.color === 'green' ? 'bg-green-50 text-green-500' :
                                                'bg-gray-50 text-gray-500'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[28px]">{widget.icon}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="px-2 py-1.5 text-[8px] font-black text-gray-500 bg-gray-50 border-t border-gray-100 truncate pointer-events-none uppercase tracking-wider text-center">
                                        {widget.label}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditor(widget);
                                        }}
                                        className="absolute top-2 right-2 size-7 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 opacity-0 group-hover:opacity-100 transition-all pointer-events-auto"
                                        title="Edit Widget Code"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div 
                        onClick={() => handleOpenEditor()}
                        className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-entry hover:border-entry hover:bg-entry/5 transition-all cursor-pointer group mt-6"
                    >
                        <span className="material-symbols-outlined text-[28px] group-hover:scale-110 transition-transform">add_box</span>
                        <span className="text-[10px] font-bold mt-2 uppercase tracking-wider">Custom Widget</span>
                    </div>
                </div>
            </div>

            <WidgetUploadModal 
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onAdd={handleAddWidget}
            />

            <WidgetCodeEditor 
                isOpen={isCodeEditorOpen}
                onClose={() => {
                    setIsCodeEditorOpen(false);
                    setEditingWidget(null);
                }}
                initialHtml={editingWidget?.widgetHtml || ''}
                initialCss={editingWidget?.widgetCss || ''}
                initialJs={editingWidget?.widgetJs || ''}
                initialProperties={editingWidget?.widgetProperties || []}
                widgetName={editingWidget?.label || "New Custom Widget"}
                initialIcon={editingWidget?.icon}
                onSave={handleSaveWidget}
                fonts={fonts}
                showNotification={showNotification}
            />
        </>
    );
};

export default WidgetAssetContainer;
