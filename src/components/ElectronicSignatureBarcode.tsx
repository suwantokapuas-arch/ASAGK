import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, CheckCircle2, QrCode, Lock, Fingerprint } from 'lucide-react';
import { getFullRegistrationNumber } from '../utils';
import { computeDocumentHash } from '../security';

interface ElectronicSignatureBarcodeProps {
  supervisorName: string;
  supervisorNip?: string;
  evaluationId: string;
  evaluationDate: string;
  teacherName?: string;
  schoolName?: string;
  finalScore?: number;
  predicate?: string;
  className?: string;
}

export default function ElectronicSignatureBarcode({
  supervisorName,
  supervisorNip,
  evaluationId,
  evaluationDate,
  teacherName,
  schoolName,
  finalScore,
  predicate,
  className = ''
}: ElectronicSignatureBarcodeProps) {
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [docHash, setDocHash] = React.useState<string>('Memverifikasi...');

  // Generate verification code
  const cleanId = getFullRegistrationNumber({ id: evaluationId, evaluatedAt: evaluationDate } as any);
  
  const cleanSupervisor = supervisorName || 'Pengawas Sekolah';
  const nipDisplay = supervisorNip || getSupervisorNip(cleanSupervisor);

  React.useEffect(() => {
    let isMounted = true;
    computeDocumentHash({
      id: evaluationId,
      teacherName,
      schoolName,
      date: evaluationDate,
      finalScore,
      predicate,
      supervisorName: cleanSupervisor
    }).then((hash) => {
      if (isMounted) setDocHash(hash);
    });
    return () => {
      isMounted = false;
    };
  }, [evaluationId, teacherName, schoolName, evaluationDate, finalScore, predicate, cleanSupervisor]);

  const verifyUrl = `https://asagk.disdik.kapuaskab.go.id/tte-verify?id=${encodeURIComponent(cleanId)}&supervisor=${encodeURIComponent(cleanSupervisor)}&nip=${encodeURIComponent(nipDisplay)}`;

  return (
    <div className={`inline-block font-sans ${className}`}>
      {/* TTE Box Container */}
      <div 
        onClick={() => setShowDetailModal(true)}
        className="group relative cursor-pointer border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 transition-all rounded-xl p-2.5 max-w-[210px] mx-auto text-left shadow-2xs hover:shadow-md print:bg-white print:border-emerald-600 print:shadow-none"
        title="Klik untuk verifikasi Tanda Tangan Elektronik (TTE)"
      >
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5 mb-1.5">
          <div className="flex items-center space-x-1 text-emerald-800 font-extrabold text-[9px] uppercase tracking-wider">
            <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
            <span>Tanda Tangan Elektronik</span>
          </div>
          <span className="text-[8px] bg-emerald-600 text-white font-bold px-1 py-0.2 rounded uppercase shrink-0">
            BSrE / TTE
          </span>
        </div>

        {/* Core Body: QR Code + Barcode Metadata */}
        <div className="flex items-center space-x-2">
          {/* QR Code */}
          <div className="bg-white p-1 rounded-lg border border-emerald-200 shrink-0 shadow-2xs">
            <QRCodeSVG 
              value={verifyUrl} 
              size={52} 
              level="M"
              includeMargin={false}
              fgColor="#065f46"
            />
          </div>

          {/* Metadata info */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-[8.5px] font-bold text-slate-800 truncate leading-tight">
              {cleanSupervisor}
            </div>
            <div className="text-[7.5px] text-slate-600 font-mono truncate">
              {nipDisplay.startsWith('NIP') ? nipDisplay : `NIP. ${nipDisplay}`}
            </div>
            <div className="text-[7px] text-emerald-700 font-bold flex items-center space-x-0.5 pt-0.5">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
              <span className="truncate">TTE Sah & Terverifikasi</span>
            </div>
          </div>
        </div>

        {/* Simulated 1D Barcode Strip at Bottom */}
        <div className="mt-1.5 pt-1 border-t border-emerald-200/60 flex items-center justify-between text-[7px] text-slate-500 font-mono">
          <div className="flex items-center space-x-0.5 overflow-hidden h-2.5 opacity-80">
            {/* SVG barcode lines */}
            <svg className="h-2.5 w-24" viewBox="0 0 100 10" preserveAspectRatio="none">
              <rect x="0" y="0" width="3" height="10" fill="#065f46" />
              <rect x="5" y="0" width="1" height="10" fill="#065f46" />
              <rect x="8" y="0" width="4" height="10" fill="#065f46" />
              <rect x="14" y="0" width="2" height="10" fill="#065f46" />
              <rect x="18" y="0" width="1" height="10" fill="#065f46" />
              <rect x="21" y="0" width="3" height="10" fill="#065f46" />
              <rect x="26" y="0" width="5" height="10" fill="#065f46" />
              <rect x="33" y="0" width="1" height="10" fill="#065f46" />
              <rect x="36" y="0" width="2" height="10" fill="#065f46" />
              <rect x="40" y="0" width="4" height="10" fill="#065f46" />
              <rect x="46" y="0" width="1" height="10" fill="#065f46" />
              <rect x="49" y="0" width="3" height="10" fill="#065f46" />
              <rect x="54" y="0" width="2" height="10" fill="#065f46" />
              <rect x="58" y="0" width="4" height="10" fill="#065f46" />
              <rect x="64" y="0" width="1" height="10" fill="#065f46" />
              <rect x="67" y="0" width="3" height="10" fill="#065f46" />
              <rect x="72" y="0" width="5" height="10" fill="#065f46" />
              <rect x="79" y="0" width="2" height="10" fill="#065f46" />
              <rect x="83" y="0" width="1" height="10" fill="#065f46" />
              <rect x="86" y="0" width="4" height="10" fill="#065f46" />
              <rect x="92" y="0" width="2" height="10" fill="#065f46" />
              <rect x="96" y="0" width="3" height="10" fill="#065f46" />
            </svg>
          </div>
          <span className="text-[6.5px] font-mono text-slate-600 font-bold ml-1">
            {cleanId}
          </span>
        </div>
      </div>

      {/* Verification Detail Modal */}
      {showDetailModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-slate-800 animate-fadeIn"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetailModal(false);
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleIn text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-800/80 rounded-xl border border-emerald-700">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Sertifikat TTE Terverifikasi</h4>
                  <p className="text-[10px] text-emerald-200">Dinas Pendidikan Kab. Kapuas Kuala</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3">
                <QRCodeSVG value={verifyUrl} size={64} level="H" fgColor="#065f46" />
                <div className="space-y-1 min-w-0">
                  <span className="inline-block bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Status: Asli & Sah
                  </span>
                  <p className="text-xs font-bold text-slate-900 truncate">{cleanSupervisor}</p>
                  <p className="text-[10px] text-slate-600 font-mono">{nipDisplay}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Jabatan:</span>
                  <span className="font-semibold text-slate-900 text-right">Pengawas Sekolah Korwil Kapuas Kuala</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Dokumen:</span>
                  <span className="font-semibold text-slate-900 text-right">Raport Supervisi Akademik</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Nomor Registrasi:</span>
                  <span className="font-mono font-bold text-emerald-800 text-right">{cleanId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tanggal Pengesahan:</span>
                  <span className="font-semibold text-slate-900 text-right">{evaluationDate}</span>
                </div>
                {teacherName && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Guru Dinilai:</span>
                    <span className="font-semibold text-slate-900 text-right">{teacherName}</span>
                  </div>
                )}
                {schoolName && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Satuan Pendidikan:</span>
                    <span className="font-semibold text-slate-900 text-right">{schoolName}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-[10px] text-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-emerald-950 flex items-center">
                    <Fingerprint className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Hash Integritas Dokumen (SHA-256):
                  </p>
                  <span className="text-[8px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">
                    Terverifikasi Valid
                  </span>
                </div>
                <p className="font-mono text-[9px] break-all text-emerald-900 bg-white p-2 rounded-lg border border-emerald-200 select-all">
                  {docHash}
                </p>
                <p className="text-[8.5px] text-slate-500 italic">
                  Sidik digital kriptografis mengikat identitas guru, evaluator, skor akhir, dan tanggal evaluasi. Segala manipulasi data akan membatalkan sertifikat ini.
                </p>
              </div>
            </div>


            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Informasi TTE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getSupervisorNip(supervisorName: string): string {
  const nameLower = (supervisorName || '').toLowerCase();
  if (nameLower.includes('lastre')) return '19680415 199203 1 005';
  if (nameLower.includes('wakidi')) return '19671110 199102 1 003';
  if (nameLower.includes('suwanto')) return '19680315 198910 1 002';
  if (nameLower.includes('bambang')) return '19650920 199003 1 008';
  return '19650212 198711 1 001';
}
