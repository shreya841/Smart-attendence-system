import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { SocketProvider, useSocket } from '../context/SocketContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
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
  Radio,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  Compass
} from 'lucide-react';

function DashboardLayoutInner() {
  const { user, logout, loading } = useAuth();
  const { connected, socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlertDropdown, setShowAlertDropdown] = useState(false);
  
  // Persist sidebar collapsed state in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('quantum_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('quantum_sidebar_collapsed', String(next));
  };

  // Socket notification listener
  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (data) => {
      setAlerts(prev => [
        {
          id: Date.now(),
          title: `Activity: ${data.event_type}`,
          message: `${data.name || 'Unknown'} - ${data.details?.status_text || 'Boundary trigger'}`,
          type: 'info',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ].slice(0, 10));
    };

    const handleUnauthorized = (data) => {
      setAlerts(prev => [
        {
          id: Date.now(),
          title: '🚨 SECURITY ALERT',
          message: `Unauthorized face scan detected!`,
          type: 'danger',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
    { name: 'Biometric Scanner', path: '/scanner', icon: ScanFace, roles: ['admin', 'employee'] },
    { name: 'Geofence Sandbox', path: '/sandbox', icon: MapPin, roles: ['admin', 'employee'] },
    { name: 'Admin Control', path: '/admin', icon: Users2, roles: ['admin'] },
    { name: 'My Profile', path: '/profile', icon: UserSquare2, roles: ['admin', 'employee'] },
  ];

  const allowedMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  const currentRouteName = menuItems.find(item => item.path === location.pathname)?.name || 'Operational Center';

  return (
    <div className="min-h-screen flex bg-[#030712] relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-cyber-cyan/5 to-transparent rounded-full filter blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-cyber-blue/5 to-transparent rounded-full filter blur-[150px] pointer-events-none"></div>

      {/* Sidebar - Desktop (Collapsible via Framer Motion) */}
      <motion.aside 
        animate={{ width: isCollapsed ? 76 : 260 }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        className="hidden lg:flex flex-col glass-panel border-r border-white/5 shrink-0 relative z-20"
      >
        {/* Sidebar Header / Logo */}
        <div className="h-20 flex items-center px-4 border-b border-white/5 justify-between relative">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 bg-gradient-to-tr from-cyber-blue to-cyber-cyan rounded-xl flex items-center justify-center shadow-cyan-glow border border-cyber-cyan/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-sm font-bold tracking-widest text-white font-mono uppercase">
                  QUANTUM<span className="text-cyber-cyan">GUARD</span>
                </h1>
                <span className="text-[8px] font-mono tracking-widest text-slate-500 uppercase block -mt-0.5">SYS ENCLAVE v1.0</span>
              </motion.div>
            )}
          </div>

          {/* Collapse Toggle Trigger */}
          <button 
            onClick={toggleSidebar}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyber-cyan transition-all cursor-pointer z-30"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Desktop Sidebar Navigation Links */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-200 border text-[11px] font-mono uppercase tracking-wider ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyber-cyan/10 to-transparent border-cyber-cyan/25 text-cyber-cyan shadow-[inset_0_0_12px_rgba(6,182,212,0.02)]' 
                      : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  }`
                }
                title={isCollapsed ? item.name : ''}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="truncate"
                  >
                    {item.name}
                  </motion.span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer User Details */}
        <div className="p-3 border-t border-white/5 bg-slate-950/20">
          <div className="flex items-center gap-3 px-1 py-1 mb-4 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#070b19] border border-white/15 flex items-center justify-center uppercase font-mono font-bold text-cyber-cyan text-xs shrink-0 shadow-cyan-glow">
              {(user?.name || '').slice(0, 2)}
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-w-0"
              >
                <p className="text-[11px] font-bold text-white truncate leading-none uppercase font-mono">{user?.name}</p>
                <p className="text-[8px] font-mono text-slate-500 truncate capitalize mt-1 tracking-wider">{user?.role} • {user?.department}</p>
              </motion.div>
            )}
          </div>
          <button
            onClick={handleLogoutClick}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/5 bg-[#090d16]/40 text-slate-400 hover:text-cyber-red hover:bg-cyber-red/10 hover:border-cyber-red/20 transition-all duration-200 text-[9px] font-bold font-mono uppercase tracking-wider cursor-pointer ${isCollapsed ? 'px-0' : ''}`}
            title="De-Authorize Session"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>De-Authorize</span>}
          </button>
        </div>
      </motion.aside>

      {/* Sidebar - Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-64 glass-panel-heavy h-full flex flex-col relative"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyber-cyan" />
                  <span className="font-bold text-white text-sm font-mono tracking-wider">QUANTUMGUARD</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
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
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border text-xs font-mono uppercase tracking-wider ${
                          isActive 
                            ? 'bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan' 
                            : 'border-transparent text-slate-400 hover:bg-white/5'
                        }`
                      }
                    >
                      <Icon className="w-4.5 h-4.5" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-white/5">
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyber-red/10 border border-cyber-red/20 text-cyber-red hover:bg-cyber-red/20 transition-all duration-200 text-xs font-bold font-mono uppercase cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header Panel */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 lg:px-8 bg-[#090d16]/30 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-white tracking-widest font-mono uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse"></span>
                {currentRouteName}
              </h2>
              <p className="hidden sm:block text-[8px] font-mono tracking-widest text-slate-500 uppercase mt-0.5">Operational Intelligence Console</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Realtime Socket Sync Monitor */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 text-[9px] font-mono select-none ${
              connected ? 'bg-cyber-green/5 text-cyber-green border-cyber-green/10' : 'bg-cyber-gold/5 text-cyber-gold border-cyber-gold/10'
            }`}>
              {connected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">SECURE SYNC ACTIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 animate-bounce" />
                  <span className="hidden sm:inline">NETWORK OFFLINE</span>
                </>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowAlertDropdown(!showAlertDropdown)}
                className="p-2 rounded-xl border border-white/5 hover:border-cyber-cyan hover:bg-cyber-cyan/5 transition-all text-slate-400 hover:text-white relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyber-red rounded-full ring-1 ring-cyber-bg"></span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              <AnimatePresence>
                {showAlertDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-3 w-80 glass-panel-heavy border border-white/10 rounded-2xl shadow-2xl p-4 overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-2">
                      <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-cyber-cyan flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 animate-pulse text-cyber-red" /> Live Logs Feed
                      </span>
                      <button 
                        onClick={() => setAlerts([])} 
                        className="text-[8px] font-mono uppercase text-slate-500 hover:text-white cursor-pointer"
                      >
                        Purge
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
                      {alerts.length === 0 ? (
                        <div className="py-8 text-center">
                          <ShieldAlert className="w-5 h-5 text-slate-700 mx-auto mb-2" />
                          <p className="text-[9px] font-mono text-slate-500">SYSTEM SECURE. NO EVENTS DETECTED.</p>
                        </div>
                      ) : (
                        alerts.map(a => (
                          <div key={a.id} className={`p-2.5 rounded-xl border text-[10px] font-mono ${
                            a.type === 'danger' 
                              ? 'bg-cyber-red/5 border-cyber-red/10 text-cyber-red' 
                              : 'bg-white/[0.02] border-white/5 text-slate-350'
                          }`}>
                            <div className="flex justify-between items-start">
                              <span className="font-bold tracking-wide uppercase">{a.title}</span>
                              <span className="text-[8px] text-slate-500">{a.time}</span>
                            </div>
                            <p className="mt-1 break-words leading-relaxed text-slate-400">{a.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

export default function DashboardLayout() {
  return (
    <SocketProvider>
      <DashboardLayoutInner />
    </SocketProvider>
  );
}
