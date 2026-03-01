import React from 'react';
import { useEditorStore } from '../store';
import LayersPanel from './LayersPanel';

const LeftSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden shadow-sm z-10">
      <div className="flex-1 overflow-y-auto">
        <LayersPanel />
      </div>
    </aside>
  );
};

export default LeftSidebar;
