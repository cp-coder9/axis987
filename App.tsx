import React, { useState, useCallback, ChangeEvent, DragEvent } from 'react';
import { generateFloorPlan, generateElevation } from './services/geminiService';
import { FloorPlanData, Room, ElevationData } from './types';
import FloorPlan from './components/FloorPlan';
import ElevationView from './components/ElevationView';
import Loader from './components/Loader';
import EditSidebar from './components/EditSidebar';
import Tooltip from './components/Tooltip';
import LayerControl from './components/LayerControl';
import RoomPalette from './components/RoomPalette';

type Mode = 'floorPlan' | 'elevation';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('floorPlan');
  const [description, setDescription] = useState<string>('');
  const [floorPlanData, setFloorPlanData] = useState<FloorPlanData | null>(null);
  const [elevationData, setElevationData] = useState<ElevationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [tooltip, setTooltip] = useState<{ room: Room; x: number; y: number } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const processFile = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow drop
    e.stopPropagation();
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!imageBase64 || !imageFile || isLoading) return;

    setIsLoading(true);
    setError(null);
    setFloorPlanData(null);
    setElevationData(null);
    setEditingRoom(null);
    setTooltip(null);
    setVisibleLayers(new Set());

    try {
      const imagePart = {
        inlineData: {
          mimeType: imageFile.type,
          data: imageBase64.split(',')[1],
        },
      };

      if (mode === 'floorPlan') {
        const data = await generateFloorPlan(description, imagePart);
        setFloorPlanData(data);
      } else {
        const data = await generateElevation(description, imagePart);
        setElevationData(data);
        if (data.layers) {
            setVisibleLayers(new Set(data.layers.map(l => l.name)));
        }
      }

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [description, isLoading, imageFile, imageBase64, mode]);

  const handleRoomSelect = (room: Room | null) => {
    setEditingRoom(room);
  };

  const handleCloseEditor = () => {
    setEditingRoom(null);
  };

  const handleRoomLayoutUpdate = (updatedRooms: Room[]) => {
    if (!floorPlanData) return;
    setFloorPlanData({
      ...floorPlanData,
      rooms: updatedRooms,
    });
  };

  const handleRoomUpdate = (updatedRoom: Room) => {
    if (!floorPlanData || !editingRoom) return;
    const updatedRooms = floorPlanData.rooms.map(room =>
      room.name === editingRoom.name ? updatedRoom : room
    );
    handleRoomLayoutUpdate(updatedRooms);
    setEditingRoom(updatedRoom); // Keep the editor open with the new data
  };

  const handleRoomAdd = (position: { x: number; y: number }) => {
    if (!floorPlanData) return;
    const newRoomName = `Room ${floorPlanData.rooms.length + 1}`;
    const newRoom: Room = {
      name: newRoomName,
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      dimensions: { width: 10, height: 10 },
    };
    const updatedRooms = [...floorPlanData.rooms, newRoom];
    handleRoomLayoutUpdate(updatedRooms);
    setEditingRoom(newRoom); // Select the new room for immediate editing
  };
  
  const handleRoomHover = (room: Room, event: MouseEvent) => {
    setTooltip({ room, x: event.clientX, y: event.clientY });
  };

  const handleRoomMouseOut = () => {
    setTooltip(null);
  };
  
  const handleToggleLayer = (layerName: string) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerName)) {
        newSet.delete(layerName);
      } else {
        newSet.add(layerName);
      }
      return newSet;
    });
  };

  const ModeButton: React.FC<{ currentMode: Mode, targetMode: Mode, setMode: (mode: Mode) => void, children: React.ReactNode }> = ({ currentMode, targetMode, setMode, children }) => (
    <button
      onClick={() => setMode(targetMode)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${currentMode === targetMode ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
      aria-pressed={currentMode === targetMode}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <main className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            AI Architectural Visualizer
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Generate 2D floor plans or building elevations from an image.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="flex flex-col space-y-4 lg:col-span-1">
            <div className="flex items-center space-x-4 bg-gray-800 p-2 rounded-lg">
                <span className="font-semibold text-gray-300">Mode:</span>
                <ModeButton currentMode={mode} targetMode="floorPlan" setMode={setMode}>Floor Plan</ModeButton>
                <ModeButton currentMode={mode} targetMode="elevation" setMode={setMode}>Elevation</ModeButton>
            </div>

            {mode === 'floorPlan' && <RoomPalette />}

             <label htmlFor="image-upload" className="text-xl font-semibold text-gray-300">
              1. Upload {mode === 'floorPlan' ? 'Floor Plan Image' : 'Building Photo'}
            </label>
            <div 
              className={`w-full h-64 border-2 border-dashed rounded-lg flex items-center justify-center relative bg-gray-800/50 transition-colors duration-300 ${isDraggingOver ? 'border-cyan-400' : 'border-gray-700 hover:border-cyan-500'}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input 
                id="image-upload"
                type="file" 
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isLoading}
              />
              {imageBase64 ? (
                <img src={imageBase64} alt="Preview" className="object-contain h-full w-full p-2" />
              ) : (
                <div className="text-center text-gray-500 pointer-events-none">
                  <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  <p className="mt-2">Click to upload or drag & drop</p>
                  <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
                </div>
              )}
            </div>
            
            <label htmlFor="description" className="text-lg font-semibold text-gray-300">
              2. (Optional) Add Instructions
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={mode === 'floorPlan' ? "e.g., 'The room labeled 'Gang' is the Garage.'" : "e.g., 'Focus on the front facade only.'"}
              className="w-full h-24 p-4 bg-gray-800 border-2 border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200 resize-none"
              disabled={isLoading}
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading || !imageBase64}
              className="w-full px-6 py-3 flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isLoading ? 'Generating...' : `Generate ${mode === 'floorPlan' ? 'Plan' : 'Elevation'}`}
            </button>
          </div>

          {/* Output Section */}
          <div className="flex flex-col lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-300 mb-4">
              Visualized Output
            </h2>
            <div className="flex-grow flex items-center justify-center bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-lg p-4 min-h-[300px] lg:min-h-0">
              {isLoading && <Loader />}
              {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg text-center">{error}</div>}
              
              {mode === 'floorPlan' && floorPlanData && !isLoading && (
                <FloorPlan
                  data={floorPlanData}
                  description={imageBase64 || ''}
                  selectedRoom={editingRoom}
                  onRoomSelect={handleRoomSelect}
                  onRoomHover={handleRoomHover}
                  onRoomMouseOut={handleRoomMouseOut}
                  onLayoutUpdate={handleRoomLayoutUpdate}
                  onRoomAdd={handleRoomAdd}
                />
              )}
              
              {mode === 'elevation' && elevationData && !isLoading && (
                <ElevationView data={elevationData} visibleLayers={visibleLayers} />
              )}
              
              {!isLoading && !error && !floorPlanData && !elevationData && (
                <div className="text-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg>
                  <p className="mt-4 font-semibold">Your drawing will appear here</p>
                   <p className="text-sm mt-1 text-gray-600">Upload an image and click 'Generate' to begin.</p>
                </div>
              )}
            </div>
            {mode === 'elevation' && elevationData && !isLoading && (
              <LayerControl
                layers={elevationData.layers}
                visibleLayers={visibleLayers}
                onToggleLayer={handleToggleLayer}
              />
            )}
          </div>
        </div>
      </main>
      {mode === 'floorPlan' && (
        <>
          <EditSidebar
            room={editingRoom}
            onUpdate={handleRoomUpdate}
            onClose={handleCloseEditor}
          />
          <Tooltip info={tooltip} />
        </>
      )}
    </div>
  );
};

export default App;