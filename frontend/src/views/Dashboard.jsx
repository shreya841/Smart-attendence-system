import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { apiCall } from '../services/api.js';
import { 
  Users, 
  MapPin, 
  AlertOctagon, 
  Clock, 
  Activity, 
  UserCheck, 
  Database,
  Radio
} from 'lucide-react';

// Helper to parse and render JSON telemetry details in a stunning, sci-fi layout
const renderTelemetryDetails = (details) => {
  if (!details) return <span className="text-slate-600">SENSOR TELEMETRY CLEAR</span>;
  
  let parsed = null;
  try {
    if (typeof details === 'object') {
      parsed = details;
    } else {
      parsed = JSON.parse(details);
    }
  } catch (e) {
    return <span className="text-slate-500 uppercase">{details}</span>;
  }

  if (parsed && typeof parsed === 'object') {
    const coords = parsed.coordinates;
    const confidence = parsed.face_confidence;
    const geofence = parsed.geofence_status;
    const statusText = parsed.status_text;

    return (
      <div className="flex flex-wrap gap-1.5 items-center text-[10px]">
        {statusText && (
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300 font-bold uppercase">
            {statusText}
          </span>
        )}
        {confidence !== undefined && (
          <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
            confidence >= 0.82 
              ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green' 
              : 'bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan'
          }`}>
            🎯 {Math.round(confidence * 100)}% LOCK
          </span>
        )}
        {geofence && (
          <span className="px-1.5 py-0.5 rounded bg-cyber-cyan/5 border border-cyber-cyan/15 text-cyber-cyan font-bold uppercase">
            📍 {geofence}
          </span>
        )}
        {coords && coords.latitude !== undefined && coords.longitude !== undefined && (
          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/5 text-[9px] text-slate-500 font-mono">
            {parseFloat(coords.latitude).toFixed(4)}, {parseFloat(coords.longitude).toFixed(4)}
          </span>
        )}
      </div>
    );
  }

  return <span className="text-slate-400">{details}</span>;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [metrics, setMetrics] = useState({
    activeEmployees: 0,
    totalLogsCount: 0,
    securityAlerts: 0,
    averageHours: 0
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial empty database stats
  useEffect(() => {
    if (!user) return;
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch all system logs if admin, or my-logs if employee
        const endpoint = user?.role === 'admin' ? '/logs' : '/logs/my-logs';
        const response = await apiCall(endpoint, 'GET');
        
        if (response.success) {
          const fetchedLogs = response.logs || response.history || [];
          setLogs(fetchedLogs);

          // Build authentic metrics from real database rows
          if (user?.role === 'admin') {
            const employeesRes = await apiCall('/employees', 'GET');
            const employeesList = employeesRes.employees || [];
            
            const active = employeesList.filter(e => e.status === 'Inside Office').length;
            const alerts = fetchedLogs.filter(l => l.event_type === 'SECURITY_ALERT' || l.event_type === 'UNAUTHORIZED_SCAN').length;
            
            setMetrics({
              activeEmployees: active,
              totalLogsCount: fetchedLogs.length,
              securityAlerts: alerts,
              averageHours: 0 // Empty realistic state
            });
          } else {
            setMetrics({
              activeEmployees: 0, // Not applicable for standard employees
              totalLogsCount: fetchedLogs.length,
              securityAlerts: 0,
              averageHours: 0
            });
          }
        }
      } catch (err) {
        console.error('[DASHBOARD ERROR]: Failed to fetch operational logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Real-time socket event listeners to feed the empty operational UI dynamically
  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      
      // Dynamically increment real metrics counters
      setMetrics(prev => {
        const update = { ...prev, totalLogsCount: prev.totalLogsCount + 1 };
        if (newLog.event_type === 'ENTER_GEOFENCE' || newLog.event_type === 'CHECK_IN') {
          update.activeEmployees = prev.activeEmployees + 1;
        } else if (newLog.event_type === 'EXIT_GEOFENCE' || newLog.event_type === 'CHECK_OUT') {
          update.activeEmployees = Math.max(0, prev.activeEmployees - 1);
        }
        return update;
      });
    };

    const handleUnauthorizedAlert = (alert) => {
      setMetrics(prev => ({ ...prev, securityAlerts: prev.securityAlerts + 1 }));
      setLogs(prev => [
        {
          id: Date.now(),
          employee_id: 'UNKNOWN',
          employee_name: 'Unauthorized Person',
          event_type: 'UNAUTHORIZED_SCAN',
          timestamp: alert.timestamp,
          location: alert.location,
          details: { face_confidence: alert.confidence, status_text: 'Unauthorized Scan' }
        },
        ...prev
      ].slice(0, 50));
    };

    socket.on('logs:new', handleNewLog);
    socket.on('unauthorized:alert', handleUnauthorizedAlert);

    return () => {
      socket.off('logs:new', handleNewLog);
      socket.off('unauthorized:alert', handleUnauthorizedAlert);
    };
  }, [socket]);

  return (
    <div className="space-y-6">
      {/* Upper Grid - Metrics telemetry slots (Empty/Realistic states) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {user?.role === 'admin' ? (
          <>
            {/* Active inside Office */}
            <div className="glass-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Active Inside Office</p>
                  <h3 className="text-3xl font-bold text-white mt-2 font-mono glow-cyan">{metrics.activeEmployees}</h3>
                </div>
                <div className="p-3 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-xl text-cyber-cyan">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-ping"></span>
                LIVE SENSOR FEED
              </div>
            </div>

            {/* Total System Events */}
            <div className="glass-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Operational Logs</p>
                  <h3 className="text-3xl font-bold text-white mt-2 font-mono">{metrics.totalLogsCount}</h3>
                </div>
                <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/20 rounded-xl text-cyber-blue">
                  <Database className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-[10px] font-mono text-slate-500 uppercase">
                SQLite Ledger Database
              </div>
            </div>

            {/* Security Alerts */}
            <div className="glass-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Biometric Anomaly Flags</p>
                  <h3 className={`text-3xl font-bold mt-2 font-mono ${metrics.securityAlerts > 0 ? 'text-cyber-red glow-red' : 'text-white'}`}>
                    {metrics.securityAlerts}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl border ${metrics.securityAlerts > 0 ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red' : 'bg-slate-800 border-white/5 text-slate-400'}`}>
                  <AlertOctagon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-[10px] font-mono text-slate-500 uppercase">
                Anti-Spoof Triggers
              </div>
            </div>

            {/* Avg Hours */}
            <div className="glass-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Average Shift Duration</p>
                  <h3 className="text-3xl font-bold text-white mt-2 font-mono">-- <span className="text-sm font-normal text-slate-500">hrs</span></h3>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-[10px] font-mono text-slate-500 uppercase">
                Realistic Shift metrics
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Employee stats card */}
            <div className="glass-card p-5 col-span-2">
              <h4 className="text-xs font-mono font-bold tracking-widest text-cyber-cyan uppercase mb-1">Corporate Profile Status</h4>
              <p className="text-2xl font-bold text-white font-sans mt-2">Active Authorization Enclave</p>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div>
                  <span className="text-[9px] font-mono text-slate-500 block uppercase">Department Enclave</span>
                  <span className="text-xs text-slate-300 font-semibold">{user?.department}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-slate-500 block uppercase">Auth Role</span>
                  <span className="text-xs text-slate-300 font-semibold uppercase">{user?.role}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Logged Activity Triggers</p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono">{metrics.totalLogsCount}</h3>
              <div className="mt-4 text-[10px] font-mono text-slate-500 uppercase">Personal Log Pool</div>
            </div>

            <div className="glass-card p-5">
              <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Last Logged Action</p>
              <h3 className="text-sm font-semibold text-white mt-3.5 font-mono truncate">
                {logs[0] ? `${logs[0].event_type} (${new Date(logs[0].timestamp).toLocaleTimeString()})` : 'No logs recorded.'}
              </h3>
              <div className="mt-3 text-[10px] font-mono text-slate-500 uppercase">Telemetry state</div>
            </div>
          </>
        )}
      </div>

      {/* Main ledger list (Real SQLite Logs / Socket logs stream) */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/30 to-transparent"></div>
        
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyber-cyan animate-pulse" />
            <h3 className="text-sm font-bold font-mono tracking-widest text-white uppercase">Real-time Operations Activity Ledger</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full uppercase">
            {connected ? 'SOCKET LINK ACTIVE' : 'SOCKET SYNCHRONIZING'}
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-mono text-slate-500 mt-4 animate-pulse">POLLING DATABASE VECTOR STREAMS...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <Activity className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-xs font-mono text-slate-500 uppercase">Ledger is Empty</p>
            <p className="text-[10px] font-mono text-slate-600 mt-1 uppercase">Perform webcam face scans or geofence tracking to generate logs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 font-mono">
                  <th className="pb-3 font-bold uppercase tracking-wider">Timestamp</th>
                  <th className="pb-3 font-bold uppercase tracking-wider">Employee ID</th>
                  <th className="pb-3 font-bold uppercase tracking-wider">Name</th>
                  <th className="pb-3 font-bold uppercase tracking-wider">Enclave Action</th>
                  <th className="pb-3 font-bold uppercase tracking-wider">Sensor Coordinates / Hub</th>
                  <th className="pb-3 font-bold uppercase tracking-wider">Telemetry Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id || log.timestamp} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 text-slate-400 font-semibold">{log.employee_id || 'UNKNOWN'}</td>
                    <td className="py-3 font-sans text-slate-200 font-semibold">{log.employee_name || log.name || '---'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        log.event_type === 'CHECK_IN' || log.event_type === 'ENTER_GEOFENCE'
                          ? 'bg-cyber-cyan/10 border-cyber-cyan/20 text-cyber-cyan'
                          : log.event_type === 'CHECK_OUT' || log.event_type === 'EXIT_GEOFENCE'
                          ? 'bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue'
                          : log.event_type === 'UNAUTHORIZED_SCAN' || log.event_type === 'SECURITY_ALERT'
                          ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red animate-pulse'
                          : 'bg-white/5 border-white/10 text-slate-400'
                      }`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">{log.location || 'Front Desk Camera'}</td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {renderTelemetryDetails(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
