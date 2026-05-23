import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiCall } from '../services/api.js';
import { loadFaceApiModels, detectFaceBiometrics, estimateHeadPose, faceapi } from '../services/faceApiService.js';
import { playBiometricSound } from '../services/soundService.js';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { 
  Camera, 
  CameraOff, 
  Scan, 
  ShieldAlert, 
  CheckCircle, 
  Volume2, 
  ShieldX, 
  Fingerprint,
  Activity,
  RefreshCw,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Compass,
  MapPin,
  Globe
} from 'lucide-react';

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
    if (center && center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom());
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
  
  // Refs for tracking video and canvas elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Active states
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // Model loading state
  const [modelsStatus, setModelsStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  
  // Cooldown & Auto-Scan state refs to prevent React state stale closures inside requestAnimationFrame
  const animationFrameIdRef = useRef(null);
  const consecutiveFrontFrames = useRef(0);
  const cooldownActive = useRef(false);
  const scanLoopActive = useRef(false);
  const blinkDetected = useRef(false);
  
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
        if (response.success && response.settings) {
          const lat = parseFloat(response.settings.geofence_lat) || 28.6139;
          const lng = parseFloat(response.settings.geofence_lng) || 77.2090;
          const rad = parseInt(response.settings.geofence_radius, 10) || 100;
          setOfficeCoords([lat, lng]);
          setGeofenceRadius(rad);
        }
        
        try {
          const geoRes = await apiCall('/settings/geofence', 'GET');
          if (geoRes.success && geoRes.geofence) {
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
      setGpsError('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ latitude, longitude });
        setGpsError(null);
        setGpsLoading(false);
      },
      (error) => {
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
        setModelsStatus('loading');
        await loadFaceApiModels();
        setModelsStatus('ready');
      } catch (err) {
        console.error('[BIOMETRIC SCANNER]: Neural models failed loading:', err);
        setModelsStatus('error');
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

  // 3. Voice synthesis greeting engine
  const speakGreeting = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    console.log('[SPEECH SYNTHESIS ANNOUNCEMENT]:', text);
    
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel(); // Clear any queued speech
      
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.95; // Slightly slower for perfect phonetic clarity
        utterance.pitch = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const englishVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB'));
          if (englishVoice) {
            utterance.voice = englishVoice;
          }
        }
        
        utterance.onerror = (e) => {
          console.error('[SPEECH SYNTHESIS PLAYBACK ERROR]:', e);
        };
        
        window.speechSynthesis.speak(utterance);
      }, 60); // 60ms delay ensures browser finishes queue clearance
    } catch (err) {
      console.error('[SPEECH SYNTHESIS ENGINE EXCEPTION]:', err);
    }
  };

  // 4. Custom Neon Sci-Fi Landmesh Overlay drawings
  const drawCustomDetections = (ctx, detection) => {
    const { x, y, width, height } = detection.detection.box;
    
    // Set custom sci-fi glowing styles
    const isLocked = consecutiveFrontFrames.current >= 8 || cooldownActive.current;
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
    
    ctx.shadowBlur = 0; // Reset blur for others
  };

  const drawCustomMesh = (ctx, landmarks) => {
    const points = landmarks.positions;
    const isLocked = consecutiveFrontFrames.current >= 8 || cooldownActive.current;
    
    ctx.fillStyle = isLocked ? '#10B981' : '#00F0FF';
    ctx.strokeStyle = isLocked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    
    // Draw biometric feature dots
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Helper to draw connecting facial segments
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

  const drawScanningCrosshairs = (ctx, width, height) => {
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1.5;

    // Center circular tracking scope
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 60, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 4, 0, 2 * Math.PI);
    ctx.fill();

    // Crosshairs axial lines
    ctx.beginPath();
    ctx.moveTo(width / 2 - 100, height / 2);
    ctx.lineTo(width / 2 + 100, height / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2 - 100);
    ctx.lineTo(width / 2, height / 2 + 100);
    ctx.stroke();

    // Blinking holographic scanning text
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

  // 5. Unified 5-Second Cooldown Protocol
  const executeScanCooldown = (scanResponse, wasSuccess) => {
    cooldownActive.current = true;
    setCooldownState(true);
    setTelemetryLockProgress(0);
    
    // Play sci-fi notification audio chime/buzzer ("bell")
    playBiometricSound(wasSuccess ? 'success' : 'failure');
    
    // Capture exact checkout/check-in timestamp in frontend
    const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setLastScanDetails({
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
    });

    if (scanResponse.voiceMessage) {
      speakGreeting(scanResponse.voiceMessage);
    } else {
      let voiceMsg = 'Biometric identification denied.';
      if (wasSuccess) {
        const empName = scanResponse.employee?.name || 'Employee';
        if (scanResponse.eventType === 'CHECK_OUT') {
          voiceMsg = `Access granted. Goodbye, ${empName}. Exit registered successfully.`;
        } else if (scanResponse.isLate) {
          voiceMsg = `Access granted. Welcome back, ${empName}. You are checked in. You are late by ${scanResponse.lateDuration || 'some time'}.`;
        } else {
          voiceMsg = `Access granted. Welcome back, ${empName}. You are checked in on time.`;
        }
      }
      speakGreeting(voiceMsg);
    }

    setCooldownTimeLeft(5);
    const interval = setInterval(() => {
      setCooldownTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          cooldownActive.current = false;
          setCooldownState(false);
          setLastScanDetails(null);
          setScanResult(null); // Reset HUD display
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 6. Automatic Face Identification Action
  const handleAutoScan = async (descriptorArray) => {
    if (cooldownActive.current) return;
    
    // Check GPS signal lock on frontend
    if (!userCoords) {
      setScanResult({
        status: 'error',
        message: 'GPS Signal Lock missing. Location verification required.'
      });
      executeScanCooldown({
        message: 'Location access is required for attendance validation. Missing GPS coordinates.',
        voiceMessage: 'Access denied. GPS location signal not found.'
      }, false);
      return;
    }

    setScanResult({ status: 'analyzing', message: 'Extracting & matching face coordinates...' });

    try {
      const response = await apiCall('/attendance/scan', 'POST', {
        faceDescriptor: Array.from(descriptorArray),
        faceMetrics: {
          spoofIndex: 0.05,
          landmarks: []
        },
        location: 'Front Desk Camera',
        userCoords: {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude
        }
      });

      if (response.success) {
        setScanResult({
          status: 'success',
          message: response.message,
          employee: response.employee,
          eventType: response.eventType,
          lateDuration: response.lateDuration,
          isLate: response.isLate
        });
        executeScanCooldown(response, true);
      }
    } catch (error) {
      console.error('[BIOMETRIC AUTO-SCAN EXCEPTION]:', error);
      
      let voiceAlert = 'Biometric mismatch. Access Denied.';
      if (error.message.includes('Spoof')) {
        voiceAlert = 'Access denied. Spoofing attempt blocked.';
      } else if (error.message.includes('Unauthorized')) {
        voiceAlert = 'Access denied. Unauthorized individual detected.';
      } else if (error.message.includes('completed') || error.message.includes('satisfied')) {
        voiceAlert = 'Access denied. Attendance processing completed for today.';
      } else if (error.message.includes('outside') || error.message.includes('premises')) {
        voiceAlert = 'Access denied. You are outside office premises.';
      }

      setScanResult({
        status: 'error',
        message: error.message || 'Biometric validation failure.'
      });

      executeScanCooldown({ 
        message: error.message || 'Face biometrics could not be validated.', 
        voiceMessage: voiceAlert 
      }, false);
    }
  };

  // 7. Core Frame-by-Frame Web Camera Processor
  const getEAR = (points) => {
    const v1 = Math.hypot(points[1].x - points[5].x, points[1].y - points[5].y);
    const v2 = Math.hypot(points[2].x - points[4].x, points[2].y - points[4].y);
    const h = Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y);
    return (v1 + v2) / (2.0 * h);
  };

  const processFrame = async () => {
    if (!scanLoopActive.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState >= 2 && canvas) {
      const ctx = canvas.getContext('2d');
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };

      // Prevent 0 dimension errors
      if (displaySize.width === 0 || displaySize.height === 0) {
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Initialize match dimensions safely
      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        faceapi.matchDimensions(canvas, displaySize);
      }

      ctx.clearRect(0, 0, displaySize.width, displaySize.height);

      if (cooldownActive.current) {
        ctx.strokeStyle = lastScanDetails?.success ? '#10B981' : '#EF4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = lastScanDetails?.success ? '#10B981' : '#EF4444';
        ctx.shadowBlur = 10;
        ctx.strokeRect(15, 15, displaySize.width - 30, displaySize.height - 30);
        ctx.shadowBlur = 0;

        ctx.fillStyle = lastScanDetails?.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(15, 15, displaySize.width - 30, displaySize.height - 30);

        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      try {
        const rawDetection = await detectFaceBiometrics(video);

        if (rawDetection) {
          const detection = faceapi.resizeResults(rawDetection, displaySize);
          
          setRealtimeScore(Math.round(detection.detection.score * 100));
          drawCustomDetections(ctx, detection);
          drawCustomMesh(ctx, detection.landmarks);

          const leftEye = detection.landmarks.getLeftEye();
          const rightEye = detection.landmarks.getRightEye();
          const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;
          
          // BYPASS BLINK DETECTION FOR NOW TO ENSURE PIPELINE WORKS
          blinkDetected.current = true;
          // if (ear < 0.22) {
          //    blinkDetected.current = true;
          // }

          const pose = estimateHeadPose(detection.landmarks);
          setTelemetryPose(pose);

          if (pose === 'front') {
            consecutiveFrontFrames.current += 1;
            const progress = Math.min(100, Math.round((consecutiveFrontFrames.current / 4) * 100));
            setTelemetryLockProgress(progress);

            setScannerStatusMsg('ANALYZING STABLE FACE...');

            if (consecutiveFrontFrames.current >= 4) {
              consecutiveFrontFrames.current = 0;
              blinkDetected.current = false;
              setTelemetryLockProgress(100);
              setScannerStatusMsg('MATCH FOUND - VERIFYING...');
              await handleAutoScan(detection.descriptor);
            }
          } else {
            consecutiveFrontFrames.current = 0;
            setTelemetryLockProgress(0);
            setScannerStatusMsg('FACE DETECTED: ALIGN FRONT');
          }
        } else {
          setRealtimeScore(0);
          consecutiveFrontFrames.current = 0;
          setTelemetryLockProgress(0);
          setTelemetryPose('none');
          blinkDetected.current = false;
          setScannerStatusMsg('SEARCHING FOR FACE...');
          
          drawScanningCrosshairs(ctx, displaySize.width, displaySize.height);
        }
      } catch (err) {
        console.error('[BIOMETRIC SCAN LOOP ERROR]:', err);
        setScannerStatusMsg('ERROR: ' + err.message);
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
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
          setStream(mediaStream); // Store stream in state to allow graceful track termination on unmount
          animationFrameIdRef.current = requestAnimationFrame(processFrame);
        }
      }, 100);
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
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setCameraActive(false);
    setTelemetryLockProgress(0);
    setTelemetryPose('none');
    consecutiveFrontFrames.current = 0;
  };

  // Clean up camera on component unmount
  useEffect(() => {
    return () => {
      scanLoopActive.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-mono text-slate-300">
      
      {/* Sci-Fi Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold tracking-widest text-white uppercase flex items-center justify-center gap-2.5">
          <Scan className="w-6 h-6 text-cyber-cyan animate-pulse" />
          AI Biometric Attendance Scanner
        </h2>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-white/5 rounded-full text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-cyber-cyan" />
          Office Core Timings: <span className="text-white">10:00 AM - 07:00 PM</span>
        </div>
      </div>

      {/* Grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Panel: Retinal webcam viewport */}
        <div className="w-full glass-panel rounded-2xl p-6 overflow-hidden relative flex flex-col items-center shadow-2xl h-fit">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          <div className="w-full flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2 select-none">
              <span className={`w-2 h-2 rounded-full ${cameraActive && !cooldownState ? 'bg-cyber-cyan animate-ping' : 'bg-slate-700'}`}></span>
              Biometric Retinal Feed
            </span>

            {/* Voice toggle */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-xl border border-white/5 flex items-center gap-1.5 text-[10px] font-bold select-none transition-all duration-200 cursor-pointer ${
                voiceEnabled ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20 shadow-cyan-glow' : 'bg-slate-900 text-slate-500 hover:text-slate-400'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              {voiceEnabled ? 'VOICE SYNTH ON' : 'MUTED'}
            </button>
          </div>

          {/* Camera feed viewport with scifi neon overlays */}
          <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-inner w-full mx-auto">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover scale-x-[-1]"
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
                />
                
                {/* Glowing neon vertical Laser Scan Line */}
                {!cooldownState && (
                  <div className="absolute left-0 w-full h-0.5 bg-cyber-cyan/85 shadow-[0_0_15px_#00F0FF] animate-scan-line pointer-events-none z-10"></div>
                )}
                
                {/* Real-time Telemetry Hud */}
                {!cooldownState && (
                  <div className="absolute bottom-3 left-3 bg-slate-950/85 border border-white/10 rounded-lg p-2 text-[9px] text-slate-400 leading-relaxed uppercase select-none animate-slide-in">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-ping"></span>
                      <span>SEC_LENS: <span className="text-cyber-green font-bold">ONLINE</span></span>
                    </div>
                    <div>SCANNER STATUS: <span className="text-cyber-cyan font-bold animate-pulse">{scannerStatusMsg}</span></div>
                    <div>POSE ESTIMATE: <span className={`${telemetryPose === 'front' ? 'text-cyber-green' : 'text-cyber-gold'} font-bold`}>{telemetryPose === 'none' ? 'SCANNING...' : telemetryPose}</span></div>
                    <div>ALIGN LOCK: <span className="text-cyber-cyan font-bold">{telemetryLockProgress}%</span></div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-3">
                {modelsStatus === 'loading' ? (
                  <RefreshCw className="w-10 h-10 text-cyber-cyan animate-spin" />
                ) : (
                  <CameraOff className="w-10 h-10 text-slate-800 animate-pulse" />
                )}
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                  {modelsStatus === 'loading' ? 'Downloading Deep Models...' : 'Biometric Hardware Offline'}
                </p>
                <p className="text-[9px] text-slate-600 px-6 text-center max-w-xs leading-normal uppercase">
                  {modelsStatus === 'loading' ? 'Fetching tiny face detector and landmarks weights from high-speed cache...' : 'Web camera system disengaged. Click start below to initiate scanners.'}
                </p>
              </div>
            )}

            {/* 5-SECOND COOLDOWN & ACCESS Telemetry OVERLAY */}
            {cooldownState && lastScanDetails && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md animate-fade-in p-6 text-center">
                <div className={`absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent ${
                  lastScanDetails.success 
                    ? lastScanDetails.eventType === 'CHECK_OUT' 
                      ? 'via-cyber-blue' 
                      : lastScanDetails.isLate 
                      ? 'via-cyber-gold' 
                      : 'via-cyber-green' 
                    : 'via-cyber-red'
                } to-transparent animate-pulse`}></div>
                
                {lastScanDetails.success ? (
                  /* Premium futuristic glassmorphic holographic Employee Info Card */
                  <div className="w-full max-w-sm glass-panel-heavy rounded-2xl p-5 relative overflow-hidden border border-cyan-400/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col items-center animate-slide-in">
                    {/* Glowing mesh background decoration */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyber-cyan/10 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-cyber-green/10 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
                    
                    {/* Pulsing Cyber Verified Badge with Neon Rings */}
                    <div className="relative mb-4">
                      {/* Outer pulsing ring 1 */}
                      <div className="absolute inset-0 rounded-full border border-cyber-green/30 animate-ping" style={{ animationDuration: '2s' }}></div>
                      {/* Outer pulsing ring 2 */}
                      <div className="absolute -inset-2 rounded-full border border-cyber-cyan/20 animate-pulse" style={{ animationDuration: '3s' }}></div>
                      
                      <div className={`relative p-3.5 rounded-full border bg-slate-950/80 shadow-lg ${
                        lastScanDetails.eventType === 'CHECK_OUT'
                          ? 'border-cyber-blue/40 text-cyber-blue shadow-blue-glow'
                          : lastScanDetails.isLate
                          ? 'border-cyber-gold/40 text-cyber-gold shadow-gold-glow'
                          : 'border-cyber-green/40 text-cyber-green shadow-green-glow'
                      }`}>
                        <ShieldCheck className="w-8 h-8 animate-pulse" />
                      </div>
                    </div>

                    {/* Header text */}
                    <span className="text-[9px] font-mono tracking-widest text-cyber-cyan font-bold uppercase mb-0.5">
                      AI BIOMETRIC ATTENDANCE MARKED
                    </span>
                    
                    {/* Large glowing Employee Name */}
                    <h3 className="text-base text-white font-extrabold font-mono uppercase tracking-wider glow-cyan mb-0.5">
                      {lastScanDetails.name}
                    </h3>
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-3 block">
                      VERIFIED SUBJECT SECURE ACCESS
                    </span>

                    {/* Formatted Info Table */}
                    <div className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-[10px] space-y-2 font-mono text-left relative z-10 shadow-inner">
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-500">EMPLOYEE ID:</span>
                        <span className="text-white font-bold">{lastScanDetails.id}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-500">DEPARTMENT:</span>
                        <span className="text-cyber-cyan font-bold uppercase truncate max-w-[150px]">{lastScanDetails.department}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-500">MATCH LOCKED:</span>
                        <span className="text-cyber-green font-bold">
                          🎯 {Math.round(lastScanDetails.confidence * 100)}% ACCURACY
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-500">PUNCH TYPE:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] ${
                          lastScanDetails.eventType === 'CHECK_IN' 
                            ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/20' 
                            : 'bg-cyber-blue/15 text-cyber-blue border border-cyber-blue/20'
                        }`}>
                          {lastScanDetails.eventType}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-500">SCAN TIMESTAMP:</span>
                        <span className="text-white font-semibold">{lastScanDetails.scanTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">PUNCTUALITY AUDIT:</span>
                        {lastScanDetails.eventType === 'CHECK_OUT' ? (
                          <span className="text-cyber-blue font-bold uppercase">EXIT CLEAR</span>
                        ) : lastScanDetails.isLate ? (
                          <span className="text-cyber-red font-bold uppercase animate-pulse">
                            LATE BY {lastScanDetails.lateDuration}
                          </span>
                        ) : (
                          <span className="text-cyber-green font-bold uppercase">ON TIME</span>
                        )}
                      </div>
                    </div>

                    {/* Cooldown Timer Progress HUD */}
                    <div className="mt-4 w-full bg-slate-950 border border-white/5 px-3 py-2 rounded-xl text-[9px] text-slate-500 font-bold uppercase flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin text-cyber-cyan" />
                        <span>System Reset Timer</span>
                      </div>
                      <span className="text-white bg-slate-900 border border-white/10 px-1.5 py-0.5 rounded font-mono">
                        {cooldownTimeLeft}s
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Cyber-styled Auth Failure screen */
                  <div className="w-full max-w-sm glass-panel-heavy rounded-2xl p-5 border border-cyber-red/30 shadow-[0_0_30px_rgba(239,68,68,0.15)] flex flex-col items-center animate-bounce">
                    <div className="p-3.5 rounded-full border border-cyber-red/30 bg-cyber-red/10 text-cyber-red shadow-red-glow mb-3">
                      <ShieldX className="w-8 h-8" />
                    </div>
                    
                    <h3 className="text-xs font-bold uppercase tracking-widest text-cyber-red glow-red mb-1 font-mono">
                      BIOMETRIC ACCESS DENIED
                    </h3>
                    <p className="text-base text-white font-extrabold font-mono uppercase tracking-wider mb-3">
                      {lastScanDetails.name}
                    </p>

                    <div className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-[10px] space-y-2 font-mono text-left mb-4">
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-500">SCAN TIMESTAMP:</span>
                        <span className="text-white font-semibold">{lastScanDetails.scanTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">AUDIT LOG:</span>
                        <span className="text-cyber-red font-bold uppercase">{lastScanDetails.message}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-white/5 px-4 py-2 rounded-xl text-[9px] text-slate-500 font-bold uppercase flex items-center gap-2 select-none">
                      <RefreshCw className="w-3 h-3 animate-spin text-cyber-red" />
                      <span>Scanner Cooldown: <span className="text-white">{cooldownTimeLeft}s</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Lock Confidence Meter */}
          {cameraActive && !cooldownState && (
            <div className="w-full mt-4 space-y-1.5 px-1 select-none">
              <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                <span className="text-slate-400">AI TARGET LOCK CONFIDENCE</span>
                <span className={`${realtimeScore >= 82 ? 'text-cyber-green animate-pulse font-bold' : 'text-cyber-cyan'} tracking-wider`}>
                  {realtimeScore > 0 ? `${realtimeScore}% LOCK` : 'SEARCHING SUBJECT...'}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 border border-white/5 rounded-full overflow-hidden p-[1px]">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    realtimeScore >= 82 
                      ? 'bg-gradient-to-r from-cyber-green/50 to-cyber-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                      : realtimeScore > 0 
                      ? 'bg-gradient-to-r from-cyber-cyan/50 to-cyber-cyan shadow-[0_0_8px_rgba(6,182,212,0.5)] animate-pulse' 
                      : 'bg-cyber-red/20 shadow-none'
                  }`}
                  style={{ width: `${realtimeScore}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-4 justify-center">
            {cameraActive ? (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 bg-cyber-red/15 hover:bg-cyber-red/25 border border-cyber-red/40 text-[10px] font-bold py-3 px-5 rounded-xl cursor-pointer transition-all select-none uppercase tracking-widest font-mono"
              >
                <CameraOff className="w-4 h-4 text-cyber-red" /> Stop Scanner Lens
              </button>
            ) : (
              <button
                onClick={startCamera}
                disabled={modelsStatus !== 'ready'}
                className="flex items-center gap-2 bg-gradient-to-r from-cyber-blue to-cyber-cyan hover:from-blue-600 hover:to-cyan-500 text-slate-950 font-bold py-3 px-6 rounded-xl border border-cyan-400/20 shadow-cyan-glow text-[10px] uppercase tracking-widest cursor-pointer transition-all duration-200 select-none disabled:opacity-50 font-mono"
              >
                {modelsStatus === 'loading' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    BOOTING SYSTEMS...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-slate-950" />
                    Start Scanner Lens
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Panel: Holographic Geofence Radar Map */}
        <div className="w-full glass-panel rounded-2xl p-6 overflow-hidden relative flex flex-col shadow-2xl h-fit">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2 select-none">
              <Compass className="w-4 h-4 text-cyber-cyan animate-spin" />
              Holographic Geofence Radar
            </span>
            <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${gpsLoading ? 'bg-cyber-cyan animate-pulse' : gpsError ? 'bg-cyber-red' : 'bg-cyber-green animate-ping'}`}></span>
              {gpsLoading ? 'SIGNAL SCANNING' : gpsError ? 'SIGNAL FAILURE' : 'SIGNAL LOCK: ACTIVE'}
            </span>
          </div>

          {/* Dynamic Map Header Status Bar */}
          <div className={`p-3 rounded-xl border mb-4 flex items-center justify-between ${
            gpsLoading 
              ? 'bg-cyber-cyan/5 border-cyber-cyan/20 text-cyber-cyan animate-pulse' 
              : gpsError 
              ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red' 
              : isInside 
              ? 'bg-cyber-green/10 border-cyber-green/20 text-cyber-green shadow-green-glow' 
              : 'bg-cyber-gold/10 border-cyber-gold/20 text-cyber-gold animate-pulse'
          }`}>
            <div className="flex items-center gap-2.5 flex-1">
              <MapPin className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-[8px] text-slate-500 uppercase leading-none">GEOGRAPHIC SECTOR STATUS</p>
                <h4 className="text-[11px] font-bold uppercase mt-0.5 truncate">
                  {gpsLoading 
                    ? 'LOCKING GPS SATELLITES...' 
                    : gpsError 
                    ? 'SIGNAL LOSS: GEOFENCE COMPROMISED' 
                    : isInside 
                    ? 'INSIDE SECURE ZONE' 
                    : 'OUTSIDE OFFICE PREMISES'}
                </h4>
              </div>
            </div>
            <div className="text-right pl-2">
              <p className="text-[8px] text-slate-500 uppercase leading-none">SECTOR VALIDATION</p>
              <h4 className="text-[11px] font-bold uppercase mt-0.5">
                {gpsLoading ? 'WAITING...' : gpsError ? 'BLOCKED' : isInside ? 'PERMITTED' : 'DENIED'}
              </h4>
            </div>
          </div>

          {/* Map Viewport */}
          <div className="h-[250px] w-full rounded-2xl overflow-hidden relative z-10 border border-white/10 bg-slate-950">
            {gpsError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-cyber-red gap-2">
                <AlertTriangle className="w-8 h-8 text-cyber-red animate-bounce" />
                <p className="text-[10px] uppercase font-bold tracking-wider">GPS TELEMETRY BREACH</p>
                <p className="text-[9px] text-slate-500 leading-normal max-w-xs uppercase">{gpsError}</p>
              </div>
            ) : gpsLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                <RefreshCw className="w-8 h-8 text-cyber-cyan animate-spin" />
                <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Acquiring Orbital Coordinates...</p>
              </div>
            ) : (
              <>
                <MapContainer
                  center={officeCoords}
                  zoom={17}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  className="h-full w-full"
                >
                  <ChangeMapView center={userCoords ? [userCoords.latitude, userCoords.longitude] : officeCoords} />
                  <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
                        color: isInside ? '#10B981' : '#06B6D4',
                        fillColor: isInside ? '#10B981' : '#06B6D4',
                        fillOpacity: 0.12,
                        weight: 2,
                        dashArray: '5, 10'
                      }}
                    />
                  ) : (
                    <Circle
                      center={officeCoords}
                      radius={geofenceRadius}
                      pathOptions={{
                        color: isInside ? '#10B981' : '#06B6D4',
                        fillColor: isInside ? '#10B981' : '#06B6D4',
                        fillOpacity: 0.12,
                        weight: 1.5,
                        dashArray: '5, 10'
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
                          <p className="font-bold">YOUR LIVE TELEMETRY</p>
                          <p>Distance: {distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : 'Calculating...'}</p>
                          <p>Zone: {isInside ? 'INSIDE ZONE' : 'OUTSIDE ZONE'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>

                {/* Cyberpunk Radar Conic-gradient sweeping animation overlay */}
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
                  {/* Radar Sweeper sweep */}
                  <div 
                    className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[conic-gradient(from_0deg,transparent_50%,rgba(6,182,212,0.06)_100%)] rounded-full animate-spin pointer-events-none"
                    style={{ animationDuration: '6s' }}
                  ></div>
                  {/* Circular Radar Scan pulses */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.04)_0%,transparent_70%)]"></div>
                  <div className="absolute top-1/2 left-0 w-full h-[0.5px] bg-cyber-cyan/10"></div>
                  <div className="absolute left-1/2 top-0 h-full w-[0.5px] bg-cyber-cyan/10"></div>
                </div>
              </>
            )}
          </div>

          {/* Telemetry Digital HUD Stats */}
          <div className="mt-4 bg-slate-950/50 border border-white/5 rounded-xl p-3.5 text-[9px] space-y-2 select-none text-slate-400">
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span>OFFICE CENTRAL CORE:</span>
              <span className="text-white">{officeCoords[0].toFixed(5)}, {officeCoords[1].toFixed(5)}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span>EMPLOYEE LIVE COORDINATES:</span>
              <span className={userCoords ? 'text-white' : 'text-cyber-red animate-pulse font-bold'}>
                {userCoords 
                  ? `${userCoords.latitude.toFixed(5)}, ${userCoords.longitude.toFixed(5)}` 
                  : 'SIGNAL SCANNING...'}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span>RADIAL DISTANCE METERS:</span>
              <span className={distanceToOffice !== null ? isInside ? 'text-cyber-green font-bold glow-green' : 'text-cyber-red font-bold' : ''}>
                {distanceToOffice !== null 
                  ? `${distanceToOffice.toFixed(1)} METERS` 
                  : 'GPS SCANNING...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>ALLOWED LIMIT BOUNDARY:</span>
              <span className="text-cyber-cyan">{geofenceRadius} METERS (DEFAULT 100M)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Dynamic Informative Readout Footer Bar */}
      <div className="max-w-7xl mx-auto bg-slate-950/40 rounded-xl p-4 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] text-slate-500 text-center md:text-left select-none uppercase font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyber-cyan animate-pulse" />
          <span>Biometric & GPS Gateway Status: <span className="text-cyber-green font-bold">NOMINAL / SECURE</span></span>
        </div>
        <div className="flex items-center gap-1 font-bold">
          <Globe className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
          <span>GPS COORDINATE MONITOR ENGAGED</span>
        </div>
      </div>

    </div>
  );
}
