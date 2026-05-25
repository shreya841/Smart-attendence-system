import React from 'react';

/**
 * FaceMeshOverlay Component
 * Renders the canvas overlay for drawing facial wireframes and detection corner frames.
 */
export default function FaceMeshOverlay({ canvasRef, cooldownState }) {
  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
        id="biometric-canvas-overlay"
      />
      
      {/* Glowing neon vertical Laser Scan Line */}
      {!cooldownState && (
        <div className="absolute left-0 w-full h-0.5 bg-cyber-cyan/85 shadow-[0_0_15px_#00F0FF] animate-scan-line pointer-events-none z-10"></div>
      )}
    </>
  );
}

/**
 * drawCustomDetections
 * Draws glowing corners around the detected face region.
 */
export const drawCustomDetections = (ctx, detection, isLocked) => {
  const { x, y, width, height } = detection.detection.box;
  
  ctx.strokeStyle = isLocked ? '#10B981' : '#00F0FF';
  ctx.lineWidth = 3;
  ctx.shadowColor = isLocked ? '#10B981' : '#00F0FF';
  ctx.shadowBlur = 12;
  
  const cornerLength = Math.min(width, height) * 0.15;
  
  // Top-Left corner
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLength);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLength, y);
  ctx.stroke();
  
  // Top-Right corner
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLength, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + cornerLength);
  ctx.stroke();
  
  // Bottom-Left corner
  ctx.beginPath();
  ctx.moveTo(x, y + height - cornerLength);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + cornerLength, y + height);
  ctx.stroke();
  
  // Bottom-Right corner
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLength, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - cornerLength);
  ctx.stroke();
  
  ctx.shadowBlur = 0;
};

/**
 * drawCustomMesh
 * Draws biometric feature dots and connecting mesh lines.
 */
export const drawCustomMesh = (ctx, landmarks, isLocked) => {
  const points = landmarks.positions;
  
  ctx.fillStyle = isLocked ? '#10B981' : '#00F0FF';
  ctx.strokeStyle = isLocked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 240, 255, 0.2)';
  ctx.lineWidth = 1;
  
  // Draw dots
  for (const pt of points) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  // Connect segments
  const drawSegment = (start, end, close = false) => {
    ctx.beginPath();
    ctx.moveTo(points[start].x, points[start].y);
    for (let i = start + 1; i <= end; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (close) ctx.closePath();
    ctx.stroke();
  };
  
  drawSegment(0, 16);         // Jaw Outline
  drawSegment(17, 21);        // Left Eyebrow
  drawSegment(22, 26);        // Right Eyebrow
  drawSegment(27, 30);        // Nose Bridge
  drawSegment(31, 35);        // Nose bottom base
  drawSegment(36, 41, true);  // Left Eye
  drawSegment(42, 47, true);  // Right Eye
  drawSegment(48, 59, true);  // Outer lips contour
  drawSegment(60, 67, true);  // Inner lips contour
};

/**
 * drawScanningCrosshairs
 * Draws tracking lines and center scopes when scanning.
 */
export const drawScanningCrosshairs = (ctx, width, height) => {
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 60, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 4, 0, 2 * Math.PI);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(width / 2 - 100, height / 2);
  ctx.lineTo(width / 2 + 100, height / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width / 2, height / 2 - 100);
  ctx.lineTo(width / 2, height / 2 + 100);
  ctx.stroke();

  if (Math.floor(Date.now() / 600) % 2 === 0) {
    ctx.fillStyle = '#00F0FF';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 4;
    ctx.fillText('BIOMETRIC SCANNERS ENGAGED: ALIGN FACE', width / 2, height / 2 + 85);
    ctx.shadowBlur = 0;
  }
};
