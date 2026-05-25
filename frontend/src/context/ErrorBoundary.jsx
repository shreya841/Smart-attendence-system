import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CRITICAL MATRIX EXCEPTION DETECTED]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel border-cyber-red/20 rounded-2xl p-8 max-w-2xl mx-auto my-12 text-center relative overflow-hidden font-mono bg-slate-950/80 backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyber-red to-transparent"></div>
          
          <div className="w-16 h-16 bg-cyber-red/10 border border-cyber-red/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-red-glow">
            <ShieldAlert className="w-8 h-8 text-cyber-red animate-pulse" />
          </div>
          
          <h3 className="text-sm font-bold tracking-widest text-white uppercase mb-2">
            CRITICAL ENCLAVE FAULT DETECTED
          </h3>
          
          <p className="text-[10px] text-slate-400 uppercase mb-6 leading-relaxed max-w-md mx-auto">
            The neural render-tree encountered an unexpected thread exception. Operational systems have isolated the fault enclave.
          </p>
          
          <div className="bg-slate-950/90 border border-white/5 rounded-xl p-4 text-left text-xs mb-6 max-h-48 overflow-y-auto text-cyber-red/90 custom-scrollbar">
            <p className="font-bold border-b border-white/5 pb-2 mb-2 uppercase text-[9px] text-slate-500 tracking-wider">Error Report Matrix:</p>
            <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
              {this.state.error?.stack || this.state.error?.toString() || 'Unknown Runtime Exception'}
            </pre>
          </div>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 bg-cyber-red/20 border border-cyber-red/40 hover:bg-cyber-red/30 text-cyber-red text-xs font-bold py-2.5 px-6 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-red-glow"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Hot-Reload Enclave
            </button>
            
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="inline-flex items-center gap-2 bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 text-xs font-bold py-2.5 px-6 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
