import React from 'react';

interface TimelineTimerProps {
    currentTime?: string;
    duration: number;
    onDurationChange: (duration: number) => void;
    className?: string;
}

const TimelineTimer: React.FC<TimelineTimerProps> = ({
    currentTime = "00:00.00",
    duration,
    onDurationChange,
    className = ""
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(duration.toString());
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleDoubleClick = () => {
        setIsEditing(true);
        setEditValue(duration.toString());
    };

    const handleBlur = () => {
        setIsEditing(false);
        const val = parseInt(editValue);
        if (!isNaN(val) && val > 0 && val <= 3600) {
            onDurationChange(val);
        } else {
            setEditValue(duration.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(duration.toString());
        }
    };

    return (
        <div className={`flex items-center gap-2 px-2 py-0.5 bg-gray-50 rounded border border-gray-200 ${className}`}>
            <span className="text-[11px] font-mono font-bold text-primary">{currentTime}</span>
            <span className="text-[10px] text-gray-400">/</span>
            {isEditing ? (
                <input 
                    ref={inputRef}
                    type="number"
                    min="1"
                    max="3600"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-10 bg-white border border-primary text-[11px] font-mono font-bold text-gray-600 outline-hidden rounded px-0.5"
                />
            ) : (
                <span 
                    className="text-[11px] font-mono font-bold text-gray-600 cursor-pointer hover:bg-gray-100 rounded px-0.5"
                    onDoubleClick={handleDoubleClick}
                    title="Double click to change duration"
                >
                    {duration}
                </span>
            )}
        </div>
    );
};

export default TimelineTimer;
