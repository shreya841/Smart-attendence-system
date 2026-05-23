import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    <div>
      <h2 className="text-lg font-bold text-white text-center font-sans tracking-wide mb-6 uppercase">Biometric Enclave Enrollment</h2>

      {error && (
        <div className="mb-4 p-3 bg-cyber-red/10 border border-cyber-red/20 rounded-xl text-cyber-red flex items-center gap-2 text-xs font-mono">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-cyber-green/10 border border-cyber-green/20 rounded-xl text-cyber-green flex items-center gap-2 text-xs font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">Corporate ID</label>
          <input
            type="text"
            name="id"
            required
            placeholder="e.g. EMP-102"
            value={formData.id}
            onChange={handleChange}
            className="w-full glass-input py-2 text-sm text-slate-200"
          />
        </div>

        <div>
          <label className="block text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Shreya"
              value={formData.name}
              onChange={handleChange}
              className="w-full glass-input pl-10 py-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">Corporate Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="email"
              name="email"
              required
              placeholder="e.g. employee@company.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full glass-input pl-10 py-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">Security Keyphrase</label>
          <div className="relative">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="password"
              name="password"
              required
              placeholder="Min 6 characters..."
              value={formData.password}
              onChange={handleChange}
              className="w-full glass-input pl-10 py-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">Enclave Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full glass-input py-2 text-xs text-slate-200"
            >
              <option value="employee">Employee</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">Department</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full glass-input py-2 text-xs text-slate-200"
            >
              <option value="Engineering">Engineering</option>
              <option value="Security & HR">Security & HR</option>
              <option value="Product">Product</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-cyber-blue to-cyber-cyan hover:shadow-cyan-glow text-white font-semibold py-3 px-4 rounded-xl border border-cyan-400/20 active:scale-[0.98] transition-all duration-200 text-xs font-mono uppercase tracking-wider disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          {loading ? 'Enrolling...' : 'Enroll Credentials'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <p className="text-[10px] font-mono text-slate-500">
          Already registered? <Link to="/login" className="text-cyber-cyan hover:underline">Authorize here</Link>
        </p>
      </div>
    </div>
  );
}
