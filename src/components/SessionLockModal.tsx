import React from 'react';
import { UserProfile } from '../types';
import { Lock, Unlock, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { logSecurityEvent } from '../security';

interface SessionLockModalProps {
  currentUser: UserProfile;
  onUnlock: () => void;
  onLogout: () => void;
}

export default function SessionLockModal({ currentUser, onUnlock, onLogout }: SessionLockModalProps) {
  const [password, setPassword] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const expectedPassword = currentUser.password || 'password';
    if (password === expectedPassword) {
      logSecurityEvent({
        action: 'UNLOCK_SESSION',
        userName: currentUser.name,
        userRole: currentUser.role,
        details: 'Sesi layar berhasil dibuka kembali dengan verifikasi kata sandi'
      });
      onUnlock();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setErrorMsg(`Kata sandi tidak sesuai (${newAttempts}x gagal).`);
      logSecurityEvent({
        action: 'UNLOCK_SESSION',
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Gagal membuka kunci sesi layar (${newAttempts}x)`,
        status: 'WARNING'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" id="session-lock-overlay">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-100 w-full max-w-md overflow-hidden animate-scaleUp">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-green-900 p-6 text-white text-center relative">
          <div className="mx-auto w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-3 shadow-inner">
            <Lock className="h-7 w-7 text-emerald-300 animate-pulse" />
          </div>
          <h3 className="text-lg font-black tracking-tight">Sesi Terkunci Demi Keamanan</h3>
          <p className="text-xs text-emerald-100/90 mt-1">
            Data penilaian & supervisi diamankan secara otomatis
          </p>
        </div>

        {/* User Card & Unlock Form */}
        <div className="p-6 space-y-5">
          <div className="flex items-center space-x-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="h-11 w-11 bg-emerald-600 rounded-full flex items-center justify-center text-white font-extrabold text-base shadow-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-slate-900 truncate">{currentUser.name}</h4>
              <p className="text-[10px] text-slate-500 truncate">{currentUser.details || currentUser.role}</p>
              <div className="flex items-center space-x-1 mt-0.5 text-[9px] font-bold text-emerald-700">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>ASAGK Security Guard Aktif</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Masukkan Kata Sandi untuk Melanjutkan:
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                id="input-session-unlock-password"
              />
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                id="btn-unlock-session"
              >
                <Unlock className="h-4 w-4" />
                <span>Buka Kunci Layar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  logSecurityEvent({
                    action: 'LOGOUT',
                    userName: currentUser.name,
                    userRole: currentUser.role,
                    details: 'Pengguna memilih keluar saat sesi terkunci'
                  });
                  onLogout();
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold rounded-2xl transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-200"
                title="Keluar dari akun ini"
                id="btn-logout-from-locked-session"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </form>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Perlindungan privasi otomatis untuk mencegah akses tanpa izin saat perangkat ditinggalkan di ruang guru atau kantor.
          </p>
        </div>
      </div>
    </div>
  );
}
