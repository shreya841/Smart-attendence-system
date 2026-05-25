import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { apiCall } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  MapPin, 
  AlertOctagon, 
  Clock, 
  Activity, 
  Database,
  Radio,
  Fingerprint,
  TrendingUp,
  Map,
  ShieldAlert
} from 'lucide-react';

// Helper to parse and render JSON telemetry details in a stunning, sci-fi layout
const renderTelemetryDetails = (details) => {
  if (!details) return <span className="text-slate-600 uppercase font-mono tracking-wider text-[8px]">NO LOG telemetry</span>;
  
  let parsed = null;
  try {
    if (typeof details === 'object') {
      parsed = details;
    } else {
      parsed = JSON.parse(details);
    }
  } catch (e) {
    return <span className="text-slate-400 uppercase font-mono tracking-wider">{details}</span>;
  }

  if (parsed && typeof parsed === 'object') {
    const coords = parsed.coordinates;
    const confidence = parsed.face_confidence;
    const geofence = parsed.geofence_status;
    const statusText = parsed.status_text;

    return (
      <div className="flex flex-wrap gap-1.5 items-center text-[10px]">
        {statusText && (
          <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-slate-300 font-bold uppercase text-[9px] font-mono tracking-wide">
            {statusText}
          </span>
        )}
        {confidence !== undefined && (
          <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[9px] tracking-wide ${
            confidence >= 0.82 
              ? 'bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-glow-green' 
              : 'bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-glow-cyan'
          }`}>
            LOCK: {Math.round(confidence * 100)}%
          </span>
        )}
        {geofence && (
          <span className="px-2 py-0.5 rounded-md bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue font-bold uppercase text-[9px] font-mono tracking-wide">
            {geofence}
          </span>
        )}
        {coords && coords.latitude !== undefined && coords.longitude !== undefined && (
          <span className="px-2 py-0.5 rounded-md bg-slate-950/40 border border-white/5 text-[8px] text-slate-500 font-mono tracking-wider">
            {parseFloat(coords.latitude).toFixed(4)}N / {parseFloat(coords.longitude).toFixed(4)}E
          </span>
        )}
      </div>
    );
  }

  return <span className="text-slate-400 font-mono">{details}</span>;
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
  const mountedRef = React.useRef(true);

  // Fetch initial empty database stats
  useEffect(() => {
    mountedRef.current = true;
    if (!user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const fetchDashboardData = async () => {
      try {
        if (mountedRef.current) setLoading(true);
        const endpoint = user?.role === 'admin' ? '/logs' : '/logs/my-logs';
        const response = await apiCall(endpoint, 'GET');
        
        if (controller.signal.aborted || !mountedRef.current) return;

        if (response.success) {
          const fetchedLogs = response.logs || response.history || [];
          if (mountedRef.current) setLogs(fetchedLogs);

          if (user?.role === 'admin') {
            const employeesRes = await apiCall('/employees', 'GET');
            if (controller.signal.aborted || !mountedRef.current) return;
            const employeesList = employeesRes.employees || [];
            
            const active = employeesList.filter(e => e.status === 'Inside Office').length;
            const alerts = fetchedLogs.filter(l => l.event_type === 'SECURITY_ALERT' || l.event_type === 'UNAUTHORIZED_SCAN').length;
            
            if (mountedRef.current) setMetrics({
              activeEmployees: active,
              totalLogsCount: fetchedLogs.length,
              securityAlerts: alerts,
              averageHours: 0
            });
          } else {
            if (mountedRef.current) setMetrics({
              activeEmployees: 0,
              totalLogsCount: fetchedLogs.length,
              securityAlerts: 0,
              averageHours: 0
            });
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[DASHBOARD ERROR]: Failed to fetch operational logs:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [user]);

  // Real-time socket event listeners to feed the operational UI dynamically
  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      
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

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20 } }
  };

  return (
    <div className="space-y-8">
      {/* Upper Grid - Metrics telemetry slots */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {user?.role === 'admin' ? (
          <>
            {/* Active inside Office */}
            <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-[#06B6D4] opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">OFFICE PRESENT STATUS</p>
                  <h3 className="text-3xl font-bold text-white mt-2 font-mono text-glow-cyan">{metrics.activeEmployees}</h3>
                </div>
                <div className="p-3 bg-cyber-cyan/5 border border-cyber-cyan/15 rounded-xl text-cyber-cyan shadow-cyan-glow">
                  <Users className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[8px] font-mono text-slate-500 tracking-wider">
                <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-ping"></span>
                ACTIVE BIOMETRIC CONSOLE FEED
              </div>
            </motion.div>

            {/* Total System Events */}
            <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-[#3B82F6] opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">SYS TRANSACTION LOGS</p>
                  <h3 className="text-3xl font-bold text-white mt-2 font-mono text-glow-blue">{metrics.totalLogsCount}</h3>
                </div>
                <div className="p-3 bg-cyber-blue/5 border border-cyber-blue/15 rounded-xl text-cyber-blue">
                  <Database className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-4 text-[8px] font-mono text-slate-500 uppercase tracking-wider">
                SQLITE TRANSACTION LEDGER
              </div>
            </motion.div>

            {/* Security Alerts */}
            <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-[#EF4444] opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">SYS SECURITY ANOMALIES</p>
                  <h3 className={`text-3xl font-bold mt-2 font-mono ${metrics.securityAlerts > 0 ? 'text-cyber-red text-glow-red' : 'text-white'}`}>
                    {metrics.securityAlerts}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl border ${metrics.securityAlerts > 0 ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red shadow-red-glow' : 'bg-slate-900 border-white/5 text-slate-500'}`}>
                  <AlertOctagon className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-4 text-[8px] font-mono text-slate-500 uppercase tracking-wider">
                REALTIME BIOMETRIC ATTACK SHIELDS
              </div>
            </motion.div>

            {/* Avg Hours */}
            <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-slate-500 opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">CALCULATED WORK SHIFTS</p>
                  <h3 className="text-3xl font-bold text-white mt-2 font-mono">-- <span className="text-xs font-normal text-slate-600">HRS</span></h3>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-slate-450">
                  <Clock className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-4 text-[8px] font-mono text-slate-500 uppercase tracking-wider">
                HISTORICAL ENCLAVE COMPILATION
              </div>
            </motion.div>
          </>
        ) : (
          <>
            {/* Employee stats card */}
            <motion.div variants={itemVariants} className="glass-card p-5 col-span-1 lg:col-span-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-[#06B6D4] opacity-50" />
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-[9px] font-mono font-bold tracking-widest text-cyber-cyan uppercase mb-1">BIOMETRIC USER DOSSIER</h4>
                  <p className="text-lg font-bold text-white uppercase tracking-wider mt-1.5 font-mono">SECURE KEY ENCLAVE</p>
                </div>
                <Fingerprint className="w-8 h-8 text-cyber-cyan opacity-20" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div>
                  <span className="text-[8px] font-mono text-slate-500 block uppercase tracking-widest">ASSIGNED UNIT</span>
                  <span className="text-[11px] text-slate-300 font-bold uppercase font-mono tracking-wide">{user?.department}</span>
                </div>
                <div>
                  <span className="text-[8px] font-mono text-slate-500 block uppercase tracking-widest">CLEARANCE ROLE</span>
                  <span className="text-[11px] text-slate-350 font-bold uppercase font-mono tracking-wider">{user?.role}</span>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-[#3B82F6] opacity-35" />
              <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">SYS SECURE TRIGGERS</p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono text-glow-blue">{metrics.totalLogsCount}</h3>
              <div className="mt-4 text-[8px] font-mono text-slate-500 uppercase tracking-wider">PERSONAL ACCESS POOL</div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-slate-600 opacity-30" />
              <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">LAST LOGGED EVENT</p>
              <h3 className="text-xs font-bold text-white mt-3.5 font-mono truncate uppercase tracking-wider">
                {logs[0] ? `${logs[0].event_type} (${new Date(logs[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'NO TRANSACTION'}
              </h3>
              <div className="mt-3.5 text-[8px] font-mono text-slate-500 uppercase tracking-wider">SENSOR NODE TELEMETRY</div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Main ledger list */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/20 to-transparent"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 bg-cyber-cyan rounded-full animate-pulse shadow-cyan-glow" />
            <h3 className="text-xs font-bold font-mono tracking-widest text-white uppercase">Realtime Operations Audit Ledger</h3>
          </div>
          <span className="text-[9px] font-mono text-slate-400 bg-[#090d16]/60 border border-white/5 px-3 py-1 rounded-lg uppercase tracking-wider">
            {connected ? 'LINK: ESTABLISHED' : 'LINK: ATTEMPTING'}
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-7 h-7 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[9px] font-mono text-slate-500 mt-4 tracking-widest uppercase animate-pulse">Synchronizing ledger matrices...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center justify-center">
            <Activity className="w-6 h-6 text-slate-700 mb-3" />
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">OPERATIONAL LEDGER VACANT</p>
            <p className="text-[9px] font-mono text-slate-600 mt-1 uppercase tracking-widest">Awaiting facial scans or telemetry pings to log activities.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 font-mono">
                  <th className="pb-3 font-bold uppercase tracking-widest text-[9px]">Timestamp</th>
                  <th className="pb-3 font-bold uppercase tracking-widest text-[9px]">Node ID</th>
                  <th className="pb-3 font-bold uppercase tracking-widest text-[9px]">Subject Identity</th>
                  <th className="pb-3 font-bold uppercase tracking-widest text-[9px]">Enclave Status</th>
                  <th className="pb-3 font-bold uppercase tracking-widest text-[9px]">Node Hub Location</th>
                  <th className="pb-3 font-bold uppercase tracking-widest text-[9px]">Sensor Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-slate-350 text-[11px]">
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <motion.tr 
                      key={log.id || log.timestamp}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="hover:bg-white/[0.01] transition-colors"
                    >
                      <td className="py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], { hourCycle: 'h23' })}
                      </td>
                      <td className="py-3.5 text-slate-400 font-semibold">{log.employee_id || 'SYS_GUEST'}</td>
                      <td className="py-3.5 font-sans text-slate-200 font-semibold uppercase tracking-wide text-[10px]">{log.employee_name || log.name || '---'}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border font-mono tracking-wider ${
                          log.event_type === 'CHECK_IN' || log.event_type === 'ENTER_GEOFENCE'
                            ? 'bg-cyber-cyan/10 border-cyber-cyan/20 text-cyber-cyan text-glow-cyan'
                            : log.event_type === 'CHECK_OUT' || log.event_type === 'EXIT_GEOFENCE'
                            ? 'bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue text-glow-blue'
                            : log.event_type === 'UNAUTHORIZED_SCAN' || log.event_type === 'SECURITY_ALERT' || log.event_type === 'SPOOF_ATTEMPT'
                            ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red text-glow-red animate-pulse'
                            : 'bg-white/5 border-white/10 text-slate-500'
                        }`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500 whitespace-nowrap">{log.location || 'Front Desk Camera'}</td>
                      <td className="py-3.5 text-slate-450 whitespace-nowrap">
                        {renderTelemetryDetails(log.details)}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
