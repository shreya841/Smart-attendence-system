import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  ScanFace, 
  MapPin, 
  UserSquare2, 
  Users2, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Bell, 
  Menu, 
  X,
  Radio
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout, loading } = useAuth();
  const { connected, socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlertDropdown, setShowAlertDropdown] = useState(false);

  // Socket notification listener
  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (data) => {
      // Add notification log
      setAlerts(prev => [
        {
          id: Date.now(),
          title: `Activity: ${data.event_type}`,
          message: `${data.name || 'Unknown'} - ${data.details?.status || 'Boundary trigger'}`,
          type: 'info',
          time: new Date().toLocaleTimeString()
        },
        ...prev
      ].slice(0, 10)); // Limit to 10 logs
    };

    const handleUnauthorized = (data) => {
      setAlerts(prev => [
        {
          id: Date.now(),
          title: '🚨 SECURITY ALERT',
          message: `Unauthorized face scan detected!`,
          type: 'danger',
          time: new Date().toLocaleTimeString()
        },
        ...prev
      ].slice(0, 10));
    };

    socket.on('logs:new', handleNewLog);
    socket.on('unauthorized:alert', handleUnauthorized);

    return () => {
      socket.off('logs:new', handleNewLog);
      socket.off('unauthorized:alert', handleUnauthorized);
    };
  }, [socket]);

  if (loading) return null;

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'employee'] },
    { name: 'AI Biometric Scanner', path: '/scanner', icon: ScanFace, roles: ['admin', 'employee'] },
    { name: 'Geofence Sandbox', path: '/sandbox', icon: MapPin, roles: ['admin', 'employee'] },
    { name: 'Admin Management', path: '/admin', icon: Users2, roles: ['admin'] },
    { name: 'My Profile', path: '/profile', icon: UserSquare2, roles: ['admin', 'employee'] },
  ];

  const allowedMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  const currentRouteName = menuItems.find(item => item.path === location.pathname)?.name || 'Operational Center';

  return (
    <div className="min-h-screen flex bg-cyber-bg relative">
      {/* Background Neon Lights */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-cyber-cyan/5 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyber-blue/5 rounded-full filter blur-[120px] pointer-events-none"></div>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 glass-panel border-r border-white/10 shrink-0 relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-white/10 gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyber-blue to-cyber-cyan rounded-xl flex items-center justify-center shadow-cyan-glow border border-cyan-400/20">
            <span className="text-xl">🛡️</span>
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight text-white">
              QUANTUM<span className="text-cyber-cyan font-extrabold">GUARD</span>
            </h1>
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">System Core v1.0</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border text-sm font-medium ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyber-cyan/15 to-transparent border-cyber-cyan/40 text-cyber-cyan shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]' 
                      : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer User Details */}
        <div className="p-4 border-t border-white/10 bg-slate-950/20">
          <div className="flex items-center gap-3 px-2 py-1 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center uppercase font-bold text-cyber-cyan text-sm shadow-inner">
              {(user?.name || '').slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] font-mono text-slate-400 truncate capitalize">{user?.role} • {user?.department}</p>
            </div>
          </div>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 bg-slate-900/50 text-slate-400 hover:text-cyber-red hover:bg-cyber-red/10 hover:border-cyber-red/20 transition-all duration-200 text-xs font-semibold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4" />
            De-Authorize Session
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/80 backdrop-blur-sm">
          <div className="w-64 glass-panel-heavy h-full flex flex-col relative animate-slide-in">
            <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <span className="font-bold text-white text-md">QUANTUMGUARD</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {allowedMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border text-sm font-medium ${
                        isActive 
                          ? 'bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan' 
                          : 'border-transparent text-slate-400 hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-red/10 border border-cyber-red/20 text-cyber-red hover:bg-cyber-red/20 transition-all duration-200 text-xs font-bold"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header Panel */}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 lg:px-8 bg-slate-950/20 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{currentRouteName}</h2>
              <p className="hidden sm:block text-[10px] font-mono tracking-widest text-slate-400 uppercase">Operational Security Enclave</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Realtime Socket Sync Monitor */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 text-xs font-mono select-none ${
              connected ? 'bg-cyber-green/5 text-cyber-green' : 'bg-cyber-gold/5 text-cyber-gold'
            }`}>
              {connected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">SYNCED</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 animate-bounce" />
                  <span className="hidden sm:inline">DISCONNECTED</span>
                </>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowAlertDropdown(!showAlertDropdown)}
                className="p-2.5 rounded-xl border border-white/10 hover:border-cyber-cyan hover:bg-cyber-cyan/5 transition-all text-slate-400 hover:text-white relative"
              >
                <Bell className="w-5 h-5" />
                {alerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyber-red rounded-full ring-2 ring-cyber-bg animate-ping"></span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showAlertDropdown && (
                <div className="absolute right-0 mt-3 w-80 glass-panel-heavy border border-white/15 rounded-2xl shadow-2xl p-4 overflow-hidden z-50">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
                    <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyber-cyan flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-cyber-red" /> Live Logs Feed
                    </span>
                    <button 
                      onClick={() => setAlerts([])} 
                      className="text-[10px] font-mono uppercase text-slate-500 hover:text-white"
                    >
                      Purge Logs
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
                    {alerts.length === 0 ? (
                      <div className="py-8 text-center">
                        <ShieldAlert className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-[10px] font-mono text-slate-500">SYSTEM STABLE. NO TELEMETRY EVENTS IN VECTOR POOL.</p>
                      </div>
                    ) : (
                      alerts.map(a => (
                        <div key={a.id} className={`p-2.5 rounded-xl border ${
                          a.type === 'danger' 
                            ? 'bg-cyber-red/10 border-cyber-red/20 text-cyber-red' 
                            : 'bg-white/5 border-white/5 text-slate-300'
                        }`}>
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold font-mono tracking-wide uppercase">{a.title}</span>
                            <span className="text-[8px] font-mono text-slate-500">{a.time}</span>
                          </div>
                          <p className="text-[10.5px] mt-1 break-words font-sans">{a.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Main Workspace */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
