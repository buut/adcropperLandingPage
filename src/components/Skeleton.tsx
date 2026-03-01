import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  animate?: 'shimmer' | 'pulse' | 'none';
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '100%',
  borderRadius = '0.75rem', // Default matches rounded-xl (12px)
  className = '',
  animate = 'shimmer',
}) => {
  const animationClass = 
    animate === 'shimmer' ? 'animate-shimmer' : 
    animate === 'pulse' ? 'animate-pulse-skeleton' : '';

  return (
    <div
      className={`bg-[#f0f0f0] ${animationClass} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
      }}
    />
  );
};

export default Skeleton;
