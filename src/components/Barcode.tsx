"use client";

import React from 'react';

const CODE39_MAP: Record<string, string> = {
  '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
  '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWNNNN', '7': 'NNNWNNWNW',
  '8': 'WNNWNNWNN', '9': 'NNWWNNWNN', 'A': 'WNNNNWNNW', 'B': 'NNWNNWNNW',
  'C': 'WNWNNWNNN', 'D': 'NNNNWWNNW', 'E': 'WNNNWWNNN', 'F': 'NNWNWWNNN',
  'G': 'NNNNNWWNW', 'H': 'WNNNNWWNN', 'I': 'NNWNNWWNN', 'J': 'NNNNWWWNN',
  'K': 'WNNNNNNWW', 'L': 'NNWNNNNWW', 'M': 'WNWNNNNWN', 'N': 'NNNNWNNWW',
  'O': 'WNNNWNNWN', 'P': 'NNWNWNNWN', 'Q': 'NNNNNNWWW', 'R': 'WNNNNNWWN',
  'S': 'NNWNNNWWN', 'T': 'NNNNWNWWN', 'U': 'WWNNNNNNW', 'V': 'NWWNNNNNW',
  'W': 'WWWNNNNNN', 'X': 'NWNNWNNNW', 'Y': 'WWNNWNNNN', 'Z': 'NWWNWNNNN',
  '*': 'NWNNWNWNN'
};

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
}

export function Barcode({ value, width = 2.0, height = 50 }: BarcodeProps) {
  const chars = `*${value.toUpperCase()}*`;
  
  // Calculate modules
  const modules: { isBar: boolean; isWide: boolean }[] = [];
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const pattern = CODE39_MAP[char];
    if (!pattern) continue;
    
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === 'W';
      modules.push({ isBar, isWide });
    }
    
    // Inter-character gap (narrow space)
    if (i < chars.length - 1) {
      modules.push({ isBar: false, isWide: false });
    }
  }
  
  // Draw modules
  let currentX = 0;
  const rects: React.ReactNode[] = [];
  const narrowWidth = width;
  const wideWidth = width * 2.5;
  
  modules.forEach((module, idx) => {
    const w = module.isWide ? wideWidth : narrowWidth;
    if (module.isBar) {
      rects.push(
        <rect
          key={idx}
          x={currentX}
          y={0}
          width={w}
          height={height}
          fill="black"
        />
      );
    }
    currentX += w;
  });
  
  const totalWidth = currentX + 40; // 20px padding left + 20px padding right
  
  return (
    <svg
      width={totalWidth}
      height={height + 20}
      viewBox={`0 0 ${totalWidth} ${height + 20}`}
      xmlns="http://www.w3.org/2000/svg"
      className="max-w-full"
      shapeRendering="crispEdges"
    >
      {/* Solid white background for perfect contrast */}
      <rect x={0} y={0} width={totalWidth} height={height + 20} fill="white" />
      
      {/* Centered barcode elements inside the quiet zone */}
      <g transform="translate(20, 0)">
        {rects}
        <text
          x={currentX / 2}
          y={height + 15}
          textAnchor="middle"
          fontSize="12"
          fontFamily="monospace"
          fill="black"
        >
          {value.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}

export default Barcode;
