import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth, supabase } from './AuthContext.jsx';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { token, user } = useAuth();
  
  const listenersRef = useRef({});
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // 1. Initialize Supabase Realtime (Primary)
    console.log(`[REALTIME CONNECTING]: Initiating Supabase Realtime connection...`);
    const channel = supabase.channel('system_events');

    channel
      .on('broadcast', { event: '*' }, (payload) => {
        // Forward broadcast events to registered app listeners
        const eventName = payload.event;
        const data = payload.payload;
        if (listenersRef.current[eventName]) {
          listenersRef.current[eventName].forEach(cb => cb(data));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[REALTIME LIVE]: Supabase Realtime connected successfully.`);
          setConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log(`[REALTIME OFFLINE]: Supabase Realtime disconnected (${status}).`);
          setConnected(false);
        }
      });

    // 2. Initialize Socket.io (Fallback/Legacy)
    const socketUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    console.log(`[SOCKET CONNECTING]: Initiating legacy socket connection to ${socketUrl}`);

    const socketConn = io(socketUrl, {
      auth: { token },
      transports: ['websocket']
    });

    socketConn.on('connect', () => {
      console.log(`[SOCKET LIVE]: Socket.io connected successfully. Connection ID: ${socketConn.id}`);
      // Join user-specific rooms or role-based channels
      if (user?.role === 'admin') {
        socketConn.emit('join', 'admins');
      } else if (user) {
        socketConn.emit('join', `employee:${user.id}`);
      }
    });

    socketConn.on('disconnect', () => {
      console.log('[SOCKET OFFLINE]: Socket.io disconnected from host.');
    });

    // Re-attach any existing listeners to the new socket connection
    Object.keys(listenersRef.current).forEach(eventName => {
      listenersRef.current[eventName].forEach(cb => {
        socketConn.on(eventName, cb);
      });
    });

    socketRef.current = socketConn;
    setSocket(socketConn);

    return () => {
      socketConn.disconnect();
      supabase.removeChannel(channel);
    };
  }, [token, user]);

  // Helper object to mock Socket.io's .on() and .off() using our state
  const mockSocket = {
    on: (eventName, callback) => {
      if (!listenersRef.current[eventName]) {
        listenersRef.current[eventName] = [];
      }
      if (!listenersRef.current[eventName].includes(callback)) {
        listenersRef.current[eventName].push(callback);
      }
      
      // Also attach to legacy socket.io if it exists
      if (socketRef.current) {
        socketRef.current.on(eventName, callback);
      }
    },
    off: (eventName, callback) => {
      if (listenersRef.current[eventName]) {
        listenersRef.current[eventName] = listenersRef.current[eventName].filter(cb => cb !== callback);
      }
      
      if (socketRef.current) {
        socketRef.current.off(eventName, callback);
      }
    }
  };

  return (
    <SocketContext.Provider value={{ socket: mockSocket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
