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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
      {modelsStatus === 'loading' ? (
        <RefreshCw className="h-10 w-10 animate-spin text-indigo-600" />
      ) : (
        <CameraOff className="h-10 w-10 text-slate-400" />
      )}
      <p className="text-sm font-semibold text-slate-700">
        {modelsStatus === 'loading' ? 'Loading biometric models...' : 'Camera is offline'}
      </p>
      <p className="max-w-xs px-6 text-center text-xs leading-relaxed text-slate-500">
        {modelsStatus === 'loading'
          ? 'Preparing face detection and landmark models.'
          : 'Start the camera to begin attendance scanning.'}
      </p>
    </div>
  );
}
