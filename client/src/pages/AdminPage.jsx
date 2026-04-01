import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Shield, RefreshCw, Users, Server, HardDrive, CheckCircle2 } from 'lucide-react';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [reloadMsg, setReloadMsg] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, statusRes] = await Promise.all([
        api.getUsers(),
        api.getSystemStatus()
      ]);
      setUsers(usersRes.data.users || []);
      setStatus(statusRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadCsv = async () => {
    setReloading(true);
    setReloadMsg(null);
    try {
      const res = await api.reloadCsv();
      setReloadMsg({ type: 'success', text: res.message });
      fetchData(); // Refresh status after reload
    } catch (err) {
      setReloadMsg({ type: 'error', text: err.message || 'Failed to reload CSV' });
    } finally {
      setReloading(false);
      setTimeout(() => setReloadMsg(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-electric border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="text-cyan-electric" size={24} /> Admin Console
        </h2>
        <p className="text-grid-400 text-sm mt-1">System status, user management, and data operations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status Card */}
        <div className="glass-panel p-6 animate-slide-up">
          <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Server size={16} className="text-phase-b" /> Environment Status
          </h3>
          {status && (
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-grid-700/50">
                <span className="text-grid-400 text-sm">Server Uptime</span>
                <span className="data-readout text-slate-900 font-semibold">
                  {(status.uptime / 3600).toFixed(2)} hrs
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-grid-700/50">
                <span className="text-grid-400 text-sm">Memory Usage (RSS)</span>
                <span className="data-readout text-slate-900 font-semibold">
                  {(status.memoryUsage.rss / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-grid-700/50">
                <span className="text-grid-400 text-sm">Active Devices</span>
                <span className="data-readout text-slate-900 font-semibold flex items-center gap-2">
                  <HardDrive size={14} className="text-amber-signal" />
                  {status.deviceCount}
                </span>
              </div>
            </div>
          )}
          
          <div className="mt-8">
            <h4 className="text-xs font-semibold text-grid-500 uppercase mb-3">Data Management</h4>
            <div className="flex items-center gap-4">
              <button
                onClick={handleReloadCsv}
                disabled={reloading}
                className="flex items-center gap-2 px-4 py-2 bg-grid-900 hover:bg-grid-800 border border-grid-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={reloading ? "animate-spin text-cyan-electric" : "text-cyan-electric"} />
                {reloading ? 'Reloading...' : 'Hot-Reload CSV File'}
              </button>
              {reloadMsg && (
                <span className={`text-sm flex items-center gap-1 ${reloadMsg.type === 'success' ? 'text-green-ok' : 'text-red-alarm'} animate-fade-in`}>
                  {reloadMsg.type === 'success' && <CheckCircle2 size={14} />}
                  {reloadMsg.text}
                </span>
              )}
            </div>
            <p className="text-[10px] text-grid-500 mt-2">Forces the server to re-read telemetry data from disk without restarting.</p>
          </div>
        </div>

        {/* User Management */}
        <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Users size={16} className="text-amber-signal" /> User Directory
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grid-700/50 bg-grid-800/20 text-left text-grid-500">
                  <th className="px-4 py-3 font-semibold uppercase text-[10px] tracking-wider">Username</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[10px] tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} className="border-b border-grid-700/30 hover:bg-grid-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        u.role === 'admin' 
                        ? 'bg-red-alarm/10 text-red-alarm border-red-alarm/20' 
                        : 'bg-cyan-electric/10 text-cyan-electric border-cyan-electric/20'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
