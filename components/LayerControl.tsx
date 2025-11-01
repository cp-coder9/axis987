import React from 'react';
import { ElevationLayer } from '../types';

interface LayerControlProps {
  layers: ElevationLayer[];
  visibleLayers: Set<string>;
  onToggleLayer: (layerName: string) => void;
}

const LayerControl: React.FC<LayerControlProps> = ({ layers, visibleLayers, onToggleLayer }) => {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mt-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-gray-300 mb-3">Layers</h3>
      <div className="space-y-2">
        {layers.map(layer => (
          <label key={layer.name} className="flex items-center space-x-3 cursor-pointer text-gray-200 hover:text-white">
            <input
              type="checkbox"
              checked={visibleLayers.has(layer.name)}
              onChange={() => onToggleLayer(layer.name)}
              className="form-checkbox h-5 w-5 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"
            />
            <span>{layer.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default LayerControl;
