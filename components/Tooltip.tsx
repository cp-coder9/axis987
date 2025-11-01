import React from 'react';
import { Room } from '../types';

interface TooltipProps {
  info: {
    room: Room;
    x: number;
    y: number;
  } | null;
}

const Tooltip: React.FC<TooltipProps> = ({ info }) => {
  if (!info) {
    return null;
  }

  const { room, x, y } = info;

  // Offset tooltip slightly from cursor to prevent flickering
  const style: React.CSSProperties = {
    position: 'fixed',
    top: y + 15,
    left: x + 15,
    pointerEvents: 'none', // Prevent the tooltip from capturing mouse events
    zIndex: 100,
  };

  return (
    <div
      style={style}
      className="bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-md shadow-lg text-sm border border-gray-700 animate-fade-in"
    >
      <p className="font-bold">{room.name}</p>
      <p className="text-xs text-gray-300">{`${room.dimensions.width}m x ${room.dimensions.height}m`}</p>
    </div>
  );
};

export default Tooltip;