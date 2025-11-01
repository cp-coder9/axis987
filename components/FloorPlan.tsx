import React, { useRef, useEffect, useCallback } from 'react';
import { select, zoom, zoomIdentity, drag } from 'd3';
import type { D3ZoomEvent, D3DragEvent } from 'd3';
import { FloorPlanData, Room, Wall, Window, Door, Stairs } from '../types';

interface FloorPlanProps {
  data: FloorPlanData;
  description: string;
  selectedRoom: Room | null;
  onRoomSelect: (room: Room | null) => void;
  onRoomHover: (room: Room, event: MouseEvent) => void;
  onRoomMouseOut: () => void;
  onLayoutUpdate: (updatedRooms: Room[]) => void;
  onRoomAdd: (position: { x: number; y: number }) => void;
}

type DragEvent = D3DragEvent<SVGGElement, Room, Room>;
type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const SNAP_THRESHOLD = 5;

const FloorPlan: React.FC<FloorPlanProps> = ({ data, description, selectedRoom, onRoomSelect, onRoomHover, onRoomMouseOut, onLayoutUpdate, onRoomAdd }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastDescriptionRef = useRef<string | null>(null);
  const zoomBehaviorRef = useRef<any>(null);


  const getSVGCoordinates = useCallback((event: React.DragEvent | DragEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    // FIX: D3DragEvent does not have clientX/Y directly. This checks for properties
    // on native MouseEvents/React's synthetic events first, then falls back to
    // accessing the `sourceEvent` on a D3 event.
    if ('clientX' in event) {
      pt.x = event.clientX;
      pt.y = event.clientY;
    } else {
      // This branch handles D3DragEvent which wraps the original DOM event.
      const sourceEvent = event.sourceEvent;
      if (sourceEvent.changedTouches && sourceEvent.changedTouches.length > 0) {
        // Handle touch events
        pt.x = sourceEvent.changedTouches[0].clientX;
        pt.y = sourceEvent.changedTouches[0].clientY;
      } else {
        // Handle mouse events
        pt.x = sourceEvent.clientX;
        pt.y = sourceEvent.clientY;
      }
    }
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return { x: 0, y: 0 };
    return pt.matrixTransform(screenCTM.inverse());
  }, []);

  // Main rendering effect
  useEffect(() => {
    if (!data || !svgRef.current) return;
    
    const isNewPlan = lastDescriptionRef.current !== description;
    
    const { rooms, elements } = data;
    const svg = select(svgRef.current);

    if (isNewPlan) {
      svg.selectAll('*').remove(); // Full clear for new plans

      svg.attr('width', '100%').attr('height', '100%');
      svg.append('title').text('Interactive Floor Plan');
      svg.append('desc').text('A 2D floor plan editor.');

      const defs = svg.append('defs');
      const gradient = defs.append('linearGradient').attr('id', 'wall-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
      gradient.append('stop').attr('offset', '0%').style('stop-color', '#525c69');
      gradient.append('stop').attr('offset', '100%').style('stop-color', '#414a56');

      svg.append('g').attr('class', 'floorplan-group');
    }
    
    const g = svg.select<SVGGElement>('g.floorplan-group');
    const snapGuidesGroup = g.selectAll('.snap-guides').data([null]).join('g').attr('class', 'snap-guides');

    // Drag behavior for moving rooms
    const dragHandler = drag<SVGGElement, Room>()
      .on('start', function (event: DragEvent) {
        select(this).raise();
      })
      .on('drag', function (event: DragEvent, d) {
        const draggedRoom = d;
        let dx = event.x - draggedRoom.position.x;
        let dy = event.y - draggedRoom.position.y;
        
        // --- Snapping Logic ---
        snapGuidesGroup.selectAll('*').remove();
        const otherRooms = rooms.filter(r => r.name !== draggedRoom.name);
        const currentBounds = {
            left: event.x, top: event.y, 
            right: event.x + draggedRoom.dimensions.width, bottom: event.y + draggedRoom.dimensions.height,
            centerX: event.x + draggedRoom.dimensions.width / 2,
            centerY: event.y + draggedRoom.dimensions.height / 2
        };

        let snappedX = false, snappedY = false;

        for (const other of otherRooms) {
            const otherBounds = {
                left: other.position.x, top: other.position.y,
                right: other.position.x + other.dimensions.width, bottom: other.position.y + other.dimensions.height,
                centerX: other.position.x + other.dimensions.width / 2,
                centerY: other.position.y + other.dimensions.height / 2
            };

            const checkSnap = (val1: number, val2: number, newCoord: number, isX: boolean) => {
                if (Math.abs(val1 - val2) < SNAP_THRESHOLD) {
                    if (isX) { dx = newCoord - draggedRoom.position.x; snappedX = true; }
                    else { dy = newCoord - draggedRoom.position.y; snappedY = true; }
                    snapGuidesGroup.append('line').attr('class', 'snap-guide')
                        .attr(isX ? 'x1' : 'y1', val2).attr(isX ? 'x2' : 'y2', val2)
                        .attr(isX ? 'y1' : 'x1', Math.min(currentBounds.top, otherBounds.top))
                        .attr(isX ? 'y2' : 'x2', Math.max(currentBounds.bottom, otherBounds.bottom));
                }
            };
            
            if (!snappedX) checkSnap(currentBounds.left, otherBounds.left, otherBounds.left, true);
            if (!snappedX) checkSnap(currentBounds.left, otherBounds.right, otherBounds.right, true);
            if (!snappedX) checkSnap(currentBounds.right, otherBounds.left, otherBounds.left - draggedRoom.dimensions.width, true);
            if (!snappedX) checkSnap(currentBounds.right, otherBounds.right, otherBounds.right - draggedRoom.dimensions.width, true);
            if (!snappedX) checkSnap(currentBounds.centerX, otherBounds.centerX, otherBounds.centerX - draggedRoom.dimensions.width / 2, true);

            if (!snappedY) checkSnap(currentBounds.top, otherBounds.top, otherBounds.top, false);
            if (!snappedY) checkSnap(currentBounds.top, otherBounds.bottom, otherBounds.bottom, false);
            if (!snappedY) checkSnap(currentBounds.bottom, otherBounds.top, otherBounds.top - draggedRoom.dimensions.height, false);
            if (!snappedY) checkSnap(currentBounds.bottom, otherBounds.bottom, otherBounds.bottom - draggedRoom.dimensions.height, false);
            if (!snappedY) checkSnap(currentBounds.centerY, otherBounds.centerY, otherBounds.centerY - draggedRoom.dimensions.height / 2, false);
        }

        draggedRoom.position.x += dx;
        draggedRoom.position.y += dy;
        select(this).attr('transform', `translate(${draggedRoom.position.x}, ${draggedRoom.position.y})`);
      })
      .on('end', () => {
        snapGuidesGroup.selectAll('*').remove();
        onLayoutUpdate([...rooms]);
      });
      
    // --- RENDER DETAILED ARCHITECTURAL ELEMENTS ---
    g.selectAll('.elements-layer').data([null]).join('g').attr('class', 'elements-layer')
        .selectAll('g.element')
        .data(elements, (d:any) => JSON.stringify(d)) // Simple keying
        .join(
            enter => {
                const el = enter.append('g').attr('class', d => `element element-${d.type}`);
                // Element creation logic remains the same...
                el.each(function(d) {
                    const el = select(this);
                    switch (d.type) {
                      case 'wall': el.append('rect').attr('fill', 'url(#wall-gradient)'); break;
                      case 'window':
                          el.append('rect').attr('class', 'window-frame').attr('fill', '#374151');
                          el.append('rect').attr('class', 'window-glass').attr('fill', '#60a5fa');
                          break;
                      case 'door':
                          el.append('rect').attr('class', 'door-panel-bg').attr('fill', '#9ca3af44');
                          el.append('rect').attr('class', 'door-panel-outline').attr('fill', 'none').attr('stroke', '#e5e7eb').attr('stroke-width', 0.5);
                          el.append('path').attr('class', 'door-swing').attr('fill', 'none').attr('stroke', '#9ca3af').attr('stroke-width', 0.5).style('stroke-dasharray', '2,2');
                          break;
                      case 'stairs':
                          el.append('rect').attr('class', 'stairs-outline').attr('fill', 'none').attr('stroke', '#9ca3af').attr('stroke-width', 1);
                          // lines will be added in update
                          break;
                    }
                });
                return el;
            },
            update => update, // Just return update selection
            exit => exit.remove()
        )
        .each(function(d) { // This now runs for both enter and update
            const el = select(this);
            switch (d.type) {
                case 'wall':
                    const wall = d as Wall;
                    const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180 / Math.PI;
                    const length = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));
                    el.select('rect').attr('x', 0).attr('y', -wall.thickness / 2).attr('width', length).attr('height', wall.thickness).attr('transform', `translate(${wall.x1}, ${wall.y1}) rotate(${angle})`);
                    break;
                case 'window':
                     const win = d as Window;
                    const winAngle = Math.atan2(win.y2 - win.y1, win.x2 - win.y1) * 180 / Math.PI;
                    const winLength = Math.sqrt(Math.pow(win.x2 - win.x1, 2) + Math.pow(win.y2 - win.y1, 2));
                    el.select('.window-frame').attr('x', 0).attr('y', -win.thickness / 2).attr('width', winLength).attr('height', win.thickness).attr('transform', `translate(${win.x1}, ${win.y1}) rotate(${winAngle})`);
                    el.select('.window-glass').attr('x', 2).attr('y', -win.thickness / 2 + 2).attr('width', Math.max(0, winLength - 4)).attr('height', Math.max(0, win.thickness - 4)).attr('transform', `translate(${win.x1}, ${win.y1}) rotate(${winAngle})`);
                    break;
                case 'door':
                    const door = d as Door;
                    const doorGroup = el.attr('transform', `translate(${door.x}, ${door.y}) rotate(${door.angle})`);
                    const w = door.width; const h = door.height;
                    doorGroup.select('.door-panel-bg').attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h);
                    doorGroup.select('.door-panel-outline').attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h);
                    doorGroup.select('.door-swing').attr('d', `M ${-w/2} ${-h/2} A ${w} ${w} 0 0 1 ${w/2} ${-h/2 + w}`);
                    break;
                case 'stairs':
                    const stairs = d as Stairs;
                    const stairGroup = el.attr('transform', `translate(${stairs.x}, ${stairs.y})`);
                    stairGroup.select('.stairs-outline').attr('width', stairs.width).attr('height', stairs.height);
                    stairGroup.selectAll('line').remove();
                    const stepCount = Math.floor(stairs.direction === 'vertical' ? stairs.height / 0.8 : stairs.width / 0.8);
                    for (let i = 1; i < stepCount; i++) {
                        const line = stairGroup.append('line').attr('stroke', '#9ca3af').attr('stroke-width', 0.5);
                        if (stairs.direction === 'vertical') {
                            const stepY = i * stairs.height / stepCount;
                            line.attr('x1', 0).attr('y1', stepY).attr('x2', stairs.width).attr('y2', stepY);
                        } else {
                            const stepX = i * stairs.width / stepCount;
                            line.attr('x1', stepX).attr('y1', 0).attr('x2', stepX).attr('y2', stairs.height);
                        }
                    }
                    break;
            }
        });
    
    // --- RENDER INTERACTION LAYER & LABELS ---
    const interactionGroup = g.selectAll('.interaction-layer').data([null]).join('g').attr('class', 'interaction-layer');
    
    interactionGroup.selectAll<SVGGElement, Room>('g.room-interactive')
      .data(rooms, (d: Room) => d.name)
      .join(
        enter => {
            const group = enter.append('g')
                .attr('class', 'room-interactive')
                .style('cursor', 'move')
                .on('click', (event, d) => { event.stopPropagation(); onRoomSelect(d); })
                .on('mouseover', function (event, d) { select(this).select('rect.interaction-area').attr('fill-opacity', 0.1); onRoomHover(d, event as MouseEvent); })
                .on('mouseout', function () { select(this).select('rect.interaction-area').attr('fill-opacity', 0); onRoomMouseOut(); });
            
            group.append('rect').attr('class', 'interaction-area').attr('fill', '#e5e7eb').attr('fill-opacity', 0);
            group.append('rect').attr('class', 'highlight-area').attr('fill', '#34d399').attr('fill-opacity', 0).style('pointer-events', 'none');
            group.append('rect').attr('class', 'room-outline').attr('fill', 'none').attr('stroke', '#22d3ee').attr('stroke-width', 0.5).attr('stroke-opacity', 0.6).style('pointer-events', 'none');
            group.append('text').attr('class', 'room-label').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('fill', 'white').attr('font-weight', 'bold').style('font-size', '10px').style('pointer-events', 'none').style('text-shadow', '0px 0px 4px rgba(0, 0, 0, 0.9)');
            group.append('text').attr('class', 'room-dims').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('fill', 'white').attr('font-size', '8px').style('pointer-events', 'none').style('text-shadow', '0px 0px 4px rgba(0, 0, 0, 0.9)');
            group.append('text').attr('class', 'room-area').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('fill', 'white').attr('font-size', '8px').style('pointer-events', 'none').style('text-shadow', '0px 0px 4px rgba(0, 0, 0, 0.9)');
            
            group.call(dragHandler as any);
            return group;
        }
      )
      .attr('transform', d => `translate(${d.position.x}, ${d.position.y})`)
      .each(function(d) {
          const group = select(this);
          group.select('.interaction-area').attr('width', d.dimensions.width).attr('height', d.dimensions.height);
          group.select('.highlight-area').attr('width', d.dimensions.width).attr('height', d.dimensions.height);
          group.select('.room-outline').attr('width', d.dimensions.width).attr('height', d.dimensions.height);
          group.select('.room-label').attr('x', d.dimensions.width / 2).attr('y', d.dimensions.height / 2 - 12).text(d.name);
          group.select('.room-dims').attr('x', d.dimensions.width / 2).attr('y', d.dimensions.height / 2 + 6).text(`${d.dimensions.width.toFixed(2)}m x ${d.dimensions.height.toFixed(2)}m`);
          group.select('.room-area').attr('x', d.dimensions.width / 2).attr('y', d.dimensions.height / 2 + 18).text(`Area: ${(d.dimensions.width * d.dimensions.height).toFixed(1)} sqm`);
      });

    // --- Zoom Behavior ---
    if (isNewPlan) {
        const bounds = g.node()?.getBBox();
        const parent = svg.node()?.parentElement;
        if (!bounds || !parent) return;

        const { x, y, width, height } = bounds;
        const initialScale = (width === 0 || height === 0) ? 1 : 0.9 / Math.max(width / parent.clientWidth, height / parent.clientHeight);
        const initialTransform = zoomIdentity.translate(parent.clientWidth / 2 - initialScale * (x + width/2), parent.clientHeight / 2 - initialScale * (y + height/2)).scale(initialScale);
        
        const zoomFn = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 10]).on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => g.attr('transform', event.transform.toString()));
        zoomBehaviorRef.current = zoomFn;

        svg.call(zoomFn).on('dblclick.zoom', null);
        svg.call(zoomFn.transform, initialTransform);
        svg.on('click', () => onRoomSelect(null));

        lastDescriptionRef.current = description;
    }
      
  }, [data, description]);

  // Effect for selection highlight and resize handles
  useEffect(() => {
    if (!svgRef.current || !data) return;
    const svg = select(svgRef.current);
    const g = svg.select<SVGGElement>('g.floorplan-group');

    // Highlight
    svg.selectAll('rect.highlight-area').attr('fill-opacity', d => (d as Room).name === selectedRoom?.name ? 0.25 : 0);

    // Resize Handles
    g.selectAll('.resize-handles').remove();
    if (selectedRoom) {
      const roomGroup = g.selectAll<SVGGElement, Room>('g.room-interactive').filter(d => d.name === selectedRoom.name);
      if (roomGroup.empty()) return;
      
      const handlesGroup = roomGroup.append('g').attr('class', 'resize-handles');
      const { width, height } = selectedRoom.dimensions;
      const handleSize = 6;
      const handlePositions: {type: ResizeHandleType, x: number, y: number, cursor: string}[] = [
        { type: 'nw', x: 0, y: 0, cursor: 'nwse-resize' }, { type: 'n', x: width / 2, y: 0, cursor: 'ns-resize' }, { type: 'ne', x: width, y: 0, cursor: 'nesw-resize' },
        { type: 'e', x: width, y: height / 2, cursor: 'ew-resize' }, { type: 'se', x: width, y: height, cursor: 'nwse-resize' }, { type: 's', x: width / 2, y: height, cursor: 'ns-resize' },
        { type: 'sw', x: 0, y: height, cursor: 'nesw-resize' }, { type: 'w', x: 0, y: height / 2, cursor: 'ew-resize' },
      ];

      handlesGroup.selectAll('rect.resize-handle')
        .data(handlePositions)
        .enter()
        .append('rect')
        .attr('class', 'resize-handle')
        .attr('x', d => d.x - handleSize / 2)
        .attr('y', d => d.y - handleSize / 2)
        .attr('width', handleSize)
        .attr('height', handleSize)
        .style('cursor', d => d.cursor)
        .call(drag<SVGRectElement, typeof handlePositions[0]>()
          .on('start', function() { select(this).raise(); })
          .on('drag', function(event, d) {
              const currentRoom = { ...selectedRoom };
              const original = { ...selectedRoom };
              const dx = event.dx;
              const dy = event.dy;

              if (d.type.includes('e')) currentRoom.dimensions.width = Math.max(1, original.dimensions.width + dx);
              if (d.type.includes('w')) {
                  currentRoom.dimensions.width = Math.max(1, original.dimensions.width - dx);
                  currentRoom.position.x = original.position.x + dx;
              }
              if (d.type.includes('s')) currentRoom.dimensions.height = Math.max(1, original.dimensions.height + dy);
              if (d.type.includes('n')) {
                  currentRoom.dimensions.height = Math.max(1, original.dimensions.height - dy);
                  currentRoom.position.y = original.position.y + dy;
              }
              
              const updatedRooms = data.rooms.map(r => r.name === currentRoom.name ? currentRoom : r);
              onLayoutUpdate(updatedRooms);
          })
          .on('end', () => onLayoutUpdate(data.rooms))
        );
    }

  }, [selectedRoom, data, onLayoutUpdate]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const toolType = e.dataTransfer.getData('tool');
      if (toolType === 'new-room') {
          const coords = getSVGCoordinates(e);
          onRoomAdd(coords);
      }
  };


  return (
    <div ref={wrapperRef} className="w-full h-full bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default FloorPlan;