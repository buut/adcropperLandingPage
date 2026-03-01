import React, { useState } from 'react';

interface WidgetUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (widget: { id: string; icon: string; label: string; color: string; url: string }) => void;
}

const WidgetUploadModal: React.FC<WidgetUploadModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [widgetName, setWidgetName] = useState('');
    const [widgetUrl, setWidgetUrl] = useState('');
    const [widgetIcon, setWidgetIcon] = useState('widgets');
    const [widgetColor, setWidgetColor] = useState('blue');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!widgetName) return;

        onAdd({
            id: `widget_${Math.random().toString(36).substring(2, 9)}`,
            label: widgetName,
            url: widgetUrl,
            icon: widgetIcon,
            color: widgetColor
        });
        resetAndClose();
    };

    const resetAndClose = () => {
        setWidgetName('');
        setWidgetUrl('');
        setWidgetIcon('widgets');
        setWidgetColor('blue');
        onClose();
    };

    const icons = [
        'widgets', 'timer', 'share', 'mail', 'play_circle', 
        'shopping_cart', 'location_on', 'chat', 'star', 'campaign'
    ];

    const colors = [
        { name: 'blue', class: 'bg-blue-500' },
        { name: 'orange', class: 'bg-orange-500' },
        { name: 'pink', class: 'bg-pink-500' },
        { name: 'purple', class: 'bg-purple-500' },
        { name: 'red', class: 'bg-red-500' },
        { name: 'green', class: 'bg-green-500' },
        { name: 'gray', class: 'bg-gray-500' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                onClick={resetAndClose}
            ></div>
            
            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-entry/10 flex items-center justify-center text-entry">
                            <span className="material-symbols-outlined text-[24px]">extension</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 leading-none">New Widget</h2>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Configure Interactive Element</p>
                        </div>
                    </div>
                    <button 
                        onClick={resetAndClose}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Widget Name</label>
                        <input 
                            type="text"
                            value={widgetName}
                            onChange={(e) => setWidgetName(e.target.value)}
                            placeholder="e.g. Social Share"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-entry/10 focus:border-entry transition-all focus:outline-hidden text-sm font-medium"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Widget URL (Optional)</label>
                        <input 
                            type="text"
                            value={widgetUrl}
                            onChange={(e) => setWidgetUrl(e.target.value)}
                            placeholder="https://example.com/widget.html"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-entry/10 focus:border-entry transition-all focus:outline-hidden text-sm font-medium"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Select Icon</label>
                        <div className="grid grid-cols-5 gap-3">
                            {icons.map(icon => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setWidgetIcon(icon)}
                                    className={`aspect-square flex items-center justify-center rounded-xl border transition-all ${widgetIcon === icon ? 'border-entry bg-entry/5 text-entry scale-110 shadow-sm' : 'border-gray-100 text-gray-400 hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <span className="material-symbols-outlined text-[22px]">{icon}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Theme Color</label>
                        <div className="flex gap-3">
                            {colors.map(color => (
                                <button
                                    key={color.name}
                                    type="button"
                                    onClick={() => setWidgetColor(color.name)}
                                    className={`w-8 h-8 rounded-full ${color.class} transition-all ${widgetColor === color.name ? 'ring-4 ring-offset-2 ring-gray-200 scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                        <button 
                            type="button"
                            onClick={resetAndClose}
                            className="flex-1 px-6 py-4 border border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 px-6 py-4 bg-entry text-white font-bold rounded-2xl hover:bg-[#059669] transition-all shadow-xl shadow-entry/20 text-sm flex items-center justify-center gap-2 group"
                        >
                            Create Widget
                            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WidgetUploadModal;
