import React from 'react';
import { useEditorStore } from './store';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import Canvas from './components/Canvas';

const BannerTextEditor: React.FC = () => {
  const { previewMode } = useEditorStore();

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden">
      <TopBar />
      
      <div className="flex flex-1 overflow-hidden">
        {!previewMode && <LeftSidebar />}
        
        <main className="flex-1 flex items-center justify-center p-8 overflow-auto bg-gray-200 shadow-inner">
          <Canvas />
        </main>
        
        {!previewMode && <RightSidebar />}
      </div>
    </div>
  );
};

export default BannerTextEditor;
