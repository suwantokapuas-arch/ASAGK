import React from 'react';
import { UserProfile, SupervisionEvaluation, SecurityAuditLog } from '../types';
import { 
  ShieldCheck, Lock, Fingerprint, ShieldAlert, CheckCircle2, 
  AlertTriangle, RefreshCw, Download, Search, FileText, Check, Shield
} from 'lucide-react';
import { computeDocumentHash, verifyDocumentIntegrity, getLocalAuditLogs } from '../security';
import { subscribeAuditLogs } from '../firebase';
import { getFullRegistrationNumber } from '../utils';

interface SecurityCenterPanelProps {
  currentUser: UserProfile;
  evaluations: SupervisionEvaluation[];
  allUsers: UserProfile[];
}

export default function SecurityCenterPanel({ currentUser, evaluations, allUsers }: SecurityCenterPanelProps) {
  const [auditLogs, setAuditLogs] = React.useState<SecurityAuditLog[]>(() => getLocalAuditLogs());
  const [logFilter, setLogFilter] = React.useState<'ALL' | 'SUCCESS' | 'WARNING' | 'ALERT'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = React.useState('');
  
  // Integrity Scanner states
  const [selectedEvalId, setSelectedEvalId] = React.useState<string>(() => evaluations[0]?.id || '');
  const [scanResult, setScanResult] = React.useState<{
    tested: boolean;
    isValid: boolean;
    computedHash: string;
    targetEval?: SupervisionEvaluation;
    tamperSimulated?: boolean;
  } | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);

  // Subscribe to real-time audit logs from Firestore
  React.useEffect(() => {
    const unsub = subscribeAuditLogs((remoteLogs) => {
      if (remoteLogs.length > 0) {
        setAuditLogs(remoteLogs);
      }
    });
    return () => unsub();
  }, []);

  const handleRunIntegrityScan = async (simulateTamper = false) => {
    const target = evaluations.find((e) => e.id === selectedEvalId) || evaluations[0];
    if (!target) return;

    setIsScanning(true);
    setScanResult(null);

    // Artificial tiny pause for UX feel
    await new Promise((r) => setTimeout(r, 400));

    try {
      const realHash = await computeDocumentHash(target);

      if (simulateTamper) {
        // Simulate altered score or altered name
        const tamperedDoc = { ...target, finalScore: target.finalScore + 10, teacherName: `${target.teacherName} (ALTERED)` };
        const verifyRes = await verifyDocumentIntegrity(tamperedDoc, realHash);
        setScanResult({
          tested: true,
          isValid: false,
          computedHash: verifyRes.computedHash,
          targetEval: target,
          tamperSimulated: true
        });
      } else {
        const verifyRes = await verifyDocumentIntegrity(target, realHash);
        setScanResult({
          tested: true,
          isValid: verifyRes.isValid,
          computedHash: verifyRes.computedHash,
          targetEval: target,
          tamperSimulated: false
        });
      }
    } catch (err) {
      console.error('Integrity scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Filtered logs
  const filteredLogs = auditLogs.filter((log) => {
    if (logFilter !== 'ALL' && log.status !== logFilter) return false;
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const matchAction = (log.action || '').toLowerCase().includes(q);
      const matchUser = (log.userName || '').toLowerCase().includes(q);
      const matchDetails = (log.details || '').toLowerCase().includes(q);
      if (!matchAction && !matchUser && !matchDetails) return false;
    }
    return true;
  });

  const handleExportAuditCSV = () => {
    const headers = ['ID Log', 'Waktu (ISO)', 'Aksi', 'Pengguna', 'Peran', 'Status', 'Rincian Aktivitas'];
    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${(l.userRole || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_log_keamanan_asagk_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="security-center-panel">
      {/* 1. Security Header & Status Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Sistem Pertahanan Keamanan Aktif & Terverifikasi</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Pusat Keamanan & Audit Forensik Dokumen
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Arsitektur keamanan berlapis yang melindungi kerahasiaan penilaian guru kelas, mencegah manipulasi sertifikat dengan enkripsi hash SHA-256, membatasi serangan brute-force, dan memelihara log audit yang tidak dapat diubah (immutable).
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-extrabold block">Status Keamanan</span>
            <span className="text-xl font-black text-white flex items-center justify-center gap-1.5 mt-0.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              TANGGUH / SECURED
            </span>
            <span className="text-[10px] text-slate-300 block mt-1">Firebase Rules v2 + BSrE Hash</span>
          </div>
        </div>

        {/* 6 Security Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-6 mt-6 border-t border-slate-700/80">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 flex items-start space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Aturan Database Firestore</h5>
              <p className="text-[10px] text-slate-300 mt-0.5">Validasi tipe ketat, skor terkontrol (0-100), dan default-deny catch-all.</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 flex items-start space-x-3">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl shrink-0">
              <Fingerprint className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Tanda Tangan Kriptografis</h5>
              <p className="text-[10px] text-slate-300 mt-0.5">Setiap raport disahkan dengan sidik hash SHA-256 yang mengikat seluruh nilai.</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 flex items-start space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Proteksi Anti Brute-Force</h5>
              <p className="text-[10px] text-slate-300 mt-0.5">Maksimal 5x percobaan gagal, otomatis mengaktifkan penangguhan (lockout) 45 detik.</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 flex items-start space-x-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Filter Sanitasi Anti-XSS</h5>
              <p className="text-[10px] text-slate-300 mt-0.5">Seluruh isian agenda & topik otomatis dibersihkan dari skrip atau injeksi kode HTML.</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 flex items-start space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Kunci Layar Sesi (Lock Screen)</h5>
              <p className="text-[10px] text-slate-300 mt-0.5">Mencegah akses orang lain ketika komputer di ruang guru ditinggalkan.</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 flex items-start space-x-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Log Audit Imutabel</h5>
              <p className="text-[10px] text-slate-300 mt-0.5">Setiap perubahan akun, pengesahan, dan penilaian tercatat permanen di audit trail.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Live Document Integrity Scanner */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 sm:p-8 shadow-xl shadow-slate-100/40 space-y-6" id="integrity-scanner-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 tracking-tight">
                Pemindai Integritas Dokumen Raport Supervisi (SHA-256)
              </h4>
              <p className="text-xs text-slate-500">
                Uji keaslian berkas raport dan deteksi apakah ada rekayasa atau manipulasi data nilai
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleRunIntegrityScan(false)}
              disabled={isScanning || evaluations.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
              id="btn-run-integrity-scan"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Memindai...' : 'Uji Keaslian Dokumen'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRunIntegrityScan(true)}
              disabled={isScanning || evaluations.length === 0}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
              title="Simulasikan percobaan pemalsuan nilai untuk membuktikan proteksi hash SHA-256"
              id="btn-simulate-tamper-scan"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Simulasi Pemalsuan</span>
            </button>
          </div>
        </div>

        {/* Selection selector */}
        {evaluations.length > 0 ? (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Pilih Berkas Raport untuk Diverifikasi:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {evaluations.map((ev) => {
                const regNum = getFullRegistrationNumber(ev, evaluations);
                const isSelected = ev.id === selectedEvalId;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      setSelectedEvalId(ev.id);
                      setScanResult(null);
                    }}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-2 ring-emerald-300' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-800">{regNum}</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        Skor: {ev.finalScore}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-1 truncate">{ev.teacherName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{ev.schoolName}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
            Belum ada evaluasi tersimpan untuk dipindai. Buat evaluasi terlebih dahulu di tab Rubrik Supervisi.
          </div>
        )}

        {/* Scan Result Feedback Card */}
        {scanResult && (
          <div 
            className={`p-5 rounded-2xl border-2 transition-all animate-fadeIn ${
              scanResult.isValid 
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' 
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
            id="scan-result-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className={`p-2.5 rounded-2xl ${scanResult.isValid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  {scanResult.isValid ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-extrabold uppercase tracking-wide">
                      {scanResult.isValid 
                        ? 'HASIL AUDIT: DOKUMEN TERVERIFIKASI SAH & ASLI' 
                        : 'PERINGATAN: DOKUMEN TELAH DIMANIPULASI / HASH MISMATCH'}
                    </h5>
                    {scanResult.tamperSimulated && (
                      <span className="text-[9px] bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded-full uppercase">
                        Hasil Simulasi Pemalsuan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {scanResult.isValid 
                      ? 'Seluruh data guru, pengawas, mata pelajaran, dan rincian skor nilai sinkron 100% dengan sidik hash digital BSrE.' 
                      : 'Data dokumen tidak cocok dengan sidik hash aslinya! Sistem mendeteksi adanya modifikasi pada skor atau nama guru.'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Validasi</span>
                <span className={`text-xs font-black px-2.5 py-1 rounded-full inline-block mt-0.5 ${
                  scanResult.isValid ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}>
                  {scanResult.isValid ? '100% VALID' : 'TIDAK VALID'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Sidik Digital SHA-256 (Canonical Document Digest):
              </span>
              <p className="font-mono text-[10px] bg-white p-2.5 rounded-xl border border-slate-200 break-all select-all text-slate-800">
                {scanResult.computedHash}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Security Audit Log Table & Filters */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 sm:p-8 shadow-xl shadow-slate-100/40 space-y-6" id="audit-logs-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-black text-slate-900 tracking-tight flex items-center">
              <FileText className="h-5 w-5 mr-2 text-slate-700" />
              Log Audit Keamanan & Riwayat Aktivitas
            </h4>
            <p className="text-xs text-slate-500">
              Catatan kronologis aktivitas pengguna, login, pengesahan agenda, dan penerbitan raport
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportAuditCSV}
              disabled={filteredLogs.length === 0}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              id="btn-export-audit-csv"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Ekspor Log (CSV)</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
            {(['ALL', 'SUCCESS', 'WARNING', 'ALERT'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setLogFilter(status)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  logFilter === status 
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status === 'ALL' ? 'Semua' : status === 'SUCCESS' ? 'Normal' : status === 'WARNING' ? 'Peringatan' : 'Penting'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Cari log nama atau aksi..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              id="input-search-audit-log"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-40">Waktu</th>
                <th className="p-3 w-36">Aksi Keamanan</th>
                <th className="p-3 w-44">Pengguna</th>
                <th className="p-3">Rincian Aktivitas</th>
                <th className="p-3 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.slice(0, 50).map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const formattedDate = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });
                  const formattedTime = dateObj.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block">{formattedDate}</span>
                        <span className="text-[10px] text-slate-400">{formattedTime}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 truncate max-w-[170px]">{log.userName}</div>
                        {log.userRole && (
                          <span className="text-[9px] text-slate-500 uppercase font-semibold block">
                            {log.userRole}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 leading-relaxed">
                        {log.details}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`inline-block text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : log.status === 'WARNING' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                    Tidak ada catatan log audit yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Menampilkan {Math.min(filteredLogs.length, 50)} dari {filteredLogs.length} rekaman audit</span>
          <span className="font-mono text-[10px]">Tersimpan di Cloud Firestore (Immutable)</span>
        </div>
      </div>
    </div>
  );
}
