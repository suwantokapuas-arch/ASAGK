import React from 'react';
import { UserProfile, UserRole, SupervisionEvaluation } from '../types';
import { Award, User, Lock, ArrowRight, Shield, CheckCircle, GraduationCap, FileText, Search, ExternalLink, Download, X, Eye, EyeOff, FileCheck, Check, Sparkles, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { normalizeAndFindEvaluation, getFullRegistrationNumber } from '../utils';
import heroSupervisionImg from '../assets/images/supervision_caricature.webp';
import { auth, googleAuthProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { checkLoginLockout, recordFailedLogin, resetLoginLockout, logSecurityEvent, sanitizeString } from '../security';

interface LandingPageProps {
  allUsers: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  evaluations: SupervisionEvaluation[];
  onViewRaport?: (evalId: string) => void;
}

export default function LandingPage({ allUsers, onLoginSuccess, evaluations, onViewRaport }: LandingPageProps) {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('GURU');
  const [usernameInput, setUsernameInput] = React.useState('');
  const [passwordInput, setPasswordInput] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [searchReportId, setSearchReportId] = React.useState('');
  const [searchError, setSearchError] = React.useState('');
  const [showSearchModal, setShowSearchModal] = React.useState(false);
  const [modalSearchQuery, setModalSearchQuery] = React.useState('ASAGK/001/2026');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');

    const trimmedId = searchReportId.trim();
    if (!trimmedId) {
      setSearchError('Harap masukkan Nomor Registrasi atau ID Evaluasi terlebih dahulu.');
      return;
    }

    // Normalize and find if it exists in evaluations list
    const found = normalizeAndFindEvaluation(trimmedId, evaluations);
    if (found) {
      // Always open in a new tab with &print=true to automatically trigger print/save dialog
      const url = `${window.location.origin}${window.location.pathname}?raport=${found.id}&print=true`;
      window.open(url, '_blank');
    } else {
      setSearchError(`Nomor Registrasi '${trimmedId}' tidak ditemukan. Silakan periksa kembali atau pilih dari contoh nomor registrasi aktif di bawah.`);
    }
  };

  const openSearchModal = (initialQuery?: string) => {
    if (initialQuery) {
      setModalSearchQuery(initialQuery);
    } else if (searchReportId.trim()) {
      setModalSearchQuery(searchReportId.trim());
    } else if (evaluations.length > 0) {
      setModalSearchQuery(getFullRegistrationNumber(evaluations[0]));
    }
    setShowSearchModal(true);
  };

  // Auto-fill inputs when changing roles to make testing convenient,
  // or user can click quick login buttons.
  React.useEffect(() => {
    setLoginError('');
    if (selectedRole === 'GURU') {
      setUsernameInput('Purwanti12345');
      setPasswordInput('04111970');
    } else if (selectedRole === 'KEPALA_SEKOLAH') {
      setUsernameInput('Suwanto12345');
      setPasswordInput('password');
    } else if (selectedRole === 'PENGAWAS') {
      setUsernameInput('bambang123');
      setPasswordInput('password');
    }
  }, [selectedRole]);

  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    setLoginError('');
    setIsGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const googleUser = result.user;
      
      const foundUser = allUsers.find(
        (u) => (googleUser.email && u.username.toLowerCase() === googleUser.email.toLowerCase()) ||
               (u.name.toLowerCase() === (googleUser.displayName || '').toLowerCase())
      );

      if (foundUser) {
        onLoginSuccess(foundUser);
      } else {
        const newGoogleProfile: UserProfile = {
          id: `google_${googleUser.uid}`,
          username: googleUser.email || googleUser.uid,
          name: googleUser.displayName || 'Pengguna Google',
          role: selectedRole,
          schoolName: selectedRole === 'PENGAWAS' ? 'Korwil Bidang Pendidikan Kapuas Kuala' : 'SDN Gugus 2 Kapuas Kuala',
          details: `${selectedRole === 'GURU' ? 'Guru' : selectedRole === 'KEPALA_SEKOLAH' ? 'Kepala Sekolah' : 'Pengawas'} (Firebase Google Auth)`,
        };
        onLoginSuccess(newGoogleProfile);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setLoginError('Gagal masuk dengan Google: ' + (err?.message || 'Terjadi kendala autentikasi'));
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const [showPassword, setShowPassword] = React.useState(false);
  const [lockoutRemaining, setLockoutRemaining] = React.useState(0);

  // Check lockout on username change or role change
  React.useEffect(() => {
    const lock = checkLoginLockout(usernameInput);
    if (lock.isLocked) {
      setLockoutRemaining(lock.remainingSeconds);
    } else {
      setLockoutRemaining(0);
    }
  }, [usernameInput, selectedRole]);

  // Lockout countdown timer
  React.useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanUsername = sanitizeString(usernameInput);

    if (lockoutRemaining > 0) {
      setLoginError(`Akses akun terkunci sementara demi keamanan karena percobaan gagal berturut-turut. Silakan tunggu ${lockoutRemaining} detik.`);
      return;
    }

    if (!cleanUsername) {
      setLoginError('Harap isi nama pengguna.');
      return;
    }

    if (!passwordInput) {
      setLoginError('Harap isi kata sandi.');
      return;
    }

    // Authenticate based on username
    const foundUser = allUsers.find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase() && u.role === selectedRole
    );

    if (foundUser) {
      const expectedPassword = foundUser.password || 'password';
      if (passwordInput === expectedPassword) {
        resetLoginLockout(cleanUsername);
        logSecurityEvent({
          action: 'LOGIN_SUCCESS',
          userName: foundUser.name,
          userRole: foundUser.role,
          details: `Berhasil masuk ke portal ASAGK sebagai ${getRoleName(foundUser.role)} (${cleanUsername})`
        });
        onLoginSuccess(foundUser);
      } else {
        const lockResult = recordFailedLogin(cleanUsername);
        if (lockResult.isLocked) {
          setLockoutRemaining(lockResult.remainingSeconds);
          setLoginError(`Kata sandi salah. Akun terkunci selama ${lockResult.remainingSeconds} detik demi keamanan (Percobaan ${lockResult.attempts}/5).`);
          logSecurityEvent({
            action: 'RATE_LIMIT_LOCKOUT',
            userName: cleanUsername,
            userRole: selectedRole,
            details: `Akun diblokir sementara 45 detik setelah ${lockResult.attempts} kali salah kata sandi`,
            status: 'ALERT'
          });
        } else {
          setLoginError(`Kata sandi yang Anda masukkan salah. (Percobaan ke-${lockResult.attempts}/5)`);
          logSecurityEvent({
            action: 'LOGIN_FAILED',
            userName: cleanUsername,
            userRole: selectedRole,
            details: `Gagal login: kata sandi salah (percobaan ${lockResult.attempts}/5)`,
            status: 'WARNING'
          });
        }
      }
    } else {
      const lockResult = recordFailedLogin(cleanUsername);
      setLoginError(`Nama pengguna "${cleanUsername}" tidak terdaftar sebagai ${getRoleName(selectedRole)}.`);
      logSecurityEvent({
        action: 'LOGIN_FAILED',
        userName: cleanUsername,
        userRole: selectedRole,
        details: `Gagal login: nama pengguna tidak ditemukan pada peran ${selectedRole}`,
        status: 'WARNING'
      });
    }
  };


  const getRoleName = (role: UserRole) => {
    switch (role) {
      case 'GURU': return 'Guru Kelas';
      case 'KEPALA_SEKOLAH': return 'Kepala Sekolah';
      case 'PENGAWAS': return 'Pengawas / Supervisor';
    }
  };

  const getRoleTheme = (role: UserRole) => {
    switch (role) {
      case 'GURU':
        return {
          primary: 'from-emerald-600 to-green-600',
          accent: 'border-emerald-500 bg-emerald-50 text-emerald-700',
          text: 'text-emerald-600',
          hover: 'hover:bg-emerald-600',
          ring: 'focus:ring-emerald-500',
          shadow: 'shadow-emerald-200'
        };
      case 'KEPALA_SEKOLAH':
        return {
          primary: 'from-teal-600 to-emerald-500',
          accent: 'border-teal-500 bg-teal-50 text-teal-700',
          text: 'text-teal-600',
          hover: 'hover:bg-teal-600',
          ring: 'focus:ring-teal-500',
          shadow: 'shadow-teal-200'
        };
      case 'PENGAWAS':
        return {
          primary: 'from-green-700 to-emerald-600',
          accent: 'border-green-500 bg-green-50 text-green-700',
          text: 'text-green-600',
          hover: 'hover:bg-green-600',
          ring: 'focus:ring-green-500',
          shadow: 'shadow-green-200'
        };
    }
  };

  const currentTheme = getRoleTheme(selectedRole);

  return (
    <div className="min-h-screen bg-[#F4F9F6] flex flex-col justify-between relative" id="landing-container">
      {/* Upper background decoration with clean green gradient */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-100/40 via-green-50/20 to-[#F4F9F6] pointer-events-none z-0" />

      {/* Credit tag at bottom right */}
      <div className="absolute bottom-20 right-4 sm:right-8 z-50 bg-white/90 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-sm" id="credit-tag">
        <span className="text-[11px] font-black text-emerald-800 tracking-wider">
          @created by suwantokapuas
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10 relative">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Visual Welcome Card with Supervision Caricature */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-full shadow-xs border border-emerald-100">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-950 tracking-wide uppercase">Sistem Penjaminan Mutu Internal</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-sans font-extrabold text-slate-900 tracking-tight leading-tight">
              ASAGK <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600">
                Aplikasi Supervisi Akademik Guru Kelas
              </span>
              <span className="block text-xl sm:text-2xl font-semibold text-slate-700 mt-2">
                Kecamatan Kapuas Kuala
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto lg:mx-0">
              Platform kolaboratif untuk memperkuat proses supervisi akademik secara praktis, terintegrasi, dan transparan antara Guru Kelas, Kepala Sekolah, serta Pengawas Korwil Bidang Pendidikan.
            </p>

            {/* Supervision Caricature Image with elegant card */}
            <div className="my-5 flex justify-center lg:justify-start">
              <div className="relative bg-white p-3 rounded-2xl border border-emerald-100 shadow-xl max-w-sm sm:max-w-md overflow-hidden hover:scale-[1.01] transition-transform duration-300">
                <picture className="w-full h-auto block">
                  <source srcSet={heroSupervisionImg} type="image/webp" />
                  <source srcSet="/supervision_caricature.webp" type="image/webp" />
                  <img
                    src={heroSupervisionImg}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.src.includes('supervision_caricature.jpg')) {
                        img.src = '/supervision_caricature.jpg';
                      }
                    }}
                    alt="Ilustrasi Supervisi Akademik Guru Kelas"
                    className="w-full h-auto rounded-xl object-cover shadow-xs"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    decoding="async"
                    width="1000"
                    height="747"
                  />
                </picture>
                <div className="absolute top-5 right-5 bg-emerald-600 text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-full shadow-md pointer-events-none">
                  Supervisi Mutu Pendidikan
                </div>
              </div>
            </div>

            {/* HIGH-IMPACT OFFICIAL MOTTO BANNER in Green Theme */}
            <div 
              className="bg-gradient-to-br from-emerald-500 via-teal-500 to-green-600 p-0.5 rounded-3xl shadow-lg shadow-emerald-100/40 max-w-xl mx-auto lg:mx-0"
              id="motto-banner"
            >
              <div className="bg-white rounded-[22px] px-6 py-4.5 flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0" id="motto-icon-box">
                  <Award className="h-8 w-8" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-extrabold text-emerald-600 tracking-wider uppercase block">Motto Pendidikan</span>
                  <h2 
                    className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-950 tracking-tight leading-tight mt-0.5"
                    id="motto-title-text"
                  >
                    PENDIDIKAN HEBAT <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600">KAPUAS BERSINAR</span>
                  </h2>
                </div>
              </div>
            </div>

            {/* Quick Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left max-w-md sm:max-w-none mx-auto lg:mx-0">
              <div className="bg-white/90 p-3.5 rounded-2xl border border-slate-100 flex items-start space-x-3 shadow-xs">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Perencanaan</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Guru menyusun agenda dan unggah RPP instan.</p>
                </div>
              </div>
              <div className="bg-white/90 p-3.5 rounded-2xl border border-slate-100 flex items-start space-x-3 shadow-xs">
                <CheckCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Validasi</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Kepala Sekolah menyetujui jadwal mengajar.</p>
                </div>
              </div>
              <div className="bg-white/90 p-3.5 rounded-2xl border border-slate-100 flex items-start space-x-3 shadow-xs">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Evaluasi</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pengawas mengisi rubrik & analisis rekap.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Login Box with Green shadow coordinate */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto space-y-6" id="login-card-container">
            <div className={`bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-2xl transition-all duration-300 ${
              selectedRole === 'GURU' 
                ? 'shadow-emerald-100/80 border-emerald-100' 
                : selectedRole === 'KEPALA_SEKOLAH' 
                ? 'shadow-teal-100/80 border-teal-100' 
                : 'shadow-green-100/80 border-green-100'
            }`}>
              
              {/* Login Header with gradient */}
              <div className={`p-6 bg-gradient-to-r ${currentTheme.primary} text-white relative`}>
                <div className="absolute right-4 top-4 opacity-15">
                  <GraduationCap className="h-24 w-24" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Portal Supervisi</h3>
                <p className="text-xs text-white/80 mt-1">Pilih peran dan masuk ke akun Anda</p>

                {/* Role Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-white/15 p-1 rounded-lg mt-5 text-xs text-center font-medium">
                  <button
                    onClick={() => setSelectedRole('GURU')}
                    className={`py-2 rounded-md transition-all cursor-pointer ${
                      selectedRole === 'GURU' 
                        ? 'bg-white text-slate-900 font-bold shadow-xs' 
                        : 'text-white hover:bg-white/10'
                    }`}
                    id="tab-role-guru"
                  >
                    Guru Kelas
                  </button>
                  <button
                    onClick={() => setSelectedRole('KEPALA_SEKOLAH')}
                    className={`py-2 rounded-md transition-all cursor-pointer ${
                      selectedRole === 'KEPALA_SEKOLAH' 
                        ? 'bg-white text-slate-900 font-bold shadow-xs' 
                        : 'text-white hover:bg-white/10'
                    }`}
                    id="tab-role-kepsek"
                  >
                    Kepsek
                  </button>
                  <button
                    onClick={() => setSelectedRole('PENGAWAS')}
                    className={`py-2 rounded-md transition-all cursor-pointer ${
                      selectedRole === 'PENGAWAS' 
                        ? 'bg-white text-slate-900 font-bold shadow-xs' 
                        : 'text-white hover:bg-white/10'
                    }`}
                    id="tab-role-pengawas"
                  >
                    Supervisor
                  </button>
                </div>
              </div>

              {/* Login Form Body */}
              <div className="p-6">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  {loginError && (
                    <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-200 flex items-start space-x-2" id="login-error-alert">
                      <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Pengguna (Username)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-hidden focus:ring-2 ${currentTheme.ring} focus:border-transparent transition-all`}
                        placeholder="Masukkan nama pengguna"
                        id="input-username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Kata Sandi</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className={`w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-hidden focus:ring-2 ${currentTheme.ring} focus:border-transparent transition-all`}
                        placeholder="••••••••"
                        id="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {lockoutRemaining > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center space-x-2 animate-pulse">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                      <span className="font-bold">
                        Rate Limit Aktif: Terkunci {lockoutRemaining} detik
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={lockoutRemaining > 0}
                    className={`w-full py-3.5 px-4 bg-gradient-to-r ${currentTheme.primary} hover:opacity-95 text-white text-sm font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2 shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                    id="btn-login-submit"
                  >
                    <span>{lockoutRemaining > 0 ? `Terkunci (${lockoutRemaining}s)` : `Masuk sebagai ${getRoleName(selectedRole)}`}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="relative my-3 flex items-center justify-center">
                    <div className="border-t border-slate-200 w-full"></div>
                    <span className="bg-white px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider absolute">atau</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading}
                    className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 text-xs font-semibold rounded-2xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    id="btn-google-login"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{isGoogleLoading ? 'Memproses Masuk...' : 'Masuk dengan Akun Google (Firebase)'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* NEW SEARCH & DOWNLOAD REPORT CARD */}
            <div 
              className="bg-white rounded-3xl border-2 border-slate-150 overflow-hidden shadow-xl p-6 hover:border-emerald-200 transition-all duration-300" 
              id="search-report-card"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0" id="search-card-icon-box">
                  <Search className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight leading-tight">Cari & Unduh Raport</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Masyarakat / Guru / Kepala Sekolah</p>
                </div>
              </div>
              
              <p className="text-xs text-slate-600 mb-4 leading-relaxed text-left">
                Masukkan Nomor Registrasi resmi (Contoh: <code className="font-mono bg-slate-100 text-emerald-800 px-1 py-0.5 rounded">ASAGK/001/2026</code> - Rentang 001 s/d 100/2026) atau ID Evaluasi untuk mengunduh raport supervisi akademik dalam format PDF.
              </p>

              <form onSubmit={handleSearchSubmit} className="space-y-3.5">
                {searchError && (
                  <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-2xl border border-amber-200 text-left" id="search-error-alert">
                    {searchError}
                  </div>
                )}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={searchReportId}
                    onChange={(e) => {
                      setSearchReportId(e.target.value);
                      setSearchError('');
                    }}
                    placeholder="Contoh: ASAGK/001/2026 atau 001"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
                    id="input-search-report-id"
                  />
                </div>

                {evaluations && evaluations.length > 0 && (
                  <div className="text-left space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilih Nomor Registrasi Aktif (001 s/d 100 / 2026):</span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {evaluations.map((ev) => {
                        const fullReg = getFullRegistrationNumber(ev, evaluations);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => {
                              setSearchReportId(fullReg);
                              setSearchError('');
                            }}
                            className="text-[9.5px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-mono px-2 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            title={`Milik Guru: ${ev.teacherName}`}
                          >
                            {fullReg}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  id="btn-search-report-submit"
                >
                  <Download className="h-4 w-4" />
                  <span>UNDUH PDF (TAB BARU)</span>
                </button>

                <button
                  type="button"
                  onClick={() => openSearchModal()}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-emerald-400 text-xs font-extrabold rounded-2xl border border-emerald-500/30 shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  id="btn-open-popup-search"
                >
                  <ExternalLink className="h-4 w-4 text-emerald-400" />
                  <span>BUKA POP-UP CARI & UNDUH RAPORT</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* POP UP MODAL CARI & UNDUH RAPORT HASIL SUPERVISI */}
      {showSearchModal && (
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          id="search-report-modal"
          onClick={() => setShowSearchModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-green-800 text-white p-6 relative shrink-0">
              <button
                onClick={() => setShowSearchModal(false)}
                className="absolute top-5 right-5 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                id="btn-close-search-modal"
                title="Tutup Modal"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl">
                  <FileCheck className="h-7 w-7 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Pop Up Cari & Unduh Raport</h3>
                  <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                    Referensi Nomor Registrasi Resmi & Konstan (001 s/d 100 / 2026)
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Reference list of constant registration numbers */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Nomor Registrasi Resmi & Konstan (Rentang 001 s/d 100 / 2026):
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    {evaluations.length} Berkas
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {evaluations.map((ev) => {
                    const fullReg = getFullRegistrationNumber(ev, evaluations);
                    const isSelected = modalSearchQuery.trim().toLowerCase() === fullReg.toLowerCase() || modalSearchQuery.trim().toLowerCase() === ev.id.toLowerCase();
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setModalSearchQuery(fullReg)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400' 
                            : 'bg-white hover:bg-emerald-100/50 text-slate-800 border-emerald-200 shadow-2xs'
                        }`}
                        id={`btn-modal-reg-${ev.id}`}
                      >
                        <span className={`font-mono text-xs font-bold ${isSelected ? 'text-white' : 'text-emerald-900'}`}>
                          {fullReg}
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                          <span className={`text-[11px] truncate ${isSelected ? 'text-emerald-100 font-medium' : 'text-slate-600'}`}>
                            {ev.teacherName}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-700'}`}>
                            {ev.schoolName.split(' ')[0]} {ev.schoolName.split(' ')[1] || ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Search Box inside Modal */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Ketik atau Tempel Nomor Registrasi / ID Evaluasi:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="Contoh: ASAGK/001/2026 atau 001"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-2xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    id="input-search-report-id-modal"
                  />
                  {modalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setModalSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Evaluation Match Result Preview */}
              {(() => {
                const matched = normalizeAndFindEvaluation(modalSearchQuery, evaluations);
                if (matched) {
                  const fullReg = getFullRegistrationNumber(matched, evaluations);
                  return (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4 animate-fadeIn" id="modal-search-result-box">
                      <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                        <div>
                          <span className="text-[10px] font-extrabold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded uppercase tracking-wider">
                            DITEMUKAN & VALID
                          </span>
                          <h4 className="text-base font-black font-mono text-emerald-300 mt-1">
                            {fullReg}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Nilai Akhir</span>
                          <span className="text-xl font-black text-amber-400">
                            {matched.finalScore}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400 block">
                            ({matched.predicate.replace('_', ' ')})
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Nama Guru</span>
                          <span className="font-bold text-slate-100">{matched.teacherName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Satuan Pendidikan</span>
                          <span className="font-bold text-slate-100">{matched.schoolName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Mata Pelajaran & Topik</span>
                          <span className="font-medium text-slate-200">{matched.subject} - {matched.topic}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Pengawas Evaluator</span>
                          <span className="font-medium text-slate-200">{matched.supervisorName}</span>
                        </div>
                      </div>

                      {/* Action buttons inside result preview */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?raport=${matched.id}&print=true`;
                            window.open(url, '_blank');
                          }}
                          className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                          id="btn-modal-download-pdf"
                        >
                          <Download className="h-4 w-4" />
                          <span>UNDUH PDF RAPORT (TAB BARU)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowSearchModal(false);
                            if (onViewRaport) {
                              onViewRaport(matched.id);
                            } else {
                              const url = `${window.location.origin}${window.location.pathname}?raport=${matched.id}`;
                              window.open(url, '_blank');
                            }
                          }}
                          className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                          id="btn-modal-view-raport"
                        >
                          <Eye className="h-4 w-4" />
                          <span>LIHAT HALAMAN PENUH</span>
                        </button>
                      </div>
                    </div>
                  );
                } else if (modalSearchQuery.trim()) {
                  return (
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl border border-amber-200 text-xs text-center space-y-1">
                      <p className="font-bold">Nomor Registrasi "{modalSearchQuery}" tidak ditemukan.</p>
                      <p className="text-[11px] text-amber-700">Silakan klik salah satu tombol Nomor Registrasi Konstan di atas untuk langsung melihat dan mengunduh berkas PDF.</p>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-slate-50 text-slate-500 p-4 rounded-2xl border border-slate-200 text-xs text-center">
                      Pilih salah satu nomor registrasi resmi di atas atau ketik nomor registrasi untuk menampilkan pratinjau raport supervisi.
                    </div>
                  );
                }
              })()}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="font-semibold text-slate-600">ASAGK Kecamatan Kapuas Kuala</span>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="bg-slate-900 px-6 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between text-slate-400 text-xs shrink-0 z-10 gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-center sm:text-left">
          <span className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Sistem Online: 12 Sekolah Aktif
          </span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span>Dinas Pendidikan Kabupaten Kapuas</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a>
          <span>&bull;</span>
          <a href="#" className="hover:text-white transition-colors">Panduan Pengguna</a>
          <span>&bull;</span>
          <span className="text-slate-400 font-medium text-[11px]">@created by suwantokapuas</span>
        </div>
      </footer>
    </div>
  );
}
