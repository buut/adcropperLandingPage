import React from 'react';
import TimeLineControlButtons from './TimeLineControlButtons';
import TimelineTimer from './TimelineTimer';
import SliderZoom from './SliderZoom';

interface TimeLineToolBarProps {
    selectedStageName?: string;
    duration: number;
    onDurationChange: (duration: number) => void;
    zoom?: number;
    onZoomChange?: (zoom: number) => void;
    minZoom?: number;
    maxZoom?: number;
    isPlaying?: boolean;
    onPlayToggle?: () => void;
    currentTime?: number;
}

const TimeLineToolBar: React.FC<TimeLineToolBarProps> = (props) => {
    const { selectedStageName, duration, onDurationChange, isPlaying, onPlayToggle, currentTime = 0 } = props;
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-10 border-b border-[rgb(229,232,235)] flex items-center justify-between px-4 bg-white">
            <div className="flex items-center gap-4 min-w-[240px]">
                <TimeLineControlButtons isPlaying={isPlaying} onPlayToggle={onPlayToggle} />
                <TimelineTimer 
                    currentTime={formatTime(currentTime)} 
                    duration={duration}
                    onDurationChange={onDurationChange}
                />
            </div>

            <div className="flex-1 flex justify-center">
                {selectedStageName && (
                    <span className="text-xs font-semibold text-gray-600 px-3 py-1 bg-gray-50 rounded-md border border-gray-100">
                        {selectedStageName}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-6 min-w-[240px] justify-end">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-px bg-gray-200"></div>
                    <SliderZoom 
                        min={props.minZoom ? props.minZoom * 100 : 20}
                        max={props.maxZoom ? props.maxZoom * 100 : 1000}
                        value={Math.round((props.zoom || 1) * 100)}
                        onChange={(val) => props.onZoomChange?.(val / 100)}
                        step={10}
                    />
                </div>
            </div>
        </div>
    );
};

export default TimeLineToolBar;
