import React, { useState, useEffect, useRef } from 'react';

interface LazyLoadProps {
    children: React.ReactNode;
    height?: number | string;
    className?: string;
    offset?: number;
    threshold?: number;
    once?: boolean;
}

const LazyLoad: React.FC<LazyLoadProps> = ({ 
    children, 
    height = '100px', 
    className = '', 
    offset = 200, 
    threshold = 0,
    once = false 
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (once) {
                        observer.disconnect();
                    }
                } else if (!once) {
                    setIsVisible(false);
                }
            },
            {
                rootMargin: `${offset}px`,
                threshold: threshold
            }
        );

        const currentRef = containerRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
            observer.disconnect();
        };
    }, [offset, threshold, once]);

    return (
        <div 
            ref={containerRef} 
            className={className} 
            style={{ 
                minHeight: !isVisible ? height : undefined,
                width: '100%'
            }}
        >
            {isVisible ? children : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <span className="material-symbols-outlined animate-pulse">downloading</span>
                        <span className="text-xs font-medium">Loading Stage...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LazyLoad;
