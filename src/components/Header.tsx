import React from 'react';
import { UserProfile, UserRole } from '../types';
import { LogOut, RefreshCw, ShieldAlert, Award, User, HelpCircle, Cloud, Lock, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
  onLockSession?: () => void;
  isFirebaseConnected?: boolean;
}

export default function Header({ currentUser, allUsers, onSwitchUser, onLogout, onLockSession, isFirebaseConnected = true }: HeaderProps) {
  const [showSwitcher, setShowSwitcher] = React.useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'GURU':
        return 'bg-blue-50 text-blue-700 border-blue-250';
      case 'KEPALA_SEKOLAH':
        return 'bg-emerald-50 text-emerald-700 border-emerald-250';
      case 'PENGAWAS':
        return 'bg-amber-50 text-amber-700 border-amber-250';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'GURU': return 'Guru Kelas';
      case 'KEPALA_SEKOLAH': return 'Kepala Sekolah';
      case 'PENGAWAS': return 'Pengawas / Supervisor';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Application Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-100">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-sans font-extrabold text-xl text-slate-800 tracking-tight leading-none">ASAGK</span>
                <span className="hidden sm:inline-block h-4 w-[1px] bg-slate-200"></span>
                <span className="hidden sm:inline-block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Kecamatan Kapuas Kuala</span>
              </div>
              <p className="text-[10px] text-slate-500 hidden md:block mt-0.5">Portal Penjaminan Mutu Akademik Guru Kelas</p>
            </div>
          </div>

          {/* User Profile & Demo Switcher */}
          <div className="flex items-center space-x-3">
            {/* Firebase Cloud status indicator */}
            <div 
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                isFirebaseConnected 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title="Konektivitas Firebase Firestore Real-Time"
              id="firebase-status-badge"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isFirebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <Cloud className="h-3 w-3" />
              <span>{isFirebaseConnected ? 'Firebase Aktif' : 'Menghubungkan...'}</span>
            </div>

            {/* Quick switcher helper banner */}
            <div className="relative">
              <button 
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
                title="Ganti peran untuk uji coba alur kerja"
                id="btn-demo-switcher"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin-slow text-slate-500" />
                <span className="hidden sm:inline">Simulasi Peran</span>
              </button>

              {showSwitcher && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-3 z-50 animate-fadeIn" id="switcher-panel">
                  <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                      Mode Simulasi Multi-User
                    </span>
                    <span className="text-[10px] text-slate-400">Pilih Akun</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto px-2 pt-2 space-y-1">
                    {allUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u.id);
                          setShowSwitcher(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-all text-xs flex items-start space-x-2.5 ${
                          currentUser.id === u.id 
                            ? 'bg-emerald-50 border border-emerald-200' 
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                        id={`switch-to-${u.id}`}
                      >
                        <div className="mt-0.5 p-1 bg-slate-100 rounded text-slate-600">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{u.details || getRoleLabel(u.role)}</p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 mt-1 rounded border ${getRoleBadgeColor(u.role)}`}>
                            {getRoleLabel(u.role)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-4 pt-2 border-t border-slate-100 mt-2">
                    <p className="text-[9px] text-slate-400 text-center flex items-center justify-center">
                      <HelpCircle className="h-3 w-3 mr-1" />
                      Data tersinkron otomatis antar user (localStorage)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Current Active User Info */}
            <div className="flex items-center space-x-3 pl-2 border-l border-gray-100">
              <div className="hidden lg:block text-right">
                <span className="block text-xs font-bold text-gray-800 truncate max-w-[180px]">
                  {currentUser.name}
                </span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadgeColor(currentUser.role)}`}>
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
              <div className="h-9 w-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs border border-white">
                {currentUser.name.charAt(0)}
              </div>
              
              {/* Lock Screen Button */}
              {onLockSession && (
                <button
                  onClick={onLockSession}
                  className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                  title="Kunci Layar (Proteksi Sesi)"
                  id="btn-lock-session"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Keluar / Logout"
                id="btn-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>

            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
