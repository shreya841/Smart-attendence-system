import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiCall } from '../services/api.js';
import { 
  User, 
  Clock, 
  Calendar, 
  MapPin, 
  FileText,
  Activity
} from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        // Fetch full profile details
        const profRes = await apiCall(`/employees/${user?.id}`, 'GET');
        if (profRes.success) {
          setProfile(profRes.employee);
        }

        // Fetch attendance logs for history list
        const histRes = await apiCall(`/attendance/history/${user?.id}`, 'GET');
        if (histRes.success) {
          setHistory(histRes.history);
        }
      } catch (err) {
        console.error('[PROFILE ERROR]: Failed fetching user metadata:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Profile Enclave details card */}
      <div className="space-y-4">
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden text-center flex flex-col items-center">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          
          {/* Avatar sphere */}
          <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-cyber-cyan/30 flex items-center justify-center font-bold text-cyber-cyan text-2xl shadow-cyan-glow mt-4 select-none">
            {(user?.name || '').slice(0, 2).toUpperCase()}
          </div>
          
          <h3 className="text-md font-bold text-white mt-4">{profile?.name || user?.name}</h3>
          <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mt-1">ID: {profile?.id}</p>

          <div className="w-full border-t border-white/5 mt-5 pt-4 text-left font-mono text-[11px] space-y-2.5 text-slate-400">
            <div className="flex justify-between">
              <span>EMAIL ADDRESS:</span>
              <span className="text-slate-300 font-semibold">{profile?.email}</span>
            </div>
            <div className="flex justify-between">
              <span>DEPARTMENT:</span>
              <span className="text-slate-300 font-semibold">{profile?.department}</span>
            </div>
            <div className="flex justify-between">
              <span>ACCESS ROLE:</span>
              <span className="text-cyber-cyan font-bold uppercase">{profile?.role}</span>
            </div>
            <div className="flex justify-between">
              <span>RADIAL POSITION:</span>
              <span className={`font-bold ${profile?.status === 'Inside Office' ? 'text-cyber-green' : 'text-slate-500'}`}>
                {profile?.status || 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History Ledger */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/30 to-transparent"></div>

          <h3 className="text-sm font-bold font-mono tracking-widest text-white uppercase mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-cyan animate-pulse" /> Personal Attendance Ledger
          </h3>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center font-mono">
              <Calendar className="w-8 h-8 text-slate-700 mb-3" />
              <p className="text-xs text-slate-500 uppercase">Ledger is Empty</p>
              <p className="text-[10px] text-slate-600 mt-1 uppercase">No records generated for your ID yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 font-mono">
                    <th className="pb-3 font-bold uppercase tracking-wider">Date</th>
                    <th className="pb-3 font-bold uppercase tracking-wider">Check-in</th>
                    <th className="pb-3 font-bold uppercase tracking-wider">Check-out</th>
                    <th className="pb-3 font-bold uppercase tracking-wider">Hours Worked</th>
                    <th className="pb-3 font-bold uppercase tracking-wider">Shift Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                  {history.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 text-slate-400 font-semibold">{rec.date}</td>
                      <td className="py-3.5 text-slate-300">
                        {rec.check_in ? new Date(rec.check_in).toLocaleTimeString() : '---'}
                      </td>
                      <td className="py-3.5 text-slate-300">
                        {rec.check_out ? new Date(rec.check_out).toLocaleTimeString() : '---'}
                      </td>
                      <td className="py-3.5 text-white font-bold">{rec.working_hours.toFixed(2)}h</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          rec.status === 'On Time' 
                            ? 'bg-cyber-green/10 border-cyber-green/20 text-cyber-green'
                            : rec.status === 'Late Arrival'
                            ? 'bg-cyber-gold/10 border-cyber-gold/20 text-cyber-gold'
                            : rec.status === 'Early Exit'
                            ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red'
                            : 'bg-white/5 border-white/10 text-slate-400'
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
    </div>
  );
}
