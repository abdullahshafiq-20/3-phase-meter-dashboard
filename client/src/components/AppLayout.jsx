import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import {
  LayoutDashboard, BarChart3, Radio, Lightbulb, Bell, Shield, LogOut, Zap, ChevronDown, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/historical', label: 'Historical', icon: BarChart3 },
  { to: '/live', label: 'Live View', icon: Radio },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/alerts', label: 'Alerts', icon: Bell },
];

const adminItems = [
  { to: '/admin', label: 'Admin', icon: Shield },
];

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { devices, selectedDevice, selectDevice } = useDevice();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-cyan-electric/10 text-cyan-electric border border-cyan-electric/20'
        : 'text-grid-400 hover:text-slate-900 hover:bg-grid-800'
    }`;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-grid-700/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-electric/10">
            <Zap className="w-5 h-5 text-cyan-electric" />
          </div>
          <div>
            <h1 className="text-base font-bold"><span className="text-cyan-electric">Power</span>Grid</h1>
            <p className="text-[10px] uppercase tracking-widest text-grid-500">Monitor v1.0</p>
          </div>
        </div>
      </div>

      {/* Device selector */}
      <div className="p-4 border-b border-grid-700/50">
        <label className="block text-[10px] uppercase tracking-widest text-grid-500 mb-2 font-semibold">Active Device</label>
        <div className="relative">
          <select
            id="device-selector"
            value={selectedDevice}
            onChange={(e) => selectDevice(e.target.value)}
            className="w-full bg-grid-900 border border-grid-700 text-slate-800 text-sm rounded-lg px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-cyan-electric/50 cursor-pointer"
          >
            {devices.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-grid-400 pointer-events-none" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-3 px-2">Navigation</p>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClasses} onClick={() => setSidebarOpen(false)}>
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mt-6 mb-3 px-2">System</p>
            {adminItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClasses} onClick={() => setSidebarOpen(false)}>
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User & logout */}
      <div className="p-4 border-t border-grid-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.username}</p>
            <p className="text-[10px] uppercase tracking-widest text-grid-500">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-grid-400 hover:text-red-alarm hover:bg-red-alarm/10 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-grid-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-grid-900 border-r border-grid-700/50 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-grid-900 border border-grid-700 text-slate-700 cursor-pointer"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-40 w-72 bg-grid-900 border-r border-grid-700/50 flex flex-col lg:hidden animate-slide-up">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
