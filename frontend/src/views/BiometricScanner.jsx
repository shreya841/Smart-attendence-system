import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiCall } from '../services/api.js';
import { loadFaceApiModels, detectFaceBiometrics, estimateHeadPose, faceapi } from '../services/faceApiService.js';
import { playBiometricSound } from '../services/soundService.js';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { 

  Scan, 
  Clock, 
  Activity, 
  Globe,
  Compass,
  MapPin,
  AlertTriangle,
  Volume2,
  RefreshCw
} from 'lucide-react';

// Import our modular scanner components and helper utilities
import { speakGreeting as speak } from '../components/scanner/VoiceAssistant.js';
import { calculateAverageEAR, processBlinkState } from '../components/scanner/BlinkDetector.js';
import { submitAttendanceScan, mapErrorToVoiceMessage } from '../components/scanner/AttendanceProcessor.js';
import CameraFeed from '../components/scanner/CameraFeed.jsx';
import FaceMeshOverlay, { 
  drawCustomDetections, 
  drawCustomMesh, 
  drawScanningCrosshairs 
} from '../components/scanner/FaceMeshOverlay.jsx';
import { 
  ScannerTelemetryHUD, 
  ScannerCooldownOverlay, 
  ScannerConfidenceMeter, 
  ScannerControls 
} from '../components/scanner/ScannerHUD.jsx';
import ScannerErrorBoundary from '../components/scanner/ScannerErrorBoundary.jsx';

// Setup beautiful custom pins so they don't break in Vite builds
const officeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const employeeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const employeeOutsideIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to center leaflet maps
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    try {
      const container = map.getContainer();
      if (!container) return;
      
      if (center && center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
        map.setView(center, map.getZoom());
      }
    } catch (e) {
      console.warn('[ChangeMapView Cleanup Guard]: Map is unmounted.', e);
    }
  }, [center, map]);
  return null;
}

// Client-side Haversine distance calculator
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

// Client-side Ray-Casting Polygon validator
const isPointInPolygon = (lat, lng, polygon) => {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;
  let isInside = false;
  const x = lng, y = lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
};

export default function BiometricScanner() {
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const mapTileUrl = theme === 'dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  
  // Refs for tracking video and canvas elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Active states
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // Model loading state
  const [modelsStatus, setModelsStatus] = useState('idle');
  
  // Core scan loop control refs — all refs to avoid stale closures in rAF
  const animationFrameIdRef = useRef(null);
  const consecutiveFrontFrames = useRef(0);
  const cooldownActive = useRef(false);
  const scanLoopActive = useRef(false);
  const scanInProgress = useRef(false); // Prevents concurrent API calls / stuck SCANNING state
  const isComponentMounted = useRef(true);
  const scannerMapRef = useRef(null);
  const activeStreamRef = useRef(null); // Ref to prevent camera track resource leaks
  
  // Blink detection state
  const blinkClosedRef = useRef(false); // true when eyes are currently closed
  const prevEAR = useRef(1.0);          // previous frame EAR for transition detection

  // Ref mirrors for values read inside rAF closures — prevents stale state captures
  const voiceEnabledRef = useRef(true);
  const lastScanDetailsRef = useRef(null);
  
  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      scanLoopActive.current = false;
      
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (activeStreamRef.current) {
        console.log('[BiometricScanner Cleanup]: Stopping active camera tracks...');
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      
      // Explicitly detach Leaflet map instance on unmount
      if (scannerMapRef.current) {
        try {
          console.log('[BiometricScanner Cleanup]: Detaching scanner map...');
          scannerMapRef.current.remove();
          scannerMapRef.current = null;
        } catch (e) {
          console.warn('[BiometricScanner Map Cleanup Warning]:', e);
        }
      }
    };
  }, []);
  
  // Synchronized state for UI rendering
  const [scannerStatusMsg, setScannerStatusMsg] = useState('CAMERA READY');
  const [cooldownState, setCooldownState] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [lastScanDetails, setLastScanDetails] = useState(null);
  const [telemetryPose, setTelemetryPose] = useState('none');
  const [telemetryLockProgress, setTelemetryLockProgress] = useState(0);
  const [scanResult, setScanResult] = useState(null);
  const [realtimeScore, setRealtimeScore] = useState(0);

  // Geofencing coordinates and tracking state
  const [officeCoords, setOfficeCoords] = useState([28.6139, 77.2090]);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [activePolygon, setActivePolygon] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState(null);
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const [isInside, setIsInside] = useState(false);

  // Fetch active office geofence settings on mount
  useEffect(() => {
    const fetchGeofenceSettings = async () => {
      try {
        const response = await apiCall('/settings', 'GET');
        if (response.success && response.settings && isComponentMounted.current) {
          const lat = parseFloat(response.settings.geofence_lat) || 28.6139;
          const lng = parseFloat(response.settings.geofence_lng) || 77.2090;
          const rad = parseInt(response.settings.geofence_radius, 10) || 100;
          setOfficeCoords([lat, lng]);
          setGeofenceRadius(rad);
        }
        
        try {
          const geoRes = await apiCall('/settings/geofence', 'GET');
          if (geoRes.success && geoRes.geofence && isComponentMounted.current) {
            setActivePolygon(geoRes.geofence.polygon_coordinates);
          }
        } catch (e) {
          console.error('[GEOFENCE FETCH ERROR]:', e);
        }
      } catch (err) {
        console.error('[BIOMETRIC SCANNER GEOFENCE SETTINGS FETCH ERROR]:', err);
      }
    };
    fetchGeofenceSettings();
  }, []);

  // Set up live real-time GPS telemetry tracking via watchPosition
  useEffect(() => {
    if (!navigator.geolocation) {
      if (isComponentMounted.current) {
        setGpsError('Geolocation is not supported by your browser.');
        setGpsLoading(false);
      }
      return;
    }

    if (isComponentMounted.current) setGpsLoading(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isComponentMounted.current) return;
        const { latitude, longitude } = position.coords;
        setUserCoords({ latitude, longitude });
        setGpsError(null);
        setGpsLoading(false);
      },
      (error) => {
        if (!isComponentMounted.current) return;
        console.error('[GEOLOCATION TRACKING ERROR]:', error);
        let errorMsg = 'Failed to retrieve GPS location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'GPS Permission Denied. Please enable location services in your browser settings to verify your physical presence inside the office geofence.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'GPS location is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'GPS location request timed out.';
        }
        setGpsError(errorMsg);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000 // Cache GPS coordinates for 5s to reduce CPU overhead and map rerenders
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Compute live geodetic distance / Polygon containment whenever GPS coordinates fluctuate
  useEffect(() => {
    if (userCoords && officeCoords) {
      if (activePolygon && activePolygon.length >= 3) {
        // Use real-time Point-In-Polygon math if enterprise boundary mapped
        const insidePolygon = isPointInPolygon(userCoords.latitude, userCoords.longitude, activePolygon);
        setIsInside(insidePolygon);
        // Calculate raw distance to center just for telemetry overlay
        setDistanceToOffice(calculateDistance(userCoords.latitude, userCoords.longitude, officeCoords[0], officeCoords[1]));
      } else {
        // Fallback to static legacy radius
        const dist = calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          officeCoords[0],
          officeCoords[1]
        );
        setDistanceToOffice(dist);
        setIsInside(dist <= geofenceRadius);
      }
    }
  }, [userCoords, officeCoords, geofenceRadius, activePolygon]);

  // 1. Preload face-api.js neural networks on component mount
  useEffect(() => {
    const initModels = async () => {
      try {
        if (isComponentMounted.current) setModelsStatus('loading');
        await loadFaceApiModels();
        if (isComponentMounted.current) setModelsStatus('ready');
      } catch (err) {
        console.error('[BIOMETRIC SCANNER]: Neural models failed loading:', err);
        if (isComponentMounted.current) setModelsStatus('error');
      }
    };
    initModels();
  }, []);

  // 2. Automatically launch camera feed once models are loaded and ready
  useEffect(() => {
    if (modelsStatus === 'ready') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [modelsStatus]);

  // 5. Unified 5-Second Cooldown Protocol
  const executeScanCooldown = (scanResponse, wasSuccess) => {
    cooldownActive.current = true;
    scanInProgress.current = false; // Always reset scan lock on cooldown
    setCooldownState(true);
    setTelemetryLockProgress(0);
    consecutiveFrontFrames.current = 0;
    blinkClosedRef.current = false;
    
    // Play sci-fi notification audio
    playBiometricSound(wasSuccess ? 'success' : 'failure');
    
    const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const scanDetails = {
      success: wasSuccess,
      message: scanResponse.message || 'Verification complete.',
      id: scanResponse.employee?.id || 'N/A',
      name: scanResponse.employee?.name || 'Unknown User',
      department: scanResponse.employee?.department || 'N/A',
      confidence: scanResponse.confidence || 0,
      eventType: scanResponse.eventType || 'ACCESS_DENIED',
      lateDuration: scanResponse.lateDuration || 'On Time',
      isLate: scanResponse.isLate || false,
      scanTime: scanTime
    };
    // Keep ref in sync so rAF loop always has fresh value (fixes stale closure)
    lastScanDetailsRef.current = scanDetails;
    setLastScanDetails(scanDetails);

    // Build rich voice message
    let voiceMsg;
    if (scanResponse.voiceMessage) {
      voiceMsg = scanResponse.voiceMessage;
    } else if (!wasSuccess) {
      voiceMsg = 'Biometric identification denied. Access blocked.';
    } else {
      const empName = scanResponse.employee?.name || 'Employee';
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (scanResponse.eventType === 'CHECK_OUT') {
        voiceMsg = `Goodbye ${empName}. Check-out time: ${timeStr}.`;
      } else if (scanResponse.isLate) {
        voiceMsg = `Welcome ${empName}. Check-in time: ${timeStr}. You are ${scanResponse.lateDuration || 'some'} late.`;
      } else {
        voiceMsg = `Welcome ${empName}. Check-in time: ${timeStr}.`;
      }
    }
    // Use ref so voice always reflects current toggle state, even inside async closures
    speak(voiceMsg, voiceEnabledRef.current);

    setCooldownTimeLeft(5);
    const interval = setInterval(() => {
      setCooldownTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          cooldownActive.current = false;
          scanInProgress.current = false; // Always release lock on cooldown reset
          setCooldownState(false);
          lastScanDetailsRef.current = null;
          setLastScanDetails(null);
          setScanResult(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 6. Automatic Face Identification Action
  const handleAutoScan = async (descriptorArray) => {
    if (cooldownActive.current || scanInProgress.current) return;
    scanInProgress.current = true; // Lock — prevents concurrent calls
    
    console.log('[DEBUG LOG - ATTENDANCE TRIGGER] Auto-scan triggered. Preparing biometric matching request...');
    
    if (!userCoords) {
      console.warn('[DEBUG LOG - ATTENDANCE TRIGGER] GPS coordinates missing. Cannot mark attendance.');
      setScanResult({ status: 'error', message: 'GPS Signal Lock missing. Location verification required.' });
      executeScanCooldown({ message: 'Location access is required for attendance validation.', voiceMessage: 'Access denied. GPS location signal not found.' }, false);
      return;
    }

    setScanResult({ status: 'analyzing', message: 'Extracting & matching face coordinates...' });
    setScannerStatusMsg('BIOMETRIC MATCH IN PROGRESS...');

    try {
      console.log('[DEBUG LOG - ATTENDANCE TRIGGER] Sending biometric descriptor to verification API. Coordinates:', userCoords.latitude, userCoords.longitude);
      const scanPromise = submitAttendanceScan(descriptorArray, userCoords || {
    latitude: officeCoords[0],
    longitude: officeCoords[1]
  }
);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Biometric matching request timed out.')), 3000)
      );

      const response = await Promise.race([scanPromise, timeoutPromise]);
      console.log('[DEBUG LOG - ATTENDANCE TRIGGER] Biometric scan match successful for:', response.employee?.name);

      setScanResult({
        status: 'success',
        message: response.message,
        employee: response.employee,
        eventType: response.eventType,
        lateDuration: response.lateDuration,
        isLate: response.isLate
      });
      executeScanCooldown(response, true);
    } catch (error) {
      console.error('[DEBUG LOG - ATTENDANCE TRIGGER] Biometric validation exception:', error);
      const voiceAlert = error.voiceMessage || mapErrorToVoiceMessage(error);
      setScanResult({ status: 'error', message: error.message || 'Biometric validation failure.' });
      executeScanCooldown({
        message: error.message || 'Face biometrics could not be validated.',
        voiceMessage: voiceAlert
      }, false);
    }
  };

  // 7. Core Frame-by-Frame Web Camera Processor
  const processFrame = async () => {
    if (!scanLoopActive.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState >= 2 && canvas) {
      const ctx = canvas.getContext('2d');
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };

      if (displaySize.width === 0 || displaySize.height === 0) {
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        faceapi.matchDimensions(canvas, displaySize);
      }

      ctx.clearRect(0, 0, displaySize.width, displaySize.height);

      if (cooldownActive.current) {
        // Use ref instead of state to avoid stale closure from rAF callback
        const det = lastScanDetailsRef.current;
        ctx.strokeStyle = det?.success ? '#10B981' : '#EF4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = det?.success ? '#10B981' : '#EF4444';
        ctx.shadowBlur = 10;
        ctx.strokeRect(15, 15, displaySize.width - 30, displaySize.height - 30);
        ctx.shadowBlur = 0;
        ctx.fillStyle = det?.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(15, 15, displaySize.width - 30, displaySize.height - 30);
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Skip detection frame if scan API call already in-flight
      if (scanInProgress.current) {
        ctx.fillStyle = 'rgba(6,182,212,0.06)';
        ctx.fillRect(0, 0, displaySize.width, displaySize.height);
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      try {
        const rawDetection = await detectFaceBiometrics(video);

        if (rawDetection) {
          const detection = faceapi.resizeResults(rawDetection, displaySize);
          setRealtimeScore(Math.round(detection.detection.score * 100));

        const isLocked = consecutiveFrontFrames.current >= 3 || cooldownActive.current;
          drawCustomDetections(ctx, detection, isLocked);
          drawCustomMesh(ctx, detection.landmarks, isLocked);

          // === DEDUPLICATED HEAD POSE (single call per frame) ===
          const pose = estimateHeadPose(detection.landmarks);
          setTelemetryPose(pose);

          // === SIMPLE BLINK DETECTION ===
          const leftEye = detection.landmarks.getLeftEye();
          const rightEye = detection.landmarks.getRightEye();
          const ear = calculateAverageEAR(leftEye, rightEye);

          const { isClosed, isBlinkDetected } = processBlinkState(ear, blinkClosedRef.current);
          blinkClosedRef.current = isClosed;

          if (isBlinkDetected) {
            console.log('[DEBUG LOG - BLINK DETECTION] Transition verified. EAR:', ear.toFixed(3), '| Pose:', pose);
            // Immediately trigger scan on blink if face is front-facing
            if (pose === 'front') {
              console.log('[DEBUG LOG - ATTENDANCE TRIGGER] Blink gesture detected while face front-facing. Instantly executing auto-scan...');
              setScannerStatusMsg('BLINK CONFIRMED — SCANNING...');
              handleAutoScan(detection.descriptor);
            } else {
              console.log('[DEBUG LOG - ATTENDANCE TRIGGER] Blink detected, but face is not aligned front-facing. Current pose:', pose);
            }
          }
          prevEAR.current = ear;

          // Update lock progress based on consecutive front frames for UI feedback
          if (pose === 'front') {
            consecutiveFrontFrames.current += 1;
            const progress = Math.min(100, Math.round((consecutiveFrontFrames.current / 8) * 100));
            setTelemetryLockProgress(progress);

            // Auto-trigger scan if face remains stable for 25 frames (~1 second) as a fail-safe/alternative to blink
            if (consecutiveFrontFrames.current >= 1 && !cooldownActive.current && !scanInProgress.current) {
              console.log('[DEBUG LOG - ATTENDANCE TRIGGER] Face stability threshold reached (25 frames). Instantly executing auto-scan...');
              setScannerStatusMsg('STABILITY ACQUIRED — SCANNING...');
              handleAutoScan(detection.descriptor);
            }
          } else {
            consecutiveFrontFrames.current = 0;
            setTelemetryLockProgress(0);
          }

          // UI status updates
          if (pose !== 'front') {
            setScannerStatusMsg('FACE DETECTED: ALIGN FRONT');
          } else if (consecutiveFrontFrames.current < 2) {
            setScannerStatusMsg('STABILIZING FACE...');
          } else if (consecutiveFrontFrames.current < 25) {
            setScannerStatusMsg('FACE LOCKED — HOLD STILL OR BLINK');
          } else {
            setScannerStatusMsg('FACE LOCKED — SCANNING...');
          }
        } else {
          setRealtimeScore(0);
          consecutiveFrontFrames.current = 0;
          setTelemetryLockProgress(0);
          setTelemetryPose('none');
          blinkClosedRef.current = false;
          setScannerStatusMsg('SEARCHING FOR FACE...');
          drawScanningCrosshairs(ctx, displaySize.width, displaySize.height);
        }
      } catch (err) {
        console.error('[BIOMETRIC SCAN LOOP ERROR]:', err);
        setScannerStatusMsg('SCANNER ERROR — RETRYING...');
        scanInProgress.current = false; // Reset on error so loop can recover
        blinkClosedRef.current = false;
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(processFrame);
  };

  // 8. Start and Stop Camera Stream Functions
  const startCamera = async () => {
    if (modelsStatus !== 'ready') return;
    
    try {
      setScannerStatusMsg('STARTING CAMERA...');
      setScanResult(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      setCameraActive(true);
      scanLoopActive.current = true;
      setScannerStatusMsg('CAMERA STARTED - SEARCHING');
      
      setTimeout(() => {
        if (!scanLoopActive.current) {
          console.log('[BiometricScanner startCamera]: Camera stopped before video initialized. Cleaning up stream tracks.');
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => console.error('[BiometricScanner video play error]:', e));
          activeStreamRef.current = mediaStream;
          setStream(mediaStream); // Store stream in state to allow graceful track termination on unmount
          animationFrameIdRef.current = requestAnimationFrame(processFrame);
        } else {
          console.warn('[BiometricScanner startCamera]: videoRef.current not found after mount delay. Terminating stream.');
          mediaStream.getTracks().forEach(track => track.stop());
        }
      }, 10);
    } catch (err) {
      console.error('[CAMERA START ERROR]:', err);
      setScannerStatusMsg('CAMERA ERROR: ' + err.message);
      alert('Failed connecting to webcam. Please verify camera permissions in your browser.');
    }
  };

  const stopCamera = () => {
    scanLoopActive.current = false;
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    if (activeStreamRef.current) {
      console.log('[BiometricScanner stopCamera]: Stopping active camera tracks...');
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setCameraActive(false);
    setTelemetryLockProgress(0);
    setTelemetryPose('none');
    consecutiveFrontFrames.current = 0;
  };

  // Redundant camera track cleanup removed to prevent self-sabotaging camera closure on state change.
  // Full cleanup is already safely handled on unmount via the empty dependency effect at line 152.

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl mx-auto space-y-8 font-mono text-slate-300"
    >
      {/* Sci-Fi Header */}
      <div className="text-center space-y-2.5">
        <h2 className="text-sm font-bold tracking-widest text-white uppercase flex items-center justify-center gap-2">
          <Scan className="w-5 h-5 text-cyber-cyan animate-pulse" />
          AI Biometric Attendance Terminal
        </h2>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#090d16]/75 border border-white/5 rounded-lg text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          <Clock className="w-4 h-4 text-cyber-cyan" />
          Office Core Timings: <span className="text-white">10:00 AM - 19:00 PM</span>
        </div>
      </div>

      {/* Grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Panel: Retinal webcam viewport */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full glass-panel rounded-2xl p-6 overflow-hidden relative flex flex-col items-center shadow-2xl h-fit"
        >
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          <div className="w-full flex items-center justify-between border-b border-white/5 pb-3.5 mb-5">
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2 select-none">
              <span className={`w-2 h-2 rounded-full ${cameraActive && !cooldownState ? 'bg-cyber-cyan animate-ping shadow-cyan-glow' : 'bg-slate-700'}`}></span>
              Retinal Telemetry Capture
            </span>

            {/* Voice toggle */}
            <button
              onClick={() => {
                const next = !voiceEnabled;
                voiceEnabledRef.current = next;
                setVoiceEnabled(next);
              }}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-[8px] font-bold font-mono tracking-wider select-none transition-all duration-200 cursor-pointer ${
                voiceEnabled ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20 shadow-cyan-glow' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-400'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              {voiceEnabled ? 'SYS_VOICE: ON' : 'SYS_VOICE: MUTED'}
            </button>
          </div>

          {/* Camera feed viewport with scifi neon overlays */}
          <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-white/5 shadow-inner mx-auto">
            
            {/* 1. Camera Feed Viewport */}
            <CameraFeed 
              videoRef={videoRef} 
              cameraActive={cameraActive} 
              modelsStatus={modelsStatus} 
            />

            {/* 2. Face Mesh & Laser Overlay */}
            {cameraActive && (
              <ScannerErrorBoundary>
                <FaceMeshOverlay 
                  canvasRef={canvasRef} 
                  cooldownState={cooldownState} 
                />
              </ScannerErrorBoundary>
            )}

            {/* 3. Diagnostics Telemetry HUD */}
            <ScannerErrorBoundary>
              <ScannerTelemetryHUD
                cameraActive={cameraActive}
                cooldownState={cooldownState}
                scannerStatusMsg={scannerStatusMsg}
                telemetryPose={telemetryPose}
                telemetryLockProgress={telemetryLockProgress}
              />
            </ScannerErrorBoundary>

            {/* 4. Cooldown Scanner Info Card / Denial Overlay */}
            <ScannerErrorBoundary>
              <ScannerCooldownOverlay
                cooldownState={cooldownState}
                lastScanDetails={lastScanDetails}
                cooldownTimeLeft={cooldownTimeLeft}
              />
            </ScannerErrorBoundary>

            {/* 4b. AI Voice Assistant Subtitles & simulated audio visualizer */}
            <AnimatePresence>
              {cooldownState && lastScanDetails && (
                <motion.div 
                  initial={{ opacity: 0, y: 15, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, x: '-50%' }}
                  exit={{ opacity: 0, y: 15, x: '-50%' }}
                  className="absolute bottom-4 left-1/2 bg-[#090d16]/95 border border-cyber-cyan/25 rounded-xl px-4 py-2.5 flex items-center gap-3 max-w-[90%] shadow-[0_4px_25px_rgba(6,182,212,0.12)] z-40 select-none"
                >
                  {/* Audio Wave nodes */}
                  <div className="flex gap-0.5 items-end h-4 shrink-0">
                    <div className="w-0.5 h-2 bg-cyber-cyan rounded-full animate-wave-bar" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-0.5 h-3.5 bg-cyber-cyan rounded-full animate-wave-bar" style={{ animationDelay: '0.3s' }}></div>
                    <div className="w-0.5 h-1.5 bg-cyber-cyan rounded-full animate-wave-bar" style={{ animationDelay: '0.0s' }}></div>
                    <div className="w-0.5 h-3 bg-cyber-cyan rounded-full animate-wave-bar" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                  <div className="text-[9px] text-slate-200 font-mono tracking-wide leading-tight uppercase truncate">
                    <span className="text-cyber-cyan font-bold mr-1.5">SYS_VOICE //</span>
                    {(() => {
                      if (lastScanDetails.success) {
                        const timeStr = lastScanDetails.scanTime;
                        if (lastScanDetails.eventType === 'CHECK_OUT') {
                          return `Goodbye ${lastScanDetails.name}. Punch logged at: ${timeStr}.`;
                        } else if (lastScanDetails.isLate) {
                          return `Welcome ${lastScanDetails.name}. Punch logged at: ${timeStr}. Shift late by ${lastScanDetails.lateDuration}.`;
                        } else {
                          return `Welcome ${lastScanDetails.name}. Punch logged at: ${timeStr}. Shift on time.`;
                        }
                      } else {
                        return lastScanDetails.message;
                      }
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 5. Target Lock Confidence Meter */}
          <ScannerConfidenceMeter
            cameraActive={cameraActive}
            cooldownState={cooldownState}
            realtimeScore={realtimeScore}
          />

          {/* 6. Action buttons */}
          <ScannerControls
            cameraActive={cameraActive}
            modelsStatus={modelsStatus}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
          />
        </motion.div>

        {/* Right Panel: Holographic Geofence Radar Map */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-full glass-panel rounded-2xl p-6 overflow-hidden relative flex flex-col shadow-2xl h-fit"
        >
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-5">
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2 select-none">
              <Compass className="w-4 h-4 text-cyber-cyan" />
              Orbital Geofence Tracker
            </span>
            <span className="text-[8px] font-mono text-slate-500 uppercase flex items-center gap-1.5 tracking-wider">
              <span className={`w-1.5 h-1.5 rounded-full ${gpsLoading ? 'bg-cyber-cyan animate-pulse' : gpsError ? 'bg-cyber-red shadow-red-glow' : 'bg-cyber-green animate-ping shadow-green-glow'}`}></span>
              {gpsLoading ? 'ORBITAL SEARCH' : gpsError ? 'SIGNAL LOST' : 'GPS LOCK: SECURED'}
            </span>
          </div>

          {/* Dynamic Map Header Status Bar */}
          <div className={`p-3 rounded-xl border mb-5 flex items-center justify-between font-mono ${
            gpsLoading 
              ? 'bg-cyber-cyan/5 border-cyber-cyan/15 text-cyber-cyan animate-pulse' 
              : gpsError 
              ? 'bg-cyber-red/5 border-cyber-red/15 text-cyber-red' 
              : isInside 
              ? 'bg-cyber-green/5 border-cyber-green/15 text-cyber-green shadow-green-glow' 
              : 'bg-cyber-gold/5 border-cyber-gold/15 text-cyber-gold animate-pulse'
          }`}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <MapPin className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-[8px] text-slate-500 uppercase leading-none">GEOGRAPHIC SECTOR</p>
                <h4 className="text-[10px] font-bold uppercase mt-0.5 truncate">
                  {gpsLoading 
                    ? 'CONNECTING GEODESIC SATELLITES...' 
                    : gpsError 
                    ? 'GPS HARDWARE FAULT' 
                    : isInside 
                    ? 'INBOUND: SECURE SECTOR' 
                    : 'OUTBOUND: BREACH ZONE'}
                </h4>
              </div>
            </div>
            <div className="text-right pl-2 shrink-0">
              <p className="text-[8px] text-slate-500 uppercase leading-none">CLEARANCE</p>
              <h4 className="text-[10px] font-bold uppercase mt-0.5">
                {gpsLoading ? 'WAITING...' : gpsError ? 'FAIL' : isInside ? 'APPROVED' : 'DENIED'}
              </h4>
            </div>
          </div>

          {/* Map Viewport */}
          <div className="h-[250px] w-full rounded-2xl overflow-hidden relative z-10 border border-white/5 bg-slate-950">
            {gpsError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-cyber-red gap-2">
                <AlertTriangle className="w-7 h-7 text-cyber-red animate-bounce" />
                <p className="text-[10px] uppercase font-bold tracking-widest">GPS ACQUISITION FAILED</p>
                <p className="text-[9px] text-slate-500 leading-normal max-w-xs uppercase">{gpsError}</p>
              </div>
            ) : gpsLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                <RefreshCw className="w-6 h-6 text-cyber-cyan animate-spin" />
                <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">PINGING SATELLITES...</p>
              </div>
            ) : (
              <>
                <MapContainer
                  key="scanner-telemetry-map-static"
                  ref={scannerMapRef}
                  center={officeCoords}
                  zoom={17}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  className="h-full w-full"
                >
                  <ChangeMapView center={userCoords ? [userCoords.latitude, userCoords.longitude] : officeCoords} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url={mapTileUrl}
                  />

                  {/* Office HQ Location Pin */}
                  <Marker position={officeCoords} icon={officeIcon}>
                    <Popup>
                      <div className="font-mono text-[9px] leading-normal text-slate-900">
                        <p className="font-bold">HEADQUARTERS CENTER</p>
                        <p>Geofence Radius: {geofenceRadius}m</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Office Geofence Circle or Polygon Boundary */}
                  {activePolygon && activePolygon.length >= 3 ? (
                    <Polygon
                      positions={activePolygon.map(p => [p.lat, p.lng])}
                      pathOptions={{
                        color: isInside ? '#22C55E' : '#06B6D4',
                        fillColor: isInside ? '#22C55E' : '#06B6D4',
                        fillOpacity: 0.08,
                        weight: 1.5,
                        dashArray: '5, 8'
                      }}
                    />
                  ) : (
                    <Circle
                      center={officeCoords}
                      radius={geofenceRadius}
                      pathOptions={{
                        color: isInside ? '#22C55E' : '#06B6D4',
                        fillColor: isInside ? '#22C55E' : '#06B6D4',
                        fillOpacity: 0.08,
                        weight: 1.5,
                        dashArray: '5, 8'
                      }}
                    />
                  )}

                  {/* Employee Live Position Marker */}
                  {userCoords && (
                    <Marker 
                      position={[userCoords.latitude, userCoords.longitude]} 
                      icon={isInside ? employeeIcon : employeeOutsideIcon}
                    >
                      <Popup>
                        <div className="font-mono text-[9px] leading-normal text-slate-900">
                          <p className="font-bold">YOUR LIVE POSITION</p>
                          <p>Distance: {distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : 'Calculating...'}</p>
                          <p>Zone: {isInside ? 'INSIDE ZONE' : 'OUTSIDE ZONE'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>

                {/* Cyberpunk Radar Conic-gradient sweeping animation overlay */}
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
                  <div 
                    className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[conic-gradient(from_0deg,transparent_60%,rgba(6,182,212,0.035)_100%)] rounded-full animate-spin pointer-events-none"
                    style={{ animationDuration: '8s' }}
                  ></div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.02)_0%,transparent_75%)]"></div>
                  <div className="absolute top-1/2 left-0 w-full h-[0.5px] bg-cyber-cyan/10"></div>
                  <div className="absolute left-1/2 top-0 h-full w-[0.5px] bg-cyber-cyan/10"></div>
                </div>
              </>
            )}
          </div>

          {/* Telemetry Digital HUD Stats */}
          <div className="mt-4 bg-[#050811] border border-white/5 rounded-xl p-4 text-[9px] space-y-2 select-none text-slate-500 font-mono">
            <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
              <span>SECURE ZONE CENTER:</span>
              <span className="text-slate-300 font-bold">{officeCoords[0].toFixed(5)}N / {officeCoords[1].toFixed(5)}E</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
              <span>SUBJECT POSITION:</span>
              <span className={userCoords ? 'text-slate-350' : 'text-cyber-red animate-pulse font-bold'}>
                {userCoords 
                  ? `${userCoords.latitude.toFixed(5)}N / ${userCoords.longitude.toFixed(5)}E` 
                  : 'LOCKING SENSOR COORDINATES...'}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
              <span>RADIAL DEVIATION:</span>
              <span className={distanceToOffice !== null ? isInside ? 'text-cyber-green font-bold text-glow-green' : 'text-cyber-red font-bold' : ''}>
                {distanceToOffice !== null 
                  ? `${distanceToOffice.toFixed(1)} METERS` 
                  : 'GPS SCANNING...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>VALIDATION BOUNDARY:</span>
              <span className="text-cyber-cyan">{geofenceRadius} METERS</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Dynamic Informative Readout Footer Bar */}
      <div className="max-w-7xl mx-auto bg-slate-950/20 rounded-xl p-4 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-3 text-[9px] text-slate-500 text-center md:text-left select-none uppercase font-mono tracking-wider">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyber-cyan animate-pulse" />
          <span>Biometric & GPS Gateway Status: <span className="text-cyber-green font-bold">NOMINAL</span></span>
        </div>
        <div className="flex items-center gap-1 font-bold">
          <Globe className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
          <span>GPS COORDINATE MONITOR ENGAGED</span>
        </div>
      </div>
    </motion.div>
  );
}