import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { UserPlus, Mail, Key, User, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: 'Engineering'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const res = await register(formData);
    if (res.success) {
      setSuccess('Profile initialized successfully! Redirecting...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } else {
      setError(res.message || 'Profile enrollment failed.');
      setLoading(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="font-mono text-slate-300"
    >
      <h2 className="text-sm font-bold text-white text-center font-mono tracking-widest mb-6 uppercase text-glow-cyan">// NEW MEMBER REGISTRATION</h2>

      {error && (
        <div className="mb-4 p-3 bg-cyber-red/5 border border-cyber-red/20 rounded-xl text-cyber-red flex items-center gap-2 text-xs font-mono shadow-[0_0_15px_rgba(239,68,68,0.05)] animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-cyber-green/5 border border-cyber-green/20 rounded-xl text-cyber-green flex items-center gap-2 text-xs font-mono shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1">Corporate ID</label>
          <input
            type="text"
            name="id"
            required
            placeholder="e.g. EMP-102"
            value={formData.id}
            onChange={handleChange}
            className="w-full bg-slate-950/40 border border-white/5 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all duration-200 backdrop-blur-md shadow-inner"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Shreya"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-slate-950/40 border border-white/5 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all duration-200 backdrop-blur-md shadow-inner"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1">Corporate Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="email"
              name="email"
              required
              placeholder="e.g. employee@company.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-slate-950/40 border border-white/5 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all duration-200 backdrop-blur-md shadow-inner"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1">Security Keyphrase</label>
          <div className="relative">
            <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="password"
              name="password"
              required
              placeholder="Min 6 characters..."
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-slate-950/40 border border-white/5 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all duration-200 backdrop-blur-md shadow-inner"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1">Enclave Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full bg-slate-950/40 border border-white/5 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan rounded-xl px-3 py-3 text-xs text-slate-300 outline-none transition-all duration-200 backdrop-blur-md cursor-pointer"
            >
              <option value="employee" className="bg-slate-950">Employee</option>
              <option value="admin" className="bg-slate-950">Administrator</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1">Department</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full bg-slate-950/40 border border-white/5 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan rounded-xl px-3 py-3 text-xs text-slate-300 outline-none transition-all duration-200 backdrop-blur-md cursor-pointer"
            >
              <option value="Engineering" className="bg-slate-950">Engineering</option>
              <option value="Security & HR" className="bg-slate-950">Security & HR</option>
              <option value="Product" className="bg-slate-950">Product</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-cyber-blue to-cyber-cyan text-slate-950 font-bold py-3.5 px-4 rounded-xl border border-cyan-400/20 active:scale-[0.98] hover:shadow-cyan-glow transition-all duration-300 text-xs uppercase tracking-widest cursor-pointer disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4 text-slate-950" />
          {loading ? 'ENROLLING IN DATABASE...' : 'Enroll Credentials'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500">
          Already registered? <Link to="/login" className="text-cyber-cyan hover:underline">Authorize here</Link>
        </p>
      </div>
    </motion.div>
  );
