import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    actions: Array<{
        label: string;
        onClick: () => void;
        icon?: string;
        disabled?: boolean;
        variant?: 'default' | 'danger';
    }>;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = React.useState({ x, y });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    React.useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            let newX = x;
            let newY = y;

            if (x + rect.width > winW - 10) {
                newX = winW - rect.width - 10;
            }
            if (newX < 10) newX = 10;

            if (y + rect.height > winH - 10) {
                newY = winH - rect.height - 10;
            }
            if (newY < 10) newY = 10;

            setAdjustedPos({ x: newX, y: newY });
        }
    }, [x, y]);

    return (
        <div 
            ref={menuRef}
            className="fixed z-[1000] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
            style={{ left: adjustedPos.x, top: adjustedPos.y, opacity: menuRef.current ? 1 : 0 }}
        >
            {actions.map((action, index) => {
                const isDanger = action.variant === 'danger';
                return (
                    <button
                        key={index}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors ${
                            action.disabled 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : isDanger
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-gray-700 hover:bg-primary/5 hover:text-primary'
                        }`}
                        onClick={() => {
                            if (!action.disabled) {
                                action.onClick();
                                onClose();
                            }
                        }}
                        disabled={action.disabled}
                    >
                        {action.icon && (
                            <span className={`material-symbols-outlined text-[18px] ${isDanger && !action.disabled ? 'text-red-400' : ''}`}>
                                {action.icon}
                            </span>
                        )}
                        <span className="flex-1">{action.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ContextMenu;
