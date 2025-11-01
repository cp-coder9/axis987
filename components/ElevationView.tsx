
import React, { useRef, useEffect } from 'react';
// FIX: Use named imports for d3 to resolve module errors.
import { select, zoom, zoomIdentity } from 'd3';
import type { D3ZoomEvent } from 'd3';
import { ElevationData, ElevationLayer, ElevationElement } from '../types';

interface ElevationViewProps {
  data: ElevationData;
  visibleLayers: Set<string>;
}

const ElevationView: React.FC<ElevationViewProps> = ({ data, visibleLayers }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dataRef = useRef<ElevationData | null>(null);


  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Prevent re-running D3 code if data is the same
    if (data === dataRef.current) return;
    dataRef.current = data;

    const { layers } = data;
    const svg = select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    svg
      .attr('width', '100%')
      .attr('height', '100%')
      .style('cursor', 'grab');

    // Accessibility
    svg.append('title').text('Building Elevation Drawing');
    svg.append('desc').text('An interactive 2D elevation view of a building facade.');

    const g = svg.append('g').attr('class', 'elevation-group');

    // D3 data join for layers
    const layerGroups = g.selectAll<SVGGElement, ElevationLayer>('g.layer')
      .data(layers, (d: ElevationLayer) => d.name)
      .join('g')
      .attr('class', 'layer')
      .attr('data-layer-name', d => d.name)
      .style('transition', 'opacity 300ms ease-in-out');

    // D3 data join for elements within each layer
    layerGroups.selectAll('path, rect, line')
      .data((d: ElevationLayer) => d.elements.map(el => ({ ...el, layerName: d.name })))
      .join(
        (enter: any) => enter.append((d: any) => document.createElementNS('http://www.w3.org/2000/svg', d.type))
          .attr('x', d => d.x ?? null)
          .attr('y', d => d.y ?? null)
          .attr('width', d => d.width ?? null)
          .attr('height', d => d.height ?? null)
          .attr('x1', d => d.x1 ?? null)
          .attr('y1', d => d.y1 ?? null)
          .attr('x2', d => d.x2 ?? null)
          .attr('y2', d => d.y2 ?? null)
          .attr('d', d => d.d ?? null)
          .attr('fill', d => d.type === 'rect' ? 'rgba(200, 200, 220, 0.1)' : 'none')
          .attr('stroke', '#E5E7EB')
          // Enhance visual hierarchy
          .attr('stroke-width', d => d.layerName === 'Structural' ? 3 : 1.5)
          .style('opacity', 0)
          .transition()
          .duration(500)
          .delay((d,i) => i * 5)
          .style('opacity', 1)
      );
    
    // --- Zoom to Fit ---
    const bounds = g.node()?.getBBox();
    const parent = svg.node()?.parentElement;
    if (!bounds || !parent) return;

    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;
    const { x, y, width, height } = bounds;

    const midX = x + width / 2;
    const midY = y + height / 2;

    if (width === 0 || height === 0) return;

    const scale = 0.9 / Math.max(width / fullWidth, height / fullHeight);
    const translateX = fullWidth / 2 - scale * midX;
    const translateY = fullHeight / 2 - scale * midY;

    const initialTransform = zoomIdentity.translate(translateX, translateY).scale(scale);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
            g.attr('transform', event.transform.toString());
        });

    svg.call(zoomBehavior);
    svg.on('dblclick.zoom', null);
    svg.call(zoomBehavior.transform, initialTransform);

  }, [data]);

  // A separate effect for visibility toggling
  useEffect(() => {
    if (!svgRef.current || !data) return;
    const g = select(svgRef.current).select<SVGGElement>('g.elevation-group');
    
    g.selectAll<SVGGElement, ElevationLayer>('g.layer')
        .style('opacity', d => visibleLayers.has(d.name) ? 1 : 0)
        .style('pointer-events', d => visibleLayers.has(d.name) ? 'all' : 'none');

  }, [visibleLayers, data]);


  return (
    <div className="w-full h-full bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg overflow-hidden">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default ElevationView;