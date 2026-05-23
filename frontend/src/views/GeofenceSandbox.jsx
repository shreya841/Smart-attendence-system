import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiCall } from '../services/api.js';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Compass, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

// Helper to dynamic pan/re-center Leaflet maps on coordinates state changes
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

// Setup beautiful custom pins so they don't break in standard Vite layouts
const officeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const employeeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function GeofenceSandbox() {
  const { user } = useAuth();
  
  // Dynamic settings state
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [officeCoords, setOfficeCoords] = useState([28.6139, 77.2090]);
  const [geofenceRadius, setGeofenceRadius] = useState(50); // meters

  // Current employee coordinates (Draggable)
  const [empCoords, setEmpCoords] = useState([28.6142, 77.2093]);
  const [telemetry, setTelemetry] = useState({
    distance: 0,
    status: 'Outside Office',
    transition: null
  });
  const [updating, setUpdating] = useState(false);
  const markerRef = useRef(null);

  // Syncs and updates coordinate updates with backend REST services
  const syncCoordinates = async (lat, lng) => {
    if (!user) return;
    setUpdating(true);
    try {
      const response = await apiCall(`/employees/${user?.id}/coordinates`, 'POST', {
        latitude: lat,
        longitude: lng
      });

      if (response.success) {
        setTelemetry({
          distance: response.data.distance,
          status: response.data.status,
          transition: response.data.transition
        });
      }
    } catch (err) {
      console.error('[GEOFENCE SYNC ERROR]: Failed updating GPS metrics:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Run initial sync and load settings from database
  useEffect(() => {
    if (!user) return;
    const initSandbox = async () => {
      try {
        const response = await apiCall('/settings', 'GET');
        let lat = 28.6139;
        let lng = 77.2090;
        let radius = 50;
        if (response.success && response.settings) {
          lat = response.settings.geofence_lat || 28.6139;
          lng = response.settings.geofence_lng || 77.2090;
          radius = response.settings.geofence_radius || 50;
          setOfficeCoords([lat, lng]);
          setGeofenceRadius(radius);
        }
        const initialEmp = [lat + 0.0003, lng + 0.0003];
        setEmpCoords(initialEmp);
        await syncCoordinates(initialEmp[0], initialEmp[1]);
      } catch (err) {
        console.error('[SETTINGS FETCH ERROR]:', err);
      } finally {
        setLoadingSettings(false);
      }
    };
    initSandbox();
  }, [user]);

  // Drag handler for leaflet marker
  const handleMarkerDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const { lat, lng } = marker.getLatLng();
      const newCoords = [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))];
      setEmpCoords(newCoords);
      syncCoordinates(newCoords[0], newCoords[1]);
    }
  };

  // Teleport Helpers to test boundary checks instantly
  const teleportInside = () => {
    const insideCoords = [officeCoords[0] + 0.00002, officeCoords[1] + 0.00002]; // Very close to center
    setEmpCoords(insideCoords);
    syncCoordinates(insideCoords[0], insideCoords[1]);
  };

  const teleportOutside = () => {
    const outsideCoords = [officeCoords[0] + 0.0016, officeCoords[1] + 0.002]; // Way out
    setEmpCoords(outsideCoords);
    syncCoordinates(outsideCoords[0], outsideCoords[1]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Interactive Map Visual Panel */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-panel rounded-2xl p-4 overflow-hidden relative flex flex-col">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <span className="text-xs font-mono font-bold tracking-widest text-white uppercase flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyber-cyan animate-spin" />
              Dynamic Orbital Geofence Mapper (Leaflet Sandbox)
            </span>
            <span className="text-[9px] font-mono text-slate-500 uppercase">Interactive Draggable Enclave</span>
          </div>

          {/* Leaflet map container */}
          <div className="h-[400px] w-full rounded-2xl overflow-hidden relative z-10 border border-white/10">
            {loadingSettings ? (
              <div className="h-full w-full flex items-center justify-center bg-slate-950/40 text-slate-400 font-mono text-xs uppercase">
                Loading Office Location Settings...
              </div>
            ) : (
              <MapContainer
                center={officeCoords}
                zoom={17}
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                <ChangeMapView center={officeCoords} />
                {/* Modern Cyber Dark Map Tiles */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Glowing Neon Geofence Circle Boundary */}
                <Circle
                  center={officeCoords}
                  radius={geofenceRadius}
                  pathOptions={{
                    color: telemetry.status === 'Inside Office' ? '#10B981' : '#06B6D4',
                    fillColor: telemetry.status === 'Inside Office' ? '#10B981' : '#06B6D4',
                    fillOpacity: 0.12,
                    weight: 2,
                    dashArray: '5, 10'
                  }}
                />

                {/* Central Office Hub Marker */}
                <Marker position={officeCoords} icon={officeIcon}>
                  <Popup>
                    <div className="font-mono text-xs text-slate-900 leading-normal">
                      <p className="font-bold">Headquarters Enclave</p>
                      <p className="text-[10px]">Radius Threshold: {geofenceRadius}m</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Draggable Employee Position Pin */}
                <Marker
                  position={empCoords}
                  draggable={true}
                  eventHandlers={{ dragend: handleMarkerDragEnd }}
                  ref={markerRef}
                  icon={employeeIcon}
                >
                  <Popup>
                    <div className="font-mono text-xs text-slate-900 leading-normal">
                      <p className="font-bold">Your Location Pin</p>
                      <p className="text-[10px]">DRAG PIN TO SIMULATE WALKING</p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            )}
          </div>
          
          <div className="mt-3 text-[10px] font-mono text-slate-500 flex items-center gap-1.5 uppercase leading-normal">
            <HelpCircle className="w-3.5 h-3.5" />
            Click and drag the RED pin on the map to simulate real-time employee movements and check geofence calculations.
          </div>
        </div>
      </div>

      {/* Geofence Telemetry Stats Panel */}
      <div className="space-y-4">
        {/* Real-time coordinates telemetry readout */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/30 to-transparent"></div>
          <h3 className="text-sm font-bold font-mono tracking-widest text-white uppercase mb-4 flex items-center gap-2">
            🛰️ Geofence Coordinates Telemetry
          </h3>

          <div className="space-y-4">
            {/* Status read-out box */}
            <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
              telemetry.status === 'Inside Office' 
                ? 'bg-cyber-green/10 border-cyber-green/20 text-cyber-green shadow-green-glow'
                : 'bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue'
            }`}>
              <div className="p-2 bg-black/20 rounded-lg">
                <MapPin className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">CURRENT GEOGRAPHIC STATE</p>
                <h4 className="text-sm font-bold uppercase tracking-wider mt-1">{telemetry.status}</h4>
              </div>
            </div>

            {/* Calculations layout list */}
            <div className="border-t border-white/5 pt-4 space-y-3 text-[11px] font-mono text-slate-400">
              <div className="flex justify-between">
                <span>RADIAL RADIUS METERS:</span>
                <span className="text-white font-bold">{telemetry.distance.toFixed(1)}m / {geofenceRadius.toFixed(1)}m</span>
              </div>
              <div className="flex justify-between">
                <span>COORDINATES ACCURACY:</span>
                <span className="text-slate-300">GPS STABLE</span>
              </div>
              <div className="flex justify-between">
                <span>LATITUDE RAW:</span>
                <span className="text-slate-300">{empCoords[0]}</span>
              </div>
              <div className="flex justify-between">
                <span>LONGITUDE RAW:</span>
                <span className="text-slate-300">{empCoords[1]}</span>
              </div>
            </div>

            {/* Teleport simulation triggers */}
            <div className="border-t border-white/5 pt-4 space-y-2">
              <span className="block text-[10px] font-mono text-slate-500 uppercase mb-2">Simulate Boundary Jumps</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={teleportInside}
                  disabled={updating}
                  className="bg-cyber-green/10 hover:bg-cyber-green/20 border border-cyber-green/20 text-cyber-green text-xs font-bold py-2.5 px-3 rounded-lg uppercase tracking-wider"
                >
                  Jump Inside
                </button>
                <button
                  onClick={teleportOutside}
                  disabled={updating}
                  className="bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/20 text-cyber-cyan text-xs font-bold py-2.5 px-3 rounded-lg uppercase tracking-wider"
                >
                  Jump Outside
                </button>
              </div>
            </div>

            {/* Manual Coordinates Editor */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">Manually Edit GPS Coordinates</span>
              
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-[8px] text-slate-500 uppercase mb-1">LATITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={empCoords[0]}
                    onChange={(e) => {
                      const lat = parseFloat(e.target.value) || 0;
                      const newCoords = [lat, empCoords[1]];
                      setEmpCoords(newCoords);
                      syncCoordinates(newCoords[0], newCoords[1]);
                    }}
                    className="w-full glass-input py-1.5 px-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8px] text-slate-500 uppercase mb-1">LONGITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={empCoords[1]}
                    onChange={(e) => {
                      const lng = parseFloat(e.target.value) || 0;
                      const newCoords = [empCoords[0], lng];
                      setEmpCoords(newCoords);
                      syncCoordinates(newCoords[0], newCoords[1]);
                    }}
                    className="w-full glass-input py-1.5 px-2.5 text-xs text-white"
                  />
                </div>
              </div>
              <p className="text-[8px] text-cyan-400 uppercase leading-normal">
                ⚡ Type coordinates above to teleport the map pin and recalculate the geofence instantly!
              </p>
            </div>
          </div>
        </div>

        {/* Transition status logger notifications */}
        {telemetry.transition && (
          <div className="glass-panel rounded-2xl p-5 border border-cyber-green/20 bg-cyber-green/5 relative overflow-hidden animate-slide-in">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-cyber-green shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h5 className="text-xs font-bold text-cyber-green uppercase tracking-wider">GEOFENCE AUTOMATED LOG EVENT</h5>
                <p className="text-[10.5px] text-slate-300 mt-1 leading-normal uppercase">
                  Subject triggered boundary shift: <span className="font-bold text-white">{telemetry.transition}</span>
                </p>
                <p className="text-[9px] text-slate-500 mt-1 uppercase">LOGGED AUTOMATICALLY TO OPERATIONS LEDGER DATABASE</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
