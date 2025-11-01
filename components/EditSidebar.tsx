import React, { useState, useEffect } from 'react';
import { Room } from '../types';

interface EditSidebarProps {
  room: Room | null;
  onUpdate: (updatedRoom: Room) => void;
  onClose: () => void;
}

const EditSidebar: React.FC<EditSidebarProps> = ({ room, onUpdate, onClose }) => {
  const [formData, setFormData] = useState<Room | null>(null);

  useEffect(() => {
    setFormData(room ? { ...room, position: { ...room.position }, dimensions: { ...room.dimensions } } : null);
  }, [room]);

  if (!room) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const [field, subfield] = name.split('.');
    
    setFormData(prevData => {
      if (!prevData) return null;
      
      const newData = { ...prevData };
      if (subfield) {
        (newData as any)[field] = { ...(newData as any)[field], [subfield]: name === 'name' ? value : parseFloat(value) || 0 };
      } else {
        (newData as any)[field] = value;
      }
      return newData;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onUpdate(formData);
    }
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-80 bg-gray-800 shadow-2xl z-50 p-6 transform transition-transform duration-300 ease-in-out ${room ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-cyan-400">Edit Room</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      {formData && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Room Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          
          <fieldset className="p-3 border border-gray-700 rounded-md">
              <legend className="px-2 text-sm font-medium text-gray-400">Dimensions (m)</legend>
              <div className="flex gap-4">
                  <div>
                      <label htmlFor="dimensions.width" className="block text-sm font-medium text-gray-300 mb-1">Width</label>
                      <input type="number" id="dimensions.width" name="dimensions.width" value={formData.dimensions.width} onChange={handleChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500" />
                  </div>
                  <div>
                      <label htmlFor="dimensions.height" className="block text-sm font-medium text-gray-300 mb-1">Height</label>
                      <input type="number" id="dimensions.height" name="dimensions.height" value={formData.dimensions.height} onChange={handleChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500" />
                  </div>
              </div>
          </fieldset>

          <fieldset className="p-3 border border-gray-700 rounded-md">
              <legend className="px-2 text-sm font-medium text-gray-400">Position (m)</legend>
              <div className="flex gap-4">
                  <div>
                      <label htmlFor="position.x" className="block text-sm font-medium text-gray-300 mb-1">X</label>
                      <input type="number" id="position.x" name="position.x" value={formData.position.x} onChange={handleChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500" />
                  </div>
                  <div>
                      <label htmlFor="position.y" className="block text-sm font-medium text-gray-300 mb-1">Y</label>
                      <input type="number" id="position.y" name="position.y" value={formData.position.y} onChange={handleChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500" />
                  </div>
              </div>
          </fieldset>
          
          <div className="pt-4">
            <button
              type="submit"
              className="w-full px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-md hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
            >
              Update Room
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EditSidebar;