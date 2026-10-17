import React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { SupervisionEvaluation, RubricCategory, UserProfile } from '../types';
import { RUBRIC_CATEGORIES } from '../data/mockData';
import { getFullRegistrationNumber } from '../utils';
import { FileText, Download, Printer, ArrowLeft, Check, Award, MapPin, Calendar, User, Trash2 } from 'lucide-react';
import ElectronicSignatureBarcode from './ElectronicSignatureBarcode';

interface FullPageReportProps {
  evaluation: SupervisionEvaluation;
  allUsers?: UserProfile[];
  onClose: () => void;
  onDeleteEvaluation?: (evalId: string) => void;
}

function convertOklchInString(cssText: string): string {
  return cssText.replace(/oklch\(([^)]+)\)/g, (match, inner) => {
    try {
      const parts = inner.trim().split(/[\s,/\s]+/).filter(Boolean);
      if (parts.length < 3) return '#64748b'; // default slate fallback if invalid
      
      let l = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
      let c = parts[1].endsWith('%') ? parseFloat(parts[1]) / 100 : parseFloat(parts[1]);
      let h = parts[2].endsWith('deg') ? parseFloat(parts[2]) : parseFloat(parts[2]);
      
      if (parts[2].endsWith('rad')) {
        h = parseFloat(parts[2]) * (180 / Math.PI);
      } else if (parts[2].endsWith('turn')) {
        h = parseFloat(parts[2]) * 360;
      }

      let a = 1;
      if (parts[3] !== undefined) {
        a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      }

      // Convert OKLCH to RGB
      const hRad = (h * Math.PI) / 180;
      const a_lab = c * Math.cos(hRad);
      const b_lab = c * Math.sin(hRad);

      const l_ = l + 0.3963377774 * a_lab + 0.2158037573 * b_lab;
      const m_ = l - 0.1055613458 * a_lab - 0.0638541728 * b_lab;
      const s_ = l - 0.0894841775 * a_lab - 1.2914855480 * b_lab;

      const l_cube = l_ * l_ * l_;
      const m_cube = m_ * m_ * m_;
      const s_cube = s_ * s_ * s_;

      const r_line = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
      const g_line = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
      const b_line = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;

      const toSRGB = (val: number) => {
        return val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
      };

      const r = Math.max(0, Math.min(255, Math.round(toSRGB(r_line) * 255)));
      const g = Math.max(0, Math.min(255, Math.round(toSRGB(g_line) * 255)));
      const b = Math.max(0, Math.min(255, Math.round(toSRGB(b_line) * 255)));

      if (a !== 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    } catch (e) {
      console.warn('Oklch parse error:', e);
      return '#64748b'; // Fallback
    }
  });
}

const loadHtml2Pdf = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) {
      resolve((window as any).html2pdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      resolve((window as any).html2pdf);
    };
    script.onerror = (err) => {
      reject(err);
    };
    document.body.appendChild(script);
  });
};

export default function FullPageReport({ evaluation, allUsers, onClose, onDeleteEvaluation }: FullPageReportProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);

  // Dynamic user resolution from allUsers
  const teacherUser = (allUsers || []).find(
    (u) => u.id === evaluation.teacherId || u.name.toLowerCase() === evaluation.teacherName.toLowerCase()
  );
  const teacherName = teacherUser?.name || evaluation.teacherName;
  const teacherNip = teacherUser?.nip ? `NIP. ${teacherUser.nip}` : 'NIP. 19701104 199303 2 003';
  const schoolName = teacherUser?.schoolName || evaluation.schoolName;

  const kepsekUser = (allUsers || []).find(
    (u) => u.role === 'KEPALA_SEKOLAH' && u.schoolName === schoolName
  ) || (allUsers || []).find((u) => u.role === 'KEPALA_SEKOLAH');
  const kepsekName = kepsekUser?.name || 'Suwanto, S.Pd.SD';
  const kepsekNip = kepsekUser?.nip ? `NIP. ${kepsekUser.nip}` : 'NIP. 19680315 198910 1 002';

  const pengawasUser = (allUsers || []).find(
    (u) => u.role === 'PENGAWAS' && u.name.toLowerCase() === evaluation.supervisorName.toLowerCase()
  ) || (allUsers || []).find((u) => u.role === 'PENGAWAS');
  const supervisorName = pengawasUser?.name || evaluation.supervisorName;
  const supervisorNip = pengawasUser?.nip || '19650212 198711 1 001';
  const supervisorNipFormatted = supervisorNip.startsWith('NIP') ? supervisorNip : `NIP. ${supervisorNip}`;

  const getPredicateLabel = (pred: string) => {
    switch (pred) {
      case 'SANGAT_BAIK': return 'SANGAT BAIK (Skor 91-100)';
      case 'BAIK': return 'BAIK (Skor 81-90)';
      case 'CUKUP': return 'CUKUP (Skor 71-80)';
      case 'PERLU_BIMBINGAN': return 'PERLU BIMBINGAN (Skor <71)';
      default: return pred;
    }
  };

  const getPredicateBadge = (pred: string) => {
    switch (pred) {
      case 'SANGAT_BAIK': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'BAIK': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CUKUP': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PERLU_BIMBINGAN': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleDownloadPdf = async (shouldOpenTab = false) => {
    setIsDownloading(true);

    let pdfTab: Window | null = null;
    if (shouldOpenTab) {
      try {
        pdfTab = window.open('', '_blank');
        if (pdfTab) {
          pdfTab.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Menyiapkan Berkas PDF - ASAGK</title>
                <meta charset="utf-8">
              </head>
              <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
                <div style="text-align: center; padding: 32px; background: #1e293b; border-radius: 20px; border: 1px solid #334155; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
                  <div style="width: 48px; height: 48px; border: 4px solid #10b981; border-top-color: transparent; border-radius: 50%; margin: 0 auto 16px; animation: spin 0.8s linear infinite;"></div>
                  <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                  <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #34d399;">Membuka Berkas PDF Laporan</h2>
                  <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5;">Mohon tunggu, dokumen PDF resmi Laporan Hasil Supervisi Akademik sedang disiapkan...</p>
                </div>
              </body>
            </html>
          `);
        }
      } catch (e) {
        console.warn('Could not open initial PDF window:', e);
      }
    }

    const safeTeacherName = evaluation.teacherName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSchoolName = evaluation.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Laporan_Supervisi_${safeTeacherName}_${safeSchoolName}.pdf`;

    try {
      const element = document.getElementById('printable-report-full');
      if (!element) {
        alert('Elemen laporan tidak ditemukan.');
        if (pdfTab && !pdfTab.closed) pdfTab.close();
        setIsDownloading(false);
        return;
      }

      const html2pdfLib = await loadHtml2Pdf();
      const opt = {
        margin:       [12, 12, 12, 12], // mm margins
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight,
          onclone: (clonedDoc: any) => {
            try {
              let cssString = '';
              const sheets = document.styleSheets;
              for (let i = 0; i < sheets.length; i++) {
                try {
                  const rules = sheets[i].cssRules || sheets[i].rules;
                  if (rules) {
                    for (let j = 0; j < rules.length; j++) {
                      cssString += rules[j].cssText + '\n';
                    }
                  }
                } catch (sheetErr) {
                  // Ignore cross-origin sheet access
                }
              }

              const cleanCss = convertOklchInString(cssString);
              const head = clonedDoc.head || clonedDoc.getElementsByTagName('head')[0];
              if (head) {
                const styles = clonedDoc.getElementsByTagName('style');
                while (styles.length > 0) {
                  styles[0].parentNode?.removeChild(styles[0]);
                }
                const links = clonedDoc.getElementsByTagName('link');
                for (let i = links.length - 1; i >= 0; i--) {
                  if (links[i].getAttribute('rel') === 'stylesheet') {
                    links[i].parentNode?.removeChild(links[i]);
                  }
                }

                const newStyle = clonedDoc.createElement('style');
                newStyle.setAttribute('type', 'text/css');
                newStyle.appendChild(clonedDoc.createTextNode(cleanCss));
                head.appendChild(newStyle);
              }
            } catch (err) {
              console.error('Error rewriting stylesheets in full page download:', err);
            }
          }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const pdfObj = await html2pdfLib()
        .set(opt)
        .from(element)
        .toPdf()
        .get('pdf');

      const dataUri = pdfObj.output('datauristring');
      const blob = pdfObj.output('blob');
      const blobUrl = URL.createObjectURL(blob);

      if (pdfTab && !pdfTab.closed) {
        pdfTab.document.title = filename;
        pdfTab.document.body.style.margin = '0';
        pdfTab.document.body.style.padding = '0';
        pdfTab.document.body.style.backgroundColor = '#0f172a';
        pdfTab.document.body.style.overflow = 'hidden';
        pdfTab.document.body.innerHTML = `
          <div style="display: flex; flex-direction: column; height: 100vh; width: 100vw; background: #0f172a; color: #ffffff; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: #1e293b; border-bottom: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="background: #10b981; color: #ffffff; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-size: 12px; letter-spacing: 0.5px;">BERKAS PDF TERSEDIA</div>
                <span style="font-weight: 600; font-size: 14px; color: #f1f5f9;">${filename}</span>
              </div>
              <div style="display: flex; gap: 10px;">
                <a href="${blobUrl}" download="${filename}" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                  <span>⬇ SIMPAN BERKAS PDF</span>
                </a>
              </div>
            </div>
            <div style="flex: 1; width: 100%; height: calc(100vh - 57px); background: #334155;">
              <object data="${dataUri}" type="application/pdf" style="width: 100%; height: 100%; border: none;">
                <iframe src="${dataUri}" style="width: 100%; height: 100%; border: none;" title="${filename}">
                  <div style="padding: 32px; text-align: center; color: #f8fafc;">
                    <p style="font-size: 16px; margin-bottom: 16px;">Dokumen PDF ${filename} telah siap.</p>
                    <a href="${blobUrl}" download="${filename}" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Unduh Berkas PDF Sekarang</a>
                  </div>
                </iframe>
              </object>
            </div>
          </div>
        `;
      } else {
        try {
          const win = window.open('', '_blank');
          if (win) {
            win.document.title = filename;
            win.document.body.style.margin = '0';
            win.document.body.style.padding = '0';
            win.document.body.style.backgroundColor = '#0f172a';
            win.document.body.style.overflow = 'hidden';
            win.document.body.innerHTML = `
              <div style="display: flex; flex-direction: column; height: 100vh; width: 100vw; background: #0f172a; color: #ffffff; font-family: system-ui, -apple-system, sans-serif;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: #1e293b; border-bottom: 1px solid #334155;">
                  <span style="font-weight: 600; font-size: 14px; color: #f1f5f9;">${filename}</span>
                  <a href="${blobUrl}" download="${filename}" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700;">
                    <span>⬇ SIMPAN BERKAS PDF</span>
                  </a>
                </div>
                <div style="flex: 1; width: 100%; height: calc(100vh - 57px);">
                  <object data="${dataUri}" type="application/pdf" style="width: 100%; height: 100%; border: none;">
                    <iframe src="${dataUri}" style="width: 100%; height: 100%; border: none;" title="${filename}"></iframe>
                  </object>
                </div>
              </div>
            `;
          }
        } catch (e) {
          console.warn('Fallback window open failed:', e);
        }
      }

      try {
        await pdfObj.save(filename);
      } catch (saveErr) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
        }, 200);
      }

      // Record to download history in local storage
      try {
        const savedHistory = localStorage.getItem('asagk_download_history');
        let parsed = [];
        if (savedHistory) {
          parsed = JSON.parse(savedHistory);
        }
        const newHistoryItem = {
          id: `download_${Date.now()}`,
          evaluationId: evaluation.id,
          teacherName: evaluation.teacherName,
          schoolName: evaluation.schoolName,
          subject: evaluation.subject,
          topic: evaluation.topic,
          finalScore: evaluation.finalScore,
          predicate: evaluation.predicate,
          downloadedAt: new Date().toISOString(),
          filename: filename
        };
        const updated = [newHistoryItem, ...parsed.filter((item: any) => item.evaluationId !== evaluation.id)];
        localStorage.setItem('asagk_download_history', JSON.stringify(updated));
      } catch (historyErr) {
        console.warn('Could not update download history from full page:', historyErr);
      }

    } catch (err) {
      console.error('Failed to generate full page PDF:', err);
      if (pdfTab && !pdfTab.closed) pdfTab.close();
      alert('Gagal mengunduh PDF secara otomatis. Silakan gunakan tombol CETAK di atas dan pilih "Simpan sebagai PDF".');
    } finally {
      setIsDownloading(false);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === 'true') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100/60 pb-16 text-slate-800 antialiased" id="full-report-page-container">
      {/* Top Navbar Control Panel (Hidden during printing) */}
      <header className="bg-slate-950 text-white shadow-md sticky top-0 z-50 px-4 py-3.5 print:hidden" id="report-control-navbar">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              title="Tutup & Kembali"
              id="btn-close-report-tab"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm tracking-tight flex items-center">
                <FileText className="h-4 w-4 mr-2 text-emerald-400" />
                Laporan Hasil Supervisi Akademik (ASAGK)
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Kecamatan Kapuas Kuala - Tab Cetak Mandiri Bebas Hambatan</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => handleDownloadPdf(false)}
              disabled={isDownloading}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-950/40"
              id="btn-download-pdf-full"
            >
              <Download className={`h-3.5 w-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>{isDownloading ? 'MENGUNDUH...' : 'UNDUH PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
              id="btn-print-report-full"
            >
              <Printer className="h-3.5 w-3.5 text-slate-300" />
              <span>CETAK</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-full" id="full-report-main-area">
        {/* Printable Paper Card Frame */}
        <div 
          className="bg-white rounded-3xl border border-slate-250 shadow-2xl p-8 sm:p-12 print:p-0 print:border-0 print:shadow-none space-y-8" 
          id="printable-report-full"
        >
          {/* Kop Surat */}
          <div className="relative border-b-4 border-double border-slate-900 pb-5 min-h-[85px] flex items-center">
            <div className="absolute left-0 top-0 h-full flex items-center">
              <img 
                src="https://drive.google.com/thumbnail?id=12bvFON1axsbMX7FRe6UjXFjbyppJIoGp&sz=w500" 
                alt="Logo Kabupaten Kapuas" 
                className="h-16 w-auto sm:h-20 shrink-0 object-contain"
              />
            </div>
            <div className="text-center space-y-1 w-full pl-20 pr-2 sm:pl-24 sm:pr-4">
              <span className="text-[10px] font-bold tracking-widest uppercase block text-slate-500">Pemerintah Kabupaten Kapuas</span>
              <h1 className="text-sm sm:text-base font-bold tracking-wider uppercase text-slate-800 block">DINAS PENDIDIKAN</h1>
              <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900 leading-tight">
                KORWIL BIDANG PENDIDIKAN KECAMATAN KAPUAS KUALA
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-600">Alamat: Kantor Kecamatan Kapuas Kuala, Lupak Dalam, Kab. Kapuas, Kalimantan Tengah</p>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Arsip Digital Penjaminan Mutu Internal Aplikasi Supervisi Akademik (ASAGK)</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center space-y-1.5 pt-2">
            <h3 className="text-sm sm:text-base font-bold underline tracking-wider uppercase">LAPORAN HASIL EVALUASI SUPERVISI AKADEMIK GURU KELAS</h3>
            <p className="text-xs text-slate-500 font-mono">Nomor Registrasi: {getFullRegistrationNumber(evaluation)}</p>
          </div>

          {/* Informational Profile Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 print:bg-transparent print:border-0 print:p-0">
            <div className="space-y-2.5">
              <div className="flex items-start">
                <span className="w-28 text-slate-400 font-semibold shrink-0">Nama Guru:</span>
                <span className="font-bold text-slate-900">{teacherName}</span>
              </div>
              <div className="flex items-start">
                <span className="w-28 text-slate-400 font-semibold shrink-0">Satuan Pendidikan:</span>
                <span className="font-bold text-slate-900">{schoolName}</span>
              </div>
              <div className="flex items-start">
                <span className="w-28 text-slate-400 font-semibold shrink-0">Mata Pelajaran:</span>
                <span className="font-bold text-slate-900">{evaluation.subject}</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-start">
                <span className="w-28 text-slate-400 font-semibold shrink-0">Materi Pembelajaran:</span>
                <span className="font-bold text-slate-900 italic">&ldquo;{evaluation.topic}&rdquo;</span>
              </div>
              <div className="flex items-start">
                <span className="w-28 text-slate-400 font-semibold shrink-0">Tanggal Supervisi:</span>
                <span className="font-bold text-slate-900">{evaluation.date}</span>
              </div>
              <div className="flex items-start">
                <span className="w-28 text-slate-400 font-semibold shrink-0">Supervisor / Pengawas:</span>
                <span className="font-bold text-slate-900">{evaluation.supervisorName}</span>
              </div>
            </div>
          </div>

          {/* Scores Breakdown Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-3 bg-emerald-600 rounded-xs mr-2 inline-block"></span>
              I. Rincian Skor Indikator Supervisi Akademik
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-350">
                    <th className="border border-slate-300 p-2.5 text-center w-10">No</th>
                    <th className="border border-slate-300 p-2.5">Aspek / Indikator Penilaian RPP & Pengajaran</th>
                    <th className="border border-slate-300 p-2.5 text-center w-28">Skor Perolehan</th>
                    <th className="border border-slate-300 p-2.5">Catatan Penilai (Kualitatif)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {RUBRIC_CATEGORIES.map((cat, idx) => {
                    const scoreObj = evaluation.scores.find((s) => s.categoryId === cat.id);
                    const obtainedScore = scoreObj ? scoreObj.score : 0;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-300 p-2.5 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2.5">
                          <p className="font-bold text-slate-900">{cat.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{cat.description}</p>
                        </td>
                        <td className="border border-slate-300 p-2.5 text-center">
                          <span className="font-black text-slate-900 text-sm">{obtainedScore}</span>
                          <span className="text-slate-400 text-[10px]"> / {cat.maxScore}</span>
                        </td>
                        <td className="border border-slate-300 p-2.5 text-slate-600 text-[11px] italic leading-normal">
                          {scoreObj?.notes || 'Memenuhi standar indikator dengan sangat baik.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Core Summary & Predicate */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 items-stretch">
            {/* Final score block */}
            <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center flex flex-col justify-center print:bg-transparent">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Skor Hasil Akhir</span>
              <span className="text-4xl sm:text-5xl font-black text-amber-700 block mt-2">{evaluation.finalScore}</span>
              <span className="text-[10px] font-semibold text-slate-400 mt-1 block">Skala Penilaian 0-100</span>
            </div>

            {/* Predicate description */}
            <div className="md:col-span-8 bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between print:bg-transparent">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Predikat Kinerja</span>
                <span className={`inline-block text-xs font-extrabold px-3.5 py-1 rounded-full border mt-2 ${getPredicateBadge(evaluation.predicate)}`}>
                  {getPredicateLabel(evaluation.predicate)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3.5 leading-relaxed">
                Predikat ini mencerminkan kompetensi profesional Guru Kelas dalam menyusun perencanaan administrasi kelas, menyusun skenario RPP pembelajaran aktif, serta mengeksekusi interaksi edukasi di ruang kelas secara efektif.
              </p>
            </div>
          </div>

          {/* Qualitative Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                <span className="w-1.5 h-3 bg-emerald-600 rounded-xs mr-2 inline-block"></span>
                II. Catatan Evaluasi Pengawas
              </h4>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs italic text-slate-700 min-h-[100px] leading-relaxed whitespace-pre-wrap print:bg-transparent print:border-0 print:p-0">
                &ldquo;{evaluation.generalNotes || 'Secara keseluruhan proses pembelajaran berlangsung tertib dan mengedepankan aspek keaktifan murid di kelas.'}&rdquo;
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                <span className="w-1.5 h-3 bg-emerald-600 rounded-xs mr-2 inline-block"></span>
                III. Rekomendasi Tindak Lanjut
              </h4>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs italic text-slate-700 min-h-[100px] leading-relaxed whitespace-pre-wrap print:bg-transparent print:border-0 print:p-0">
                &ldquo;{evaluation.recommendations || 'Guru diharapkan konsisten menggunakan media interaktif dan berkolaborasi dalam KKG Kecamatan.'}&rdquo;
              </div>
            </div>
          </div>

          {/* Signatures/Legitimacy Area */}
          <div className="pt-8 sm:pt-12 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-xs text-center">
              <div className="space-y-16">
                <div>
                  <p className="text-slate-400">Guru Kelas Terkait,</p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 underline">{teacherName}</p>
                  <p className="text-[10px] text-slate-400">{teacherNip}</p>
                </div>
              </div>

              <div className="space-y-16">
                <div>
                  <p className="text-slate-400">Mengetahui, Kepala Sekolah,</p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 underline">{kepsekName}</p>
                  <p className="text-[10px] text-slate-400">{kepsekNip}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-slate-400">Lupak Dalam, {evaluation.date}</p>
                  <p className="text-slate-400 mt-1 font-semibold">Supervisor / Pengawas Sekolah,</p>
                </div>
                <div className="py-1">
                  <ElectronicSignatureBarcode
                    supervisorName={supervisorName}
                    supervisorNip={supervisorNip}
                    evaluationId={evaluation.id}
                    evaluationDate={evaluation.date}
                    teacherName={teacherName}
                    schoolName={schoolName}
                    finalScore={evaluation.finalScore}
                    predicate={evaluation.predicate}
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 underline">{supervisorName}</p>
                  <p className="text-[10px] text-slate-400">{supervisorNipFormatted}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Validation/QR Code Footnote */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 leading-normal print:hidden">
            <div className="flex items-center space-x-2.5">
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl border border-emerald-200">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-slate-700">Diverifikasi & Disahkan Secara Elektronik</p>
                <p className="text-slate-400">Oleh Korwil Bidang Pendidikan Kecamatan Kapuas Kuala</p>
              </div>
            </div>
            <p className="mt-2 sm:mt-0 font-mono text-[9px]">ID Verifikasi: {evaluation.id.toUpperCase()}-{Date.now()}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
