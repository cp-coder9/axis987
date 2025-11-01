import React from 'react';

const RoomPalette: React.FC = () => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('tool', 'new-room');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-300 mb-3">Tools</h3>
      <div className="flex flex-wrap gap-2">
        <div
          className="room-palette-item flex flex-col items-center justify-center p-3 bg-gray-700 rounded-md text-gray-300 hover:bg-gray-600 hover:text-white transition-colors w-24 h-24 border border-gray-600"
          draggable="true"
          onDragStart={handleDragStart}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
          </svg>
          <span className="text-sm">New Room</span>
        </div>
      </div>
    </div>
  );
};

export default RoomPalette;