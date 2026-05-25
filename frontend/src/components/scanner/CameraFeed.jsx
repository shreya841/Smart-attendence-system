import React from 'react';
import { RefreshCw, CameraOff } from 'lucide-react';

/**
 * CameraFeed Component
 * Displays the live camera feed video stream or appropriate system status screens (loading models / hardware offline).
 */
export default function CameraFeed({ videoRef, cameraActive, modelsStatus }) {
  if (cameraActive) {
    return (
      <video
        ref={videoRef}
        className="w-full h-full object-cover scale-x-[-1]"
        muted
        playsInline
        id="biometric-video-element"
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-3 bg-slate-950">
      {modelsStatus === 'loading' ? (
        <RefreshCw className="w-10 h-10 text-cyber-cyan animate-spin" />
      ) : (
        <CameraOff className="w-10 h-10 text-slate-800 animate-pulse" />
      )}
      <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
        {modelsStatus === 'loading' ? 'Downloading Deep Models...' : 'Biometric Hardware Offline'}
      </p>
      <p className="text-[9px] text-slate-600 px-6 text-center max-w-xs leading-normal uppercase">
        {modelsStatus === 'loading' 
          ? 'Fetching tiny face detector and landmarks weights from high-speed cache...' 
          : 'Web camera system disengaged. Click start below to initiate scanners.'}
      </p>
    </div>
  );
}
