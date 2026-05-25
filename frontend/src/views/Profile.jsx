import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiCall } from '../services/api.js';
import { motion } from 'framer-motion';
import { 
  User, 
  Clock, 
  Calendar, 
  MapPin, 
  FileText,
  Activity,
  Fingerprint,
  Shield,
  Map
} from 'lucide-react';

const formatTimeStr = (t) => {
  if (!t) return '---';
  if (typeof t === 'string' && t.includes(':') && !t.includes('T') && !t.includes('-')) {
    return t;
  }
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return t;
  }
};

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchProfileData = async () => {
      try {
        if (isMounted) setLoading(true);
        const profRes = await apiCall(`/employees/${user?.id}`, 'GET');
        if (profRes.success && isMounted) {
          setProfile(profRes.employee);
        }

        const histRes = await apiCall(`/attendance/history/${user?.id}`, 'GET');
        if (histRes.success && isMounted) {
          setHistory(histRes.history);
        }
      } catch (err) {
        console.error('[PROFILE ERROR]: Failed fetching user metadata:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfileData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      {/* Profile Enclave details card */}
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden text-center flex flex-col items-center group">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          {/* Avatar sphere */}
          <div className="relative mt-4">
            <div className="absolute -inset-1 rounded-full border border-cyber-cyan/20 animate-pulse"></div>
            <div className="w-20 h-20 rounded-full bg-[#070b19] border border-white/10 flex items-center justify-center font-mono font-bold text-cyber-cyan text-xl shadow-cyan-glow select-none">
              {(user?.name || '').slice(0, 2).toUpperCase()}
            </div>
          </div>
          
          <h3 className="text-sm font-bold text-white mt-4 font-mono uppercase tracking-wider">{profile?.name || user?.name}</h3>
          <p className="text-[9px] font-mono tracking-widest text-slate-500 uppercase mt-1">NODE_ID: {profile?.id}</p>

          <div className="w-full border-t border-white/5 mt-6 pt-5 text-left font-mono text-[10px] space-y-3 text-slate-500">
            <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
              <span>EMAIL ADDRESS:</span>
              <span className="text-slate-300 font-semibold">{profile?.email}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
              <span>DEPARTMENT:</span>
              <span className="text-slate-350 font-bold uppercase">{profile?.department}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
              <span>SECURITY CLEARANCE:</span>
              <span className="text-cyber-cyan font-bold uppercase text-glow-cyan flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {profile?.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span>RADIAL POSITION:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[8px] tracking-wider border ${
                profile?.status === 'Inside Office' 
                  ? 'bg-cyber-green/10 border-cyber-green/20 text-cyber-green text-glow-green' 
                  : 'bg-slate-900 border-white/5 text-slate-500'
              }`}>
                {profile?.status ? profile.status.toUpperCase() : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History Ledger */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/20 to-transparent"></div>

          <h3 className="text-xs font-bold font-mono tracking-widest text-white uppercase mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-cyan animate-pulse" /> Personal Attendance Ledger
          </h3>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center">
              <div className="w-7 h-7 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center justify-center font-mono">
              <Calendar className="w-6 h-6 text-slate-700 mb-3" />
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">PERSONAL LEDGER EMPTY</p>
              <p className="text-[9px] text-slate-650 mt-1 uppercase tracking-wider">Awaiting punches to populate user logs feed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 font-mono text-[9px] tracking-widest">
                    <th className="pb-3 font-bold uppercase">Date</th>
                    <th className="pb-3 font-bold uppercase">Check-in</th>
                    <th className="pb-3 font-bold uppercase">Check-out</th>
                    <th className="pb-3 font-bold uppercase">Shift Hours</th>
                    <th className="pb-3 font-bold uppercase">Punch status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-350 text-[11px]">
                  {history.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 text-slate-400 font-semibold">{rec.date}</td>
                      <td className="py-3.5 text-slate-300">
                        {formatTimeStr(rec.check_in)}
                      </td>
                      <td className="py-3.5 text-slate-300">
                        {formatTimeStr(rec.check_out)}
                      </td>
                      <td className="py-3.5 text-white font-bold">
                        {(rec.working_hours !== null && rec.working_hours !== undefined) ? Number(rec.working_hours).toFixed(2) : '0.00'}h
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border tracking-wider uppercase ${
                          rec.status === 'On Time' 
                            ? 'bg-cyber-green/10 border-cyber-green/20 text-cyber-green text-glow-green'
                            : rec.status === 'Late Arrival'
                            ? 'bg-cyber-gold/10 border-cyber-gold/20 text-cyber-gold'
                            : rec.status === 'Early Exit'
                            ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red'
                            : 'bg-white/5 border-white/10 text-slate-500'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
