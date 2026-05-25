import React from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, 
  CameraOff, 
  RefreshCw, 
  ShieldCheck, 
  ShieldX,
  Target,
  UserCheck,
  Zap
} from 'lucide-react';

/**
 * ScannerTelemetryHUD
 * Displays live tracking diagnostics (online status, current head pose, target lock progress).
 */
export function ScannerTelemetryHUD({
  cameraActive,
  cooldownState,
  scannerStatusMsg,
  telemetryPose,
  telemetryLockProgress
}) {
  if (!cameraActive || cooldownState) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md border border-white/5 rounded-xl p-3 text-[9px] text-slate-400 leading-relaxed uppercase select-none font-mono"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse shadow-cyan-glow"></span>
        <span className="text-white font-bold">SECURE_NODE: ACTIVE</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">STATUS:</span>
        <span className="text-cyber-cyan font-bold animate-pulse">{scannerStatusMsg}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">POSE:</span>
        <span className={`font-bold ${telemetryPose === 'front' ? 'text-cyber-green text-glow-green' : 'text-cyber-gold'}`}>
          {telemetryPose === 'none' ? 'CALIBRATING...' : telemetryPose}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">ALIGN:</span>
        <span className="text-cyber-cyan font-bold">{telemetryLockProgress}%</span>
        {telemetryLockProgress >= 100 && (
          <motion.span 
            animate={{ opacity: [1, 0, 1] }} 
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-cyber-gold font-bold ml-1"
          >
            ← BLINK NOW
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * ScannerCooldownOverlay
 * Renders the full-viewport cyberpunk holograph card showing attendance scan details or failure logs.
 */
export function ScannerCooldownOverlay({
  cooldownState,
  lastScanDetails,
  cooldownTimeLeft
}) {
  if (!cooldownState || !lastScanDetails) return null;

  const isSuccess = lastScanDetails.success;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#030712]/95 backdrop-blur-md p-6 text-center">
      {/* Laser scan line overlay */}
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent ${
        isSuccess 
          ? lastScanDetails.eventType === 'CHECK_OUT' 
            ? 'via-cyber-blue shadow-blue-glow' 
            : 'via-cyber-green shadow-green-glow' 
          : 'via-cyber-red shadow-red-glow'
      } to-transparent animate-laser-sweep`}></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25 }}
        className={`w-full max-w-sm glass-panel-heavy rounded-2xl p-6 relative overflow-hidden border ${
          isSuccess 
            ? 'border-cyber-green/20 shadow-green-glow' 
            : 'border-cyber-red/20 shadow-red-glow'
        } flex flex-col items-center`}
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyber-cyan/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyber-blue/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative mb-4">
          <div className={`absolute -inset-1 rounded-full border ${isSuccess ? 'border-cyber-green/20 animate-ping' : 'border-cyber-red/20 animate-pulse'}`}></div>
          <div className={`relative p-3.5 rounded-full border bg-slate-950/90 shadow-lg ${
            isSuccess 
              ? lastScanDetails.eventType === 'CHECK_OUT'
                ? 'border-cyber-blue/30 text-cyber-blue shadow-blue-glow'
                : 'border-cyber-green/30 text-cyber-green shadow-green-glow'
              : 'border-cyber-red/30 text-cyber-red shadow-red-glow'
          }`}>
            {isSuccess ? <ShieldCheck className="w-7 h-7" /> : <ShieldX className="w-7 h-7" />}
          </div>
        </div>

        <span className={`text-[8px] font-mono tracking-widest font-bold uppercase mb-1 ${isSuccess ? 'text-cyber-green' : 'text-cyber-red'}`}>
          {isSuccess ? 'BIOMETRIC PUNCH SUCCESSFUL' : 'BIOMETRIC PUNCH REJECTED'}
        </span>
        
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-0.5">
          {lastScanDetails.name}
        </h3>
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-4">
          {isSuccess ? 'SUBJECT IDENTITY SECURELY ENROLLED' : 'AUTH ATTEMPT BLOCKED'}
        </span>

        <div className="w-full bg-[#050811]/90 border border-white/5 rounded-xl p-3.5 text-[10px] space-y-2.5 font-mono text-left relative z-10 shadow-inner">
          <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
            <span className="text-slate-500">SUBJECT ID:</span>
            <span className="text-white font-bold">{lastScanDetails.id}</span>
          </div>
          <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
            <span className="text-slate-500">DEPARTMENT:</span>
            <span className="text-slate-300 font-bold uppercase truncate max-w-[140px]">{lastScanDetails.department}</span>
          </div>
          {isSuccess && (
            <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
              <span className="text-slate-500">ACCURACY LOCK:</span>
              <span className="text-cyber-green font-bold text-glow-green">
                {Math.round(lastScanDetails.confidence * 100)}% Match
              </span>
            </div>
          )}
          <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
            <span className="text-slate-500">EVENT ACTION:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wider ${
              lastScanDetails.eventType === 'CHECK_IN' 
                ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20' 
                : lastScanDetails.eventType === 'CHECK_OUT'
                ? 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20'
                : 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20'
            }`}>
              {lastScanDetails.eventType}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
            <span className="text-slate-500">TIMESTAMP:</span>
            <span className="text-slate-350">{lastScanDetails.scanTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PUNCTUALITY:</span>
            {lastScanDetails.eventType === 'CHECK_OUT' ? (
              <span className="text-cyber-blue font-bold uppercase tracking-wider">SHIFT END</span>
            ) : lastScanDetails.isLate ? (
              <span className="text-cyber-red font-bold uppercase animate-pulse">
                LATE (+{lastScanDetails.lateDuration})
              </span>
            ) : isSuccess ? (
              <span className="text-cyber-green font-bold uppercase tracking-wider">ON TIME</span>
            ) : (
              <span className="text-cyber-red font-bold uppercase">{lastScanDetails.message}</span>
            )}
          </div>
        </div>

        <div className="mt-4 w-full bg-[#050811] border border-white/5 px-3 py-2 rounded-xl text-[8px] text-slate-500 font-bold uppercase flex items-center justify-between select-none">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin text-cyber-cyan" />
            <span>ENCLAVE RESET TIMER</span>
          </div>
          <span className="text-white bg-slate-900 border border-white/10 px-2 py-0.5 rounded font-mono">
            {cooldownTimeLeft}S
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * ScannerConfidenceMeter
 * Renders the lock confidence bar under the camera video viewport.
 */
export function ScannerConfidenceMeter({
  cameraActive,
  cooldownState,
  realtimeScore
}) {
  if (!cameraActive || cooldownState) return null;

  return (
    <div className="w-full mt-4 space-y-1.5 px-1 select-none">
      <div className="flex justify-between items-center text-[9px] font-bold font-mono">
        <span className="text-slate-500 tracking-wider">BIOMETRIC ENCRYPTED MATCH MATRIX</span>
        <span className={`${realtimeScore >= 82 ? 'text-cyber-green animate-pulse font-bold' : 'text-cyber-cyan'} tracking-widest`}>
          {realtimeScore > 0 ? `${realtimeScore}% LOCK` : 'SEARCHING TARGET...'}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-950 border border-white/5 rounded-full overflow-hidden p-[1px]">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${
            realtimeScore >= 82 
              ? 'bg-gradient-to-r from-cyber-green/40 to-cyber-green shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
              : realtimeScore > 0 
              ? 'bg-gradient-to-r from-cyber-cyan/40 to-cyber-cyan shadow-[0_0_8px_rgba(6,182,212,0.4)]' 
              : 'bg-cyber-red/10 shadow-none'
          }`}
          style={{ width: `${realtimeScore}%` }}
        ></div>
      </div>
    </div>
  );
}

/**
 * ScannerControls
 * Action triggers to turn the biometric scanning hardware on/off.
 */
export function ScannerControls({
  cameraActive,
  modelsStatus,
  onStartCamera,
  onStopCamera
}) {
  return (
    <div className="mt-6 flex gap-4 justify-center">
      {cameraActive ? (
        <button
          onClick={onStopCamera}
          className="flex items-center gap-2 bg-cyber-red/5 hover:bg-cyber-red/10 border border-cyber-red/20 text-cyber-red text-[9px] font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-all select-none uppercase tracking-widest font-mono active:scale-[0.98]"
        >
          <CameraOff className="w-3.5 h-3.5" /> Stop Scan Lens
        </button>
      ) : (
        <button
          onClick={onStartCamera}
          disabled={modelsStatus !== 'ready'}
          className="flex items-center gap-2 bg-gradient-to-r from-cyber-blue to-cyber-cyan hover:from-blue-600 hover:to-cyan-500 text-slate-950 font-bold py-2.5 px-5 rounded-xl border border-cyan-400/20 shadow-cyan-glow text-[9px] uppercase tracking-widest cursor-pointer transition-all duration-200 select-none disabled:opacity-50 font-mono active:scale-[0.98]"
        >
          {modelsStatus === 'loading' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
              BOOTING ENGINES...
            </>
          ) : (
            <>
              <Camera className="w-3.5 h-3.5 text-slate-950" />
              Initialize Scan Lens
            </>
          )}
        </button>
      )}
    </div>
  );
}
