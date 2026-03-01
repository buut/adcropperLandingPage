import React, { useState, useEffect } from 'react';

interface RenameLayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRename: (newName: string) => void;
    initialName: string;
}

const RenameLayerModal: React.FC<RenameLayerModalProps> = ({ isOpen, onClose, onRename, initialName }) => {
    const [name, setName] = useState(initialName);

    useEffect(() => {
        setName(initialName);
    }, [initialName, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onRename(name.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-800">Rename Layer</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex flex-col gap-2 mb-6">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">New Layer Name</label>
                        <input
                            autoFocus
                            type="text"
                            className="w-full text-xs border-gray-100 bg-gray-50/50 rounded-lg h-10 focus:ring-primary focus:border-primary transition-all font-medium px-4 shadow-sm"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-md hover:shadow-lg transition-all"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RenameLayerModal;
