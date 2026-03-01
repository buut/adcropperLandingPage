import React from 'react';

interface TimeLineControlButtonsProps {
    isPlaying?: boolean;
    onPlayToggle?: () => void;
    onSkipNext?: () => void;
    onSkipPrevious?: () => void;
    className?: string;
}

const TimeLineControlButtons: React.FC<TimeLineControlButtonsProps> = ({
    isPlaying = false,
    onPlayToggle,
    onSkipNext,
    onSkipPrevious,
    className = ""
}) => {
    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <button 
                className="p-1.5 bg-primary rounded-full text-white mx-1 hover:opacity-90 transition-opacity flex items-center justify-center"
                onClick={onPlayToggle}
                title={isPlaying ? "Pause" : "Play"}
            >
                <span className="material-symbols-outlined text-[19px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                </span>
            </button>
        </div>
    );
};

export default TimeLineControlButtons;
