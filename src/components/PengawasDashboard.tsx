import React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { UserProfile, SupervisionAgenda, SupervisionEvaluation, RubricCategory, RubricScore } from '../types';
import { RUBRIC_CATEGORIES } from '../data/mockData';
import { getFullRegistrationNumber } from '../utils';
import ElectronicSignatureBarcode from './ElectronicSignatureBarcode';
import SecurityCenterPanel from './SecurityCenterPanel';
import { 
  Calendar, Clock, BookOpen, User, FileText, BarChart3, Edit3, Award, 
  HelpCircle, ChevronRight, CheckCircle2, ListFilter, TrendingUp, Sparkles, AlertCircle, Info, Download, Trash2, History, Printer,
  Plus, ShieldAlert, Key, Settings, ShieldCheck
} from 'lucide-react';

interface DownloadHistoryItem {
  id: string;
  evaluationId: string;
  teacherName: string;
  schoolName: string;
  subject: string;
  topic: string;
  finalScore: number;
  predicate: string;
  downloadedAt: string;
  filename: string;
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

interface PengawasDashboardProps {
  currentUser: UserProfile;
  agendas: SupervisionAgenda[];
  evaluations: SupervisionEvaluation[];
  onSubmitEvaluation: (evaluation: Omit<SupervisionEvaluation, 'id' | 'supervisorName' | 'evaluatedAt'>) => void;
  onDeleteEvaluation?: (id: string) => void;
  onDeleteAgenda?: (agendaId: string) => void;
  onViewRaport?: (evalId: string) => void;
  allUsers?: UserProfile[];
  onUpdateUsers?: (newUsers: UserProfile[]) => void;
  onResetAllData?: () => void;
  onClearSupervision?: () => void;
}

export default function PengawasDashboard({
  currentUser,
  agendas,
  evaluations,
  onSubmitEvaluation,
  onDeleteEvaluation,
  onDeleteAgenda,
  onViewRaport,
  allUsers = [],
  onUpdateUsers,
  onResetAllData,
  onClearSupervision,
}: PengawasDashboardProps) {
  // Tabs
  const [activeTab, setActiveTab] = React.useState<'JADWAL' | 'RUBRIK' | 'ANALISIS' | 'KELOLA' | 'KEAMANAN'>('JADWAL');
  
  // Selected agenda for evaluation
  const [selectedAgenda, setSelectedAgenda] = React.useState<SupervisionAgenda | null>(null);
  
  // Form scoring states
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = React.useState('');
  const [recommendations, setRecommendations] = React.useState('');
  
  // View evaluation details (for detail Modal)
  const [viewingEval, setViewingEval] = React.useState<SupervisionEvaluation | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  // Local storage download history
  const [downloadHistory, setDownloadHistory] = React.useState<DownloadHistoryItem[]>(() => {
    const saved = localStorage.getItem('asagk_download_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing download history', e);
      }
    }
    return [];
  });

  const handleRemoveHistoryItem = (id: string) => {
    const updated = downloadHistory.filter((item) => item.id !== id);
    setDownloadHistory(updated);
    localStorage.setItem('asagk_download_history', JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua riwayat unduhan di penyimpanan lokal ini?')) {
      setDownloadHistory([]);
      localStorage.removeItem('asagk_download_history');
    }
  };

  // Kelola Data Master States
  const [kelolaSubTab, setKelolaSubTab] = React.useState<'DAFTAR' | 'TAMBAH' | 'SISTEM'>('DAFTAR');
  const [editingUser, setEditingUser] = React.useState<UserProfile | null>(null);
  const [newUserName, setNewUserName] = React.useState('');
  const [newUserUsername, setNewUserUsername] = React.useState('');
  const [newUserPassword, setNewUserPassword] = React.useState('');
  const [newUserRole, setNewUserRole] = React.useState<'GURU' | 'KEPALA_SEKOLAH' | 'PENGAWAS'>('GURU');
  const [newUserSchool, setNewUserSchool] = React.useState('');
  const [newUserNip, setNewUserNip] = React.useState('');
  const [newUserGrade, setNewUserGrade] = React.useState('');
  const [mgmtSuccessMsg, setMgmtSuccessMsg] = React.useState('');
  const [mgmtErrorMsg, setMgmtErrorMsg] = React.useState('');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setMgmtSuccessMsg('');
    setMgmtErrorMsg('');

    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) {
      setMgmtErrorMsg('Nama Lengkap, Username, dan Kata Sandi wajib diisi!');
      return;
    }

    const usernameLower = newUserUsername.trim().toLowerCase();
    
    // Check duplication
    if (allUsers.some(u => u.username.toLowerCase() === usernameLower)) {
      setMgmtErrorMsg(`Username "${newUserUsername}" sudah terdaftar oleh pengguna lain.`);
      return;
    }

    const detailsString = newUserRole === 'GURU'
      ? `Guru Kelas ${newUserGrade.trim() || ''} - ${newUserSchool.trim() || ''}`
      : newUserRole === 'KEPALA_SEKOLAH'
        ? `Kepala Sekolah - ${newUserSchool.trim() || ''}`
        : `Pengawas Sekolah Korwil Bidang Pendidikan Kecamatan Kapuas Kuala`;

    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      name: newUserName.trim(),
      username: usernameLower,
      password: newUserPassword.trim(),
      role: newUserRole,
      schoolName: newUserSchool.trim() || undefined,
      nip: newUserNip.trim() || undefined,
      gradeLevel: newUserRole === 'GURU' && newUserGrade.trim() ? newUserGrade.trim() : undefined,
      details: detailsString
    };

    if (onUpdateUsers) {
      onUpdateUsers([...allUsers, newUser]);
      setMgmtSuccessMsg(`Akun ${newUserRole} "${newUserName}" berhasil ditambahkan ke sistem.`);
      
      // Clear inputs
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserSchool('');
      setNewUserNip('');
      setNewUserGrade('');
    }
  };

  const handleDeleteUser = (userId: string) => {
    setMgmtSuccessMsg('');
    setMgmtErrorMsg('');

    if (userId === currentUser.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.');
      return;
    }

    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;

    if (window.confirm(`Apakah Anda yakin ingin menghapus akun "${targetUser.name}" (${targetUser.role})? Tindakan ini permanen.`)) {
      if (onUpdateUsers) {
        const updated = allUsers.filter(u => u.id !== userId);
        onUpdateUsers(updated);
        setMgmtSuccessMsg(`Akun "${targetUser.name}" berhasil dihapus dari sistem.`);
      }
    }
  };

  const handleUpdateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setMgmtSuccessMsg('');
    setMgmtErrorMsg('');

    if (!editingUser.name.trim() || !editingUser.username.trim() || !editingUser.password?.trim()) {
      setMgmtErrorMsg('Nama Lengkap, Username, dan Kata Sandi wajib diisi!');
      return;
    }

    const usernameLower = editingUser.username.trim().toLowerCase();

    // Check duplication with other users
    if (allUsers.some(u => u.id !== editingUser.id && u.username.toLowerCase() === usernameLower)) {
      setMgmtErrorMsg(`Username "${editingUser.username}" sudah terdaftar oleh pengguna lain.`);
      return;
    }

    const detailsString = editingUser.role === 'GURU'
      ? `Guru Kelas ${editingUser.gradeLevel?.trim() || ''} - ${editingUser.schoolName?.trim() || ''}`
      : editingUser.role === 'KEPALA_SEKOLAH'
        ? `Kepala Sekolah - ${editingUser.schoolName?.trim() || ''}`
        : `Pengawas Sekolah Korwil Bidang Pendidikan Kecamatan Kapuas Kuala`;

    const updatedUser: UserProfile = {
      ...editingUser,
      username: usernameLower,
      details: detailsString
    };

    if (onUpdateUsers) {
      const updated = allUsers.map(u => u.id === editingUser.id ? updatedUser : u);
      onUpdateUsers(updated);
      setMgmtSuccessMsg(`Akun "${editingUser.name}" berhasil diperbarui.`);
      setEditingUser(null);
    }
  };

  const handleDownloadFromHistory = async (evalId: string) => {
    const targetEval = evaluations.find(e => e.id === evalId);
    if (!targetEval) {
      alert('Data evaluasi tidak ditemukan untuk diunduh ulang.');
      return;
    }

    const safeTeacherName = targetEval.teacherName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSchoolName = targetEval.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Laporan_Supervisi_${safeTeacherName}_${safeSchoolName}.pdf`;

    // 1. Immediately record/update history timestamp to move it to the top
    const newHistoryItem: DownloadHistoryItem = {
      id: `download_${Date.now()}`,
      evaluationId: targetEval.id,
      teacherName: targetEval.teacherName,
      schoolName: targetEval.schoolName,
      subject: targetEval.subject,
      topic: targetEval.topic,
      finalScore: targetEval.finalScore,
      predicate: targetEval.predicate,
      downloadedAt: new Date().toISOString(),
      filename: filename
    };

    setDownloadHistory((prev) => {
      const updated = [newHistoryItem, ...prev.filter(item => item.evaluationId !== evalId)];
      localStorage.setItem('asagk_download_history', JSON.stringify(updated));
      return updated;
    });
    
    // Set viewingEval so that the document element "printable-report" is rendered
    setViewingEval(targetEval);
    setIsDownloadingPdf(true);
    
    // Let React render the element in the modal and wait for fadeIn animation to finish
    setTimeout(async () => {
      // Temporarily store scroll states of the modal container to prevent cut-offs
      const modalContent = document.getElementById('report-modal-content');
      const originalScrollTop = modalContent ? modalContent.scrollTop : 0;
      if (modalContent) {
        modalContent.scrollTop = 0;
      }

      try {
        const element = document.getElementById('printable-report');
        if (!element) {
          alert('Gagal mendeteksi elemen laporan di layar.');
          setIsDownloadingPdf(false);
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
                    // Ignore stylesheet access issues for external sheets
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
                console.error('Error rewriting stylesheets in onclone:', err);
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

        // Try standard PDF save with fallback
        try {
          await pdfObj.save(filename);
        } catch (saveErr) {
          console.warn('History pdf.save failed, trying blob link click...', saveErr);
          const blob = pdfObj.output('blob');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 150);
        }

        // Fallback for Sandbox / Iframe environments:
        // Opening the PDF blob directly in a new window/tab bypasses download blocks in some iframe wrappers
        const isIframe = window.self !== window.top;
        if (isIframe) {
          try {
            const blob = pdfObj.output('blob');
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open(blobUrl, '_blank');
            if (!newWindow) {
              console.warn('Popup blocked, PDF ready but window.open returned null.');
            }
          } catch (iframeErr) {
            console.error('Iframe fallback error:', iframeErr);
          }
        }
      } catch (err) {
        console.error('Download from history failed:', err);
        alert('Gagal mengunduh ulang laporan. Silakan gunakan tombol cetak manual.');
      } finally {
        // Restore scroll position
        if (modalContent) {
          modalContent.scrollTop = originalScrollTop;
        }
        setIsDownloadingPdf(false);
      }
    }, 500); // Wait 500ms for modal fadeIn animation to fully complete
  };

  const handleDownloadPdf = async (shouldOpenTab = true) => {
    if (!viewingEval) return;
    setIsDownloadingPdf(true);

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

    const safeTeacherName = viewingEval.teacherName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSchoolName = viewingEval.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Laporan_Supervisi_${safeTeacherName}_${safeSchoolName}.pdf`;

    // 1. Immediately record download to history on click
    const newHistoryItem: DownloadHistoryItem = {
      id: `download_${Date.now()}`,
      evaluationId: viewingEval.id,
      teacherName: viewingEval.teacherName,
      schoolName: viewingEval.schoolName,
      subject: viewingEval.subject,
      topic: viewingEval.topic,
      finalScore: viewingEval.finalScore,
      predicate: viewingEval.predicate,
      downloadedAt: new Date().toISOString(),
      filename: filename
    };
    
    setDownloadHistory((prev) => {
      const updated = [newHistoryItem, ...prev.filter(item => item.evaluationId !== viewingEval.id)];
      localStorage.setItem('asagk_download_history', JSON.stringify(updated));
      return updated;
    });

    // Temporarily reset scroll of modal-content to prevent cropped/white PDFs
    const modalContent = document.getElementById('report-modal-content');
    const originalScrollTop = modalContent ? modalContent.scrollTop : 0;
    if (modalContent) {
      modalContent.scrollTop = 0;
    }

    try {
      const element = document.getElementById('printable-report');
      if (!element) {
        alert('Laporan tidak ditemukan untuk diunduh.');
        if (pdfTab && !pdfTab.closed) pdfTab.close();
        setIsDownloadingPdf(false);
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
                  // Ignore stylesheet access issues for external sheets
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
              console.error('Error rewriting stylesheets in onclone:', err);
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

      // Open PDF file directly in the browser tab using embedded PDF viewer
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

      // Download PDF file to disk
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

    } catch (error) {
      console.error('PDF generation error:', error);
      if (pdfTab && !pdfTab.closed) pdfTab.close();
      alert('Gagal mengunduh PDF secara otomatis. Silakan gunakan tombol cetak manual dari menu laporan.');
    } finally {
      if (modalContent) {
        modalContent.scrollTop = originalScrollTop;
      }
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintReport = () => {
    if (!viewingEval) return;
    const url = `${window.location.origin}${window.location.pathname}?raport=${viewingEval.id}&print=true`;
    window.open(url, '_blank');
  };

  // Initialize scoring when agenda is selected
  React.useEffect(() => {
    if (selectedAgenda) {
      const initialScores: Record<string, number> = {};
      const initialNotes: Record<string, string> = {};
      RUBRIC_CATEGORIES.forEach((cat) => {
        initialScores[cat.id] = 80; // default standard score
        initialNotes[cat.id] = '';
      });
      setScores(initialScores);
      setNotes(initialNotes);
      setGeneralNotes('');
      setRecommendations('');
    }
  }, [selectedAgenda]);

  // Filter approved agendas (only those approved by principals)
  const approvedAgendas = agendas.filter((a) => a.status === 'APPROVED');

  const handleScoreChange = (categoryId: string, value: number) => {
    setScores((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleNoteChange = (categoryId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [categoryId]: value }));
  };

  // Calculate final metrics
  const totalRubrics = RUBRIC_CATEGORIES.length;
  const currentTotalScore = (Object.values(scores) as number[]).reduce((a, b) => a + b, 0);
  const currentFinalScore = totalRubrics > 0 ? parseFloat((currentTotalScore / totalRubrics).toFixed(1)) : 0;

  const getPredicate = (score: number) => {
    if (score >= 90) return 'SANGAT_BAIK';
    if (score >= 80) return 'BAIK';
    if (score >= 70) return 'CUKUP';
    return 'PERLU_BIMBINGAN';
  };

  const getPredicateBadge = (predicate: string) => {
    switch (predicate) {
      case 'SANGAT_BAIK':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'BAIK':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'CUKUP':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  const getPredicateLabel = (predicate: string) => {
    switch (predicate) {
      case 'SANGAT_BAIK': return 'Sangat Baik (A)';
      case 'BAIK': return 'Baik (B)';
      case 'CUKUP': return 'Cukup (C)';
      default: return 'Perlu Bimbingan / Kurang (D)';
    }
  };

  const currentPredicate = getPredicate(currentFinalScore);

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgenda) return;

    // Structure rubric scores
    const rubricScoresList: RubricScore[] = RUBRIC_CATEGORIES.map((cat) => ({
      categoryId: cat.id,
      score: scores[cat.id] || 80,
      notes: notes[cat.id] || ''
    }));

    onSubmitEvaluation({
      agendaId: selectedAgenda.id,
      teacherId: selectedAgenda.teacherId,
      teacherName: selectedAgenda.teacherName,
      schoolName: selectedAgenda.schoolName,
      subject: selectedAgenda.subject,
      topic: selectedAgenda.topic,
      date: selectedAgenda.date,
      scores: rubricScoresList,
      finalScore: currentFinalScore,
      predicate: currentPredicate,
      generalNotes: generalNotes.trim() || 'Pembelajaran telah terlaksana sesuai rencana.',
      recommendations: recommendations.trim() || 'Pertahankan dan kembangkan kreativitas mengajar.'
    });

    // Reset and redirect
    setSelectedAgenda(null);
    setActiveTab('ANALISIS');
  };

  const startSupervision = (agenda: SupervisionAgenda) => {
    setSelectedAgenda(agenda);
    setActiveTab('RUBRIK');
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = "";

    if (activeTab === 'ANALISIS') {
      fileName = `rekap_hasil_supervisi_kecamatan_${new Date().toISOString().slice(0,10)}.csv`;
      
      // Header for Evaluations
      const headers = [
        "ID Evaluasi",
        "Nama Guru",
        "Sekolah Dasar",
        "Mata Pelajaran",
        "Materi Pokok",
        "Tanggal Supervisi",
        "Nama Supervisor",
        "Skor Akhir",
        "Predikat",
        "Catatan Umum",
        "Rekomendasi",
        "Waktu Evaluasi"
      ];
      
      const rows = evaluations.map(e => [
        `"${e.id}"`,
        `"${e.teacherName.replace(/"/g, '""')}"`,
        `"${e.schoolName.replace(/"/g, '""')}"`,
        `"${e.subject.replace(/"/g, '""')}"`,
        `"${e.topic.replace(/"/g, '""')}"`,
        `"${e.date}"`,
        `"${e.supervisorName.replace(/"/g, '""')}"`,
        e.finalScore,
        `"${e.predicate}"`,
        `"${(e.generalNotes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(e.recommendations || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${new Date(e.evaluatedAt).toLocaleDateString('id-ID')}"`
      ]);

      csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else if (activeTab === 'JADWAL') {
      fileName = `rekap_jadwal_supervisi_kecamatan_${new Date().toISOString().slice(0,10)}.csv`;

      const headers = [
        "ID Agenda",
        "Nama Guru",
        "Sekolah Dasar",
        "Kelas",
        "Mata Pelajaran",
        "Materi Pokok",
        "Tanggal Supervisi",
        "Waktu",
        "Status Agenda",
        "Tanggal Pengajuan",
        "Catatan Kepala Sekolah"
      ];

      const rows = approvedAgendas.map(a => [
        `"${a.id}"`,
        `"${a.teacherName.replace(/"/g, '""')}"`,
        `"${a.schoolName.replace(/"/g, '""')}"`,
        `"${a.gradeLevel}"`,
        `"${a.subject.replace(/"/g, '""')}"`,
        `"${a.topic.replace(/"/g, '""')}"`,
        `"${a.date}"`,
        `"${a.time}"`,
        `"${a.status}"`,
        `"${new Date(a.submittedAt).toLocaleDateString('id-ID')}"`,
        `"${(a.feedback || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
      ]);

      csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else {
      return;
    }

    // Download CSV with BOM for correct Excel encoding
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analysis calculations
  const schoolAverages: Record<string, { total: number; count: number }> = {};
  const categoryAverages: Record<string, { total: number; count: number }> = {};

  evaluations.forEach((evalItem) => {
    // School averages
    if (!schoolAverages[evalItem.schoolName]) {
      schoolAverages[evalItem.schoolName] = { total: 0, count: 0 };
    }
    schoolAverages[evalItem.schoolName].total += evalItem.finalScore;
    schoolAverages[evalItem.schoolName].count += 1;

    // Category averages
    evalItem.scores.forEach((s) => {
      if (!categoryAverages[s.categoryId]) {
        categoryAverages[s.categoryId] = { total: 0, count: 0 };
      }
      categoryAverages[s.categoryId].total += s.score;
      categoryAverages[s.categoryId].count += 1;
    });
  });

  const processedSchoolData = Object.entries(schoolAverages).map(([name, val]) => ({
    name,
    avg: parseFloat((val.total / val.count).toFixed(1))
  }));

  const processedCategoryData = RUBRIC_CATEGORIES.map((cat) => {
    const val = categoryAverages[cat.id];
    return {
      name: cat.name,
      avg: val ? parseFloat((val.total / val.count).toFixed(1)) : 0
    };
  });

  // Today's Date representation in Indonesian format
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="pengawas-dashboard">
      
      {/* Upper Welcoming Bar */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-amber-100 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full uppercase">Kecamatan Kapuas Kuala</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">{currentUser.name}</h2>
            <p className="text-amber-50 text-sm mt-1 max-w-2xl">
              Portal Pengawas Korwil Pendidikan Kecamatan Kapuas Kuala. Menilai rubrik mengajar, merekapitulasi jadwal, serta menganalisis data kompetensi seluruh Guru Kelas hari ini.
            </p>
          </div>
          <div className="bg-white/10 px-4 py-3 rounded-2xl border border-white/10 text-center shrink-0">
            <span className="block text-[10px] text-amber-100 font-bold uppercase tracking-wider">Tanggal Kerja</span>
            <span className="text-sm font-bold text-white block mt-1">{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex flex-1 border-b border-slate-200 font-sans font-bold text-sm bg-white p-1 rounded-xl border border-slate-100 shadow-2xs overflow-x-auto min-w-0">
          <button
            onClick={() => setActiveTab('JADWAL')}
            className={`flex-1 sm:flex-initial py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'JADWAL'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-pengawas-jadwal"
          >
            <Calendar className="h-4 w-4" />
            <span>Jadwal & Agenda ({approvedAgendas.length})</span>
          </button>

          <button
            onClick={() => {
              if (!selectedAgenda && approvedAgendas.length > 0) {
                // auto-select first available if they click rubric tab
                const firstUnevaluated = approvedAgendas.find(a => !evaluations.some(e => e.agendaId === a.id));
                if (firstUnevaluated) {
                  setSelectedAgenda(firstUnevaluated);
                } else {
                  setSelectedAgenda(approvedAgendas[0]);
                }
              }
              setActiveTab('RUBRIK');
            }}
            className={`flex-1 sm:flex-initial py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'RUBRIK'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-pengawas-rubrik"
          >
            <Edit3 className="h-4 w-4" />
            <span>Rubrik Supervisi {selectedAgenda ? `(${selectedAgenda.teacherName.split(',')[0]})` : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('ANALISIS')}
            className={`flex-1 sm:flex-initial py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'ANALISIS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-pengawas-analisis"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Hasil & Analisis ({evaluations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('KELOLA')}
            className={`flex-1 sm:flex-initial py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'KELOLA'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-pengawas-kelola"
          >
            <Settings className="h-4 w-4" />
            <span>Kelola Data Master</span>
          </button>

          <button
            onClick={() => setActiveTab('KEAMANAN')}
            className={`flex-1 sm:flex-initial py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'KEAMANAN'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-pengawas-keamanan"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Keamanan & Audit Log</span>
          </button>
        </div>

        {activeTab !== 'RUBRIK' && activeTab !== 'KELOLA' && activeTab !== 'KEAMANAN' && (
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 hover:border-amber-300 text-amber-800 font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap self-stretch md:self-auto"
            id="btn-pengawas-export-csv"
            title="Ekspor daftar ke file CSV untuk Microsoft Excel"
          >
            <Download className="h-4 w-4 shrink-0 text-amber-600" />
            <span>EKSPOR {activeTab === 'JADWAL' ? 'JADWAL' : 'HASIL'} CSV</span>
          </button>
        )}
      </div>

      {/* TABS CONTENT */}

      {/* 1. JADWAL & AGENDA TAB */}
      {activeTab === 'JADWAL' && (
        <div className="space-y-6" id="view-pengawas-jadwal">
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-lg">Daftar Agenda Supervisi Akademik</h3>
                <p className="text-xs text-slate-500">Seluruh jadwal yang telah disetujui Kepala Sekolah dan siap disupervisi hari ini</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">
                {approvedAgendas.length} Agenda Aktif
              </span>
            </div>

            {approvedAgendas.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-slate-700">Belum Ada Agenda yang Disetujui</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Segera komunikasikan kepada Kepala Sekolah mitra untuk menyetujui jadwal dan RPP yang diunggah oleh guru kelas masing-masing.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="approved-agendas-grid">
                {approvedAgendas.map((agenda) => {
                  const isEvaluated = evaluations.some((e) => e.agendaId === agenda.id);
                  const evalData = evaluations.find((e) => e.agendaId === agenda.id);

                  return (
                    <div
                      key={agenda.id}
                      className={`p-5 rounded-3xl border-2 flex flex-col justify-between ${
                        isEvaluated 
                          ? 'border-emerald-100 bg-emerald-50/10' 
                          : 'border-slate-100 bg-white hover:shadow-xl hover:shadow-slate-100/50 transition-all'
                      }`}
                      id={`supervisor-agenda-${agenda.id}`}
                    >
                      <div className="space-y-4">
                        {/* School and status badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase">
                            {agenda.schoolName}
                          </span>
                          {isEvaluated ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                              Selesai Nilai
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3 mr-1 text-amber-500" />
                              Menunggu Pelaksanaan
                            </span>
                          )}
                        </div>

                        {/* Teacher & Lesson info */}
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Guru Kelas: <strong className="text-slate-800">{agenda.teacherName}</strong></p>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{agenda.topic}</h4>
                          <span className="text-xs text-amber-700 font-semibold mt-1 block">{agenda.gradeLevel} • Mapel: {agenda.subject}</span>
                        </div>

                        {/* Date and Time Details */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600">
                          <div className="flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            <span>{agenda.date}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            <span>Pukul {agenda.time} WIB</span>
                          </div>
                        </div>

                        {/* Attachment info */}
                        {agenda.document && (
                          <div className="flex items-center text-xs bg-white border border-slate-100 p-2 rounded-lg">
                            <FileText className="h-4 w-4 text-rose-500 mr-2 shrink-0" />
                            <span className="truncate text-slate-700 font-medium">{agenda.document.fileName}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5 shrink-0">({agenda.document.fileSize})</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action buttons */}
                      <div className="pt-5 border-t border-slate-100/80 mt-5 flex items-center justify-end space-x-2">
                        {isEvaluated && evalData ? (
                          <button
                            onClick={() => {
                              if (onViewRaport) {
                                onViewRaport(evalData.id);
                              } else {
                                const url = new URL(window.location.href);
                                url.searchParams.set('raport', evalData.id);
                                window.open(url.toString(), '_blank');
                              }
                            }}
                            className="text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg flex items-center transition-colors cursor-pointer"
                            id={`btn-view-eval-${agenda.id}`}
                          >
                            <Award className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            Nilai: {evalData.finalScore} ({getPredicateLabel(evalData.predicate).split(' ')[0]})
                          </button>
                        ) : (
                          <button
                            onClick={() => startSupervision(agenda)}
                            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl flex items-center shadow-md shadow-amber-100 transition-colors cursor-pointer"
                            id={`btn-start-eval-${agenda.id}`}
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                            Lakukan Supervisi
                          </button>
                        )}
                        {onDeleteAgenda && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Apakah Anda yakin ingin menghapus agenda supervisi untuk ${agenda.teacherName}?`)) {
                                onDeleteAgenda(agenda.id);
                                if (selectedAgenda?.id === agenda.id) {
                                  setSelectedAgenda(null);
                                }
                              }
                            }}
                            className="p-2 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="Hapus Agenda Ini"
                            id={`btn-delete-pengawas-agenda-${agenda.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. RUBRIK SUPERVISI PENILAIAN */}
      {activeTab === 'RUBRIK' && (
        <div className="space-y-6" id="view-pengawas-rubrik">
          {!selectedAgenda ? (
            <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-8 text-center space-y-4">
              <div className="h-12 w-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <Info className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto">
                <p className="text-xs font-bold text-slate-700">Pilih Agenda Supervisi Terlebih Dahulu</p>
                <p className="text-[11px] text-slate-500 mt-1">Harap pilih guru yang akan disupervisi dari tab "Jadwal & Agenda" dengan mengklik tombol "Lakukan Supervisi" untuk membuka form ini.</p>
                <button
                  onClick={() => setActiveTab('JADWAL')}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-100 cursor-pointer"
                >
                  Lihat Jadwal Agenda &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Side: Evaluation scoring cards */}
              <div className="lg:col-span-8 bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6 space-y-6">
                
                {/* Header info */}
                <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase">
                      Instrumen Rubrik Supervisi Akademik
                    </span>
                    <h3 className="font-sans font-bold text-slate-900 text-lg mt-1">Evaluasi Guru: {selectedAgenda.teacherName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Topik: &ldquo;{selectedAgenda.topic}&rdquo;</p>
                  </div>
                  <button
                    onClick={() => setSelectedAgenda(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                {/* Rubrics category entries */}
                <form onSubmit={handleSaveEvaluation} className="space-y-6">
                  
                  {/* Interactive Sliders for categories */}
                  <div className="space-y-6" id="rubric-form-categories">
                    {RUBRIC_CATEGORIES.map((cat, idx) => {
                      const currentVal = scores[cat.id] || 80;
                      
                      return (
                        <div key={cat.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 flex items-center">
                              <span className="h-5 w-5 bg-amber-600 text-white font-mono rounded-full flex items-center justify-center text-[11px] mr-2 shrink-0">
                                {idx + 1}
                              </span>
                              {cat.name}
                            </span>
                            
                            {/* Score badge & quick slider select */}
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={currentVal}
                                onChange={(e) => {
                                  let val = parseInt(e.target.value);
                                  if (isNaN(val)) val = 0;
                                  if (val > 100) val = 100;
                                  handleScoreChange(cat.id, val);
                                }}
                                className="w-16 border border-slate-200 rounded-lg text-center font-bold text-slate-800 text-xs py-1 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                              />
                              <span className="text-[10px] text-slate-400 font-semibold">/ {cat.maxScore}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 italic leading-relaxed">{cat.description}</p>

                          {/* Dynamic slider */}
                          <div className="flex items-center space-x-4 pt-1">
                            <span className="text-[10px] text-slate-400">0</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={currentVal}
                              onChange={(e) => handleScoreChange(cat.id, parseInt(e.target.value))}
                              className="flex-1 accent-amber-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                            />
                            <span className="text-[10px] text-slate-400">100</span>
                          </div>

                          {/* Category comment notes */}
                          <div className="pt-1.5">
                            <input
                              type="text"
                              value={notes[cat.id] || ''}
                              onChange={(e) => handleNoteChange(cat.id, e.target.value)}
                              className="w-full border border-slate-200/80 rounded-lg px-2.5 py-1 text-[11px] bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all"
                              placeholder="Ketik catatan khusus untuk indikator ini..."
                              id={`comment-${cat.id}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* General feedback entry */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Umum Pembelajaran</label>
                      <textarea
                        value={generalNotes}
                        onChange={(e) => setGeneralNotes(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-hidden transition-all h-20 resize-none"
                        placeholder="Contoh: Secara keseluruhan, penyampaian materi sudah sangat kreatif. Siswa antusias..."
                        id="input-general-notes"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Saran & Rekomendasi Tindak Lanjut</label>
                      <textarea
                        value={recommendations}
                        onChange={(e) => setRecommendations(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-hidden transition-all h-20 resize-none"
                        placeholder="Contoh: Pertahankan penggunaan alat peraga nyata, kembangkan strategi alokasi waktu penutup..."
                        id="input-recommendations"
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-sm shadow-lg shadow-amber-100 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-4"
                    id="btn-save-evaluation"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    <span>Simpan & Rekap Hasil Supervisi</span>
                  </button>
                </form>

              </div>

              {/* Right Side: Score Summary Panel */}
              <div className="lg:col-span-4 bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 space-y-6 sticky top-20">
                <h4 className="font-sans font-bold text-slate-900 text-sm flex items-center">
                  <Award className="h-4 w-4 mr-2 text-amber-600" />
                  Kompilasi Hasil Real-Time
                </h4>

                {/* Score Big Display */}
                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100/50 text-center space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Nilai Rata-Rata</span>
                  <span className="text-5xl font-black text-amber-700 block" id="realtime-score">
                    {currentFinalScore}
                  </span>
                  
                  {/* Dynamic Predicate Badge */}
                  <span className={`inline-block text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${getPredicateBadge(currentPredicate)}`}>
                    Predikat: {getPredicateLabel(currentPredicate)}
                  </span>
                </div>

                {/* Lesson summary card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2.5">
                  <p className="font-bold text-slate-800">Guru Mitra disupervisi:</p>
                  <div>
                    <span className="block font-medium text-slate-500">Nama Guru:</span>
                    <span className="block font-bold text-slate-800">{selectedAgenda.teacherName}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-slate-500">Sekolah:</span>
                    <span className="block font-bold text-slate-800">{selectedAgenda.schoolName}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-slate-500">Kelas & Mapel:</span>
                    <span className="block font-bold text-slate-800">{selectedAgenda.gradeLevel} • {selectedAgenda.subject}</span>
                  </div>
                </div>

                {/* Informational Guidelines card */}
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100 text-[10px] text-amber-800 flex items-start space-x-2">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Standar Penilaian Kemendikbud:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-slate-600">
                      <li><strong>90 - 100:</strong> Sangat Baik (A)</li>
                      <li><strong>80 - 89:</strong> Baik (B)</li>
                      <li><strong>70 - 79:</strong> Cukup (C)</li>
                      <li><strong>&lt; 70:</strong> Perlu Bimbingan (D)</li>
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* 3. HASIL & ANALISIS TAB */}
      {activeTab === 'ANALISIS' && (
        <div className="space-y-6" id="view-pengawas-analisis">
          
          {/* Metrics summary widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30">
              <span className="text-xs text-slate-500 font-bold block">Total Guru Disupervisi</span>
              <span className="text-3xl font-extrabold text-amber-600 block mt-1" id="evaluations-count">{evaluations.length}</span>
              <p className="text-[10px] text-slate-400 mt-1">Guru Kelas SD di Kapuas Kuala</p>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30">
              <span className="text-xs text-slate-500 font-bold block">Rerata Nilai Kecamatan</span>
              <span className="text-3xl font-extrabold text-amber-600 block mt-1" id="evaluations-average">
                {evaluations.length > 0 
                  ? (evaluations.reduce((a, b) => a + b.finalScore, 0) / evaluations.length).toFixed(1) 
                  : '0.0'
                }
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Target mutu standar: &gt; 80.0</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30">
              <span className="text-xs text-slate-500 font-bold block">Sekolah Dengan Rerata Tertinggi</span>
              <span className="text-lg font-bold text-amber-600 block truncate mt-1.5" id="highest-school">
                {processedSchoolData.length > 0 
                  ? [...processedSchoolData].sort((a, b) => b.avg - a.avg)[0].name 
                  : '-'
                }
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                Skor tertinggi:{' '}
                {processedSchoolData.length > 0 
                  ? [...processedSchoolData].sort((a, b) => b.avg - a.avg)[0].avg 
                  : '0'
                }
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30">
              <span className="text-xs text-slate-500 font-bold block">Predikat Terbanyak</span>
              <span className="text-lg font-bold text-amber-600 block mt-1.5" id="highest-predicate">
                {evaluations.length > 0 
                  ? 'Sangat Baik (A)' 
                  : '-'
                }
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Predikat umum guru hari ini</p>
            </div>
          </div>

          {/* Graphical Analytics and Category Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* SVG Chart 1: Rata-Rata Nilai per Sekolah */}
            <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">Rerata Skor Hasil Supervisi per Sekolah</h4>
                  <p className="text-[11px] text-slate-500">Membandingkan standar kualitas sekolah dasar di wilayah Kapuas Kuala</p>
                </div>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>

              {processedSchoolData.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 italic">Belum ada data evaluasi terkumpul.</div>
              ) : (
                <div className="space-y-4 pt-2">
                  {processedSchoolData.map((school, index) => {
                    const colors = ['bg-amber-500', 'bg-sky-500', 'bg-teal-500', 'bg-emerald-500'];
                    const chosenColor = colors[index % colors.length];
                    
                    return (
                      <div key={school.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">{school.name}</span>
                          <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{school.avg}</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${chosenColor} rounded-full transition-all duration-1000 ease-out`} 
                            style={{ width: `${school.avg}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SVG Chart 2: Capaian Nilai per Indikator Rubrik */}
            <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">Analisis Kompetensi Rerata per Indikator Rubrik</h4>
                  <p className="text-[11px] text-slate-500">Mendeteksi indikator mengajar terkuat dan yang membutuhkan pelatihan lanjutan</p>
                </div>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>

              {evaluations.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 italic">Belum ada data evaluasi terkumpul.</div>
              ) : (
                <div className="space-y-3 pt-2">
                  {processedCategoryData.map((cat, index) => {
                    return (
                      <div key={cat.name} className="flex items-center space-x-3">
                        <span className="w-24 text-[10px] font-bold text-slate-500 truncate" title={cat.name}>
                          {cat.name}
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-600 rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${cat.avg}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-bold text-slate-800">{cat.avg}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Table list of recorded evaluations */}
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h4 className="font-sans font-bold text-slate-900 text-sm">Daftar Hasil Rekapitulasi Akademik</h4>
                <p className="text-[11px] text-slate-500">Arsip digital dan analisis evaluasi supervisi akademik yang telah tersimpan</p>
              </div>
            </div>

            {evaluations.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 italic">Belum ada guru yang disupervisi.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-100">
                    <tr>
                      <th className="p-3">Nama Guru</th>
                      <th className="p-3">Sekolah</th>
                      <th className="p-3">Mapel & Materi</th>
                      <th className="p-3 text-center">Skor Akhir</th>
                      <th className="p-3 text-center">Predikat</th>
                      <th className="p-3 text-right">Laporan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" id="evaluations-table-body">
                    {evaluations.map((evalItem) => {
                      const teacherUser = allUsers.find(
                        (u) => u.id === evalItem.teacherId || u.name.toLowerCase() === evalItem.teacherName.toLowerCase()
                      );
                      const teacherNameDisplay = teacherUser?.name || evalItem.teacherName;
                      const schoolNameDisplay = teacherUser?.schoolName || evalItem.schoolName;
                      return (
                        <tr key={evalItem.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{teacherNameDisplay}</td>
                          <td className="p-3 text-slate-600">{schoolNameDisplay}</td>
                        <td className="p-3">
                          <span className="block font-medium text-slate-800">{evalItem.subject}</span>
                          <span className="block text-[10px] text-slate-400 truncate max-w-xs">{evalItem.topic}</span>
                        </td>
                        <td className="p-3 text-center font-extrabold text-amber-700">{evalItem.finalScore}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getPredicateBadge(evalItem.predicate)}`}>
                            {getPredicateLabel(evalItem.predicate).split(' ')[0]}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${window.location.origin}${window.location.pathname}?raport=${evalItem.id}&print=true`;
                                window.open(url, '_blank');
                              }}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center space-x-1"
                              title="Cetak Raport atau Simpan sebagai PDF"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Cetak</span>
                            </button>
                            <button
                              onClick={() => {
                                if (onViewRaport) {
                                  onViewRaport(evalItem.id);
                                } else {
                                  const url = new URL(window.location.href);
                                  url.searchParams.set('raport', evalItem.id);
                                  window.open(url.toString(), '_blank');
                                }
                              }}
                              className="text-xs font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2.5 py-1 rounded transition-colors cursor-pointer"
                              id={`btn-report-view-${evalItem.id}`}
                            >
                              Buka Raport
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIWAYAT UNDUHAN LOCAL STORAGE PANEL */}
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6 mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">Riwayat Unduhan Laporan (Penyimpanan Lokal / Local Storage)</h4>
                  <p className="text-[11px] text-slate-500">Daftar laporan hasil Supervisi Akademik yang telah diunduh di peramban ini</p>
                </div>
              </div>
              {downloadHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                  id="btn-clear-download-history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Bersihkan Riwayat</span>
                </button>
              )}
            </div>

            {downloadHistory.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 italic">
                Belum ada laporan yang pernah diunduh pada sesi peramban ini. Silakan buka raport di atas lalu klik tombol &ldquo;UNDUH&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-100">
                    <tr>
                      <th className="p-3">Nama File Laporan (.pdf)</th>
                      <th className="p-3">Guru & Sekolah</th>
                      <th className="p-3">Waktu Unduh</th>
                      <th className="p-3 text-center">Skor & Predikat</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {downloadHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-slate-800">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-rose-500 flex-shrink-0" />
                            <span className="truncate max-w-xs font-mono text-xs" title={item.filename}>
                              {item.filename}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="block font-bold text-slate-800">{item.teacherName}</span>
                          <span className="block text-[10px] text-slate-500">{item.schoolName}</span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {new Date(item.downloadedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })} - {new Date(item.downloadedAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-extrabold text-amber-700 block text-xs">{item.finalScore}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{item.predicate.replace('_', ' ')}</span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleDownloadFromHistory(item.evaluationId)}
                              className="text-[11px] font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded transition-colors flex items-center space-x-1 cursor-pointer"
                              title="Unduh Ulang"
                            >
                              <Download className="h-3 w-3" />
                              <span>Unduh Lagi</span>
                            </button>
                            <button
                              onClick={() => handleRemoveHistoryItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                              title="Hapus dari Riwayat"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'KELOLA' && (
        <div className="space-y-6 animate-fadeIn font-sans" id="pengawas-kelola-container">
              {/* Top Card: Info & Welcome */}
              <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 shadow-xl shadow-slate-100/40">
                <h3 className="text-lg font-bold text-slate-900 flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-amber-600" />
                  Pusat Kendali & Kelola Data Master (ASAGK)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Gunakan halaman ini untuk mengelola akun pengguna (Guru, Kepala Sekolah, dan Pengawas), serta melakukan pembersihan data rekapitulasi supervisi akademik secara dinamis.
                </p>
                {mgmtSuccessMsg && (
                  <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{mgmtSuccessMsg}</span>
                  </div>
                )}
                {mgmtErrorMsg && (
                  <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{mgmtErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* Sub-Tabs / Sub-Menu di Kelola Data Master */}
              <div className="flex border-b border-slate-200 bg-white p-1 rounded-2xl border-2 border-slate-100 shadow-sm overflow-x-auto gap-2">
                <button
                  type="button"
                  onClick={() => setKelolaSubTab('DAFTAR')}
                  className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    kelolaSubTab === 'DAFTAR'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  id="subtab-kelola-daftar"
                >
                  <User className="h-4 w-4 text-current" />
                  <span>Daftar Pengguna ({allUsers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKelolaSubTab('TAMBAH')}
                  className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    kelolaSubTab === 'TAMBAH'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  id="subtab-kelola-tambah"
                >
                  <Plus className="h-4 w-4 text-current" />
                  <span>Tambah Pengguna Baru</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKelolaSubTab('SISTEM')}
                  className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    kelolaSubTab === 'SISTEM'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  id="subtab-kelola-sistem"
                >
                  <ShieldAlert className="h-4 w-4 text-current" />
                  <span>Pemeliharaan Sistem</span>
                </button>
              </div>

              {/* Sub-Tabs Content */}
              {kelolaSubTab === 'DAFTAR' && (
                <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden animate-fadeIn">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Daftar Akun Terdaftar ({allUsers.length})</h4>
                      <p className="text-[11px] text-slate-500">Guru, Kepala Sekolah, dan Pengawas aktif di sistem</p>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {allUsers.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 italic">
                        Tidak ada pengguna yang terdaftar di sistem.
                      </div>
                    ) : (
                      allUsers.map((user) => (
                        <div key={user.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                              user.role === 'PENGAWAS' ? 'bg-amber-100 text-amber-700' :
                              user.role === 'KEPALA_SEKOLAH' ? 'bg-indigo-100 text-indigo-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm">{user.name}</span>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  user.role === 'PENGAWAS' ? 'bg-amber-600 text-white' :
                                  user.role === 'KEPALA_SEKOLAH' ? 'bg-indigo-600 text-white' :
                                  'bg-emerald-600 text-white'
                                }`}>
                                  {user.role.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-bold">@{user.username}</span>
                                {user.nip && <span>&bull; NIP. {user.nip}</span>}
                                {user.schoolName && <span>&bull; {user.schoolName}</span>}
                                {user.gradeLevel && (
                                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {user.gradeLevel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {/* Update Button */}
                            <button
                              type="button"
                              onClick={() => setEditingUser(user)}
                              className="p-2 rounded-xl transition-all border bg-white hover:bg-amber-50 border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200 cursor-pointer flex items-center space-x-1"
                              title="Update / Edit Akun"
                            >
                              <Edit3 className="h-4 w-4" />
                              <span className="text-xs font-bold pr-1 hidden sm:inline">Update</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.id === currentUser.id}
                              className={`p-2 rounded-xl transition-all border ${
                                user.id === currentUser.id
                                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                  : 'bg-white hover:bg-rose-50 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 cursor-pointer'
                              }`}
                              title={user.id === currentUser.id ? "Tidak dapat menghapus akun Anda sendiri" : "Hapus Akun"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {kelolaSubTab === 'TAMBAH' && (
                <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 shadow-xl shadow-slate-100/40 animate-fadeIn">
                  <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center">
                    <Plus className="h-4.5 w-4.5 mr-1.5 text-amber-600" />
                    Tambah Akun Baru
                  </h4>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Nama Lengkap & Gelar</label>
                        <input
                          type="text"
                          placeholder="Contoh: Purwanti, S.Pd.SD"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Username</label>
                          <input
                            type="text"
                            placeholder="purwanti"
                            value={newUserUsername}
                            onChange={(e) => setNewUserUsername(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Kata Sandi (Password)</label>
                          <input
                            type="text"
                            placeholder="Sandi"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Peran (Role)</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as any)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                        >
                          <option value="GURU">GURU (Mengunggah RPP/Modul, Mengisi Agenda)</option>
                          <option value="KEPALA_SEKOLAH">KEPALA SEKOLAH (Persetujuan Agenda)</option>
                          <option value="PENGAWAS">PENGAWAS KORWIL (Rubrik & Analisis Supervisi)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Nomor Induk Pegawai (NIP)</label>
                        <input
                          type="text"
                          placeholder="Opsional - Contoh: 19820412 201102 2 001"
                          value={newUserNip}
                          onChange={(e) => setNewUserNip(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Sekolah Dasar (SD)</label>
                        <input
                          type="text"
                          placeholder="Opsional - Contoh: SD Negeri 1 Tamban Baru Selatan"
                          value={newUserSchool}
                          onChange={(e) => setNewUserSchool(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </div>

                      {newUserRole === 'GURU' && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Kelas & Beban Mengajar</label>
                          <input
                            type="text"
                            placeholder="Contoh: Kelas IV (Empat)"
                            value={newUserGrade}
                            onChange={(e) => setNewUserGrade(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-100 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ml-auto"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Simpan Akun Baru</span>
                    </button>
                  </form>
                </div>
              )}

              {kelolaSubTab === 'SISTEM' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                  {/* Clear history block */}
                  <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 shadow-xl shadow-slate-100/40 space-y-4">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center">
                      <ShieldAlert className="h-5 w-5 mr-1.5 text-rose-500" />
                      Pembersihan Riwayat Supervisi
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Menghapus seluruh rekapitulasi data rekam supervisi akademik. Tindakan ini akan mengosongkan agenda guru kelas dan seluruh lembar evaluasi (raport) yang telah terbuat.
                    </p>
                    
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-rose-700 flex items-start space-x-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                      <span><strong>PERINGATAN:</strong> Setelah dihapus, data agenda supervisi and hasil rubrik nilai tidak dapat dikembalikan.</span>
                    </div>

                    <button
                      type="button"
                      id="btn-clear-supervision-history"
                      onClick={() => {
                        if (window.confirm('APAKAH ANDA YAKIN INGIN MENGHAPUS SEMUA RIWAYAT JADWAL DAN EVALUASI SUPERVISI?\nTindakan ini akan mengosongkan seluruh agenda guru, jadwal supervisi, dan raport evaluasi di sistem.')) {
                          if (onClearSupervision) {
                            onClearSupervision();
                            localStorage.removeItem('asagk_download_history');
                            setDownloadHistory([]);
                            setViewingEval(null);
                            setSelectedAgenda(null);
                            setMgmtSuccessMsg('Seluruh riwayat agenda supervisi dan raport nilai berhasil dibersihkan dari sistem.');
                            setTimeout(() => setMgmtSuccessMsg(''), 6000);
                          }
                        }
                      }}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-700 hover:text-rose-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Hapus Semua Riwayat Supervisi</span>
                    </button>
                  </div>

                  {/* Complete factory reset */}
                  <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 shadow-xl shadow-slate-100/40 space-y-4">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center">
                      <Settings className="h-5 w-5 mr-1.5 text-slate-700" />
                      Atur Ulang Aplikasi (Reset)
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Tindakan &ldquo;Atur Ulang&rdquo; akan mengembalikan aplikasi ke pengaturan default bawaan. Semua akun buatan baru, agenda, serta riwayat supervisi akan dihapus permanen. Sesi masuk Anda akan dikeluarkan secara otomatis.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('APAKAH ANDA YAKIN INGIN MELAKUKAN RESET SISTEM SECARA KESELURUHAN?\nTindakan ini akan menghapus semua pengguna tambahan dan riwayat supervisi, lalu mengembalikan profil bawaan.')) {
                          if (onResetAllData) {
                            onResetAllData();
                          }
                        }
                      }}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Reset Aplikasi ke Setelan Bawaan</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL EDIT PENGGUNA (UPDATE USER) */}
              {editingUser && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn" id="update-user-modal">
                  <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleIn">
                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                      <h5 className="font-bold text-xs flex items-center">
                        <Edit3 className="h-4 w-4 mr-2 text-amber-500" />
                        Update Data Pengguna ({editingUser.name})
                      </h5>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="p-1 text-slate-400 hover:text-white rounded cursor-pointer text-sm"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleUpdateUserSubmit} className="p-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Nama Lengkap & Gelar</label>
                        <input
                          type="text"
                          required
                          value={editingUser.name}
                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Username</label>
                          <input
                            type="text"
                            required
                            value={editingUser.username}
                            onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Kata Sandi (Password)</label>
                          <input
                            type="text"
                            required
                            value={editingUser.password || ''}
                            onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Peran (Role)</label>
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                          >
                            <option value="GURU">GURU</option>
                            <option value="KEPALA_SEKOLAH">KEPALA SEKOLAH</option>
                            <option value="PENGAWAS">PENGAWAS</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">NIP</label>
                          <input
                            type="text"
                            placeholder="Contoh: 19820412 201102 2 001"
                            value={editingUser.nip || ''}
                            onChange={(e) => setEditingUser({ ...editingUser, nip: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Sekolah Dasar (SD)</label>
                        <input
                          type="text"
                          placeholder="SD Negeri ..."
                          value={editingUser.schoolName || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, schoolName: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </div>

                      {editingUser.role === 'GURU' && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">Kelas & Beban Mengajar</label>
                          <input
                            type="text"
                            placeholder="Contoh: Kelas IV (Empat)"
                            value={editingUser.gradeLevel || ''}
                            onChange={(e) => setEditingUser({ ...editingUser, gradeLevel: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                          />
                        </div>
                      )}

                      <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingUser(null)}
                          className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Simpan Perubahan
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 5: PUSAT KEAMANAN & AUDIT FORENSIK DOKUMEN */}
          {activeTab === 'KEAMANAN' && (
            <SecurityCenterPanel
              currentUser={currentUser}
              evaluations={evaluations}
              allUsers={allUsers}
            />
          )}

          {/* DETAIL MODAL (RAPORT LAPORAN SUPERVISI) */}
          {viewingEval && (() => {
            const teacherUser = allUsers.find(
              (u) => u.id === viewingEval.teacherId || u.name.toLowerCase() === viewingEval.teacherName.toLowerCase()
            );
            const teacherName = teacherUser?.name || viewingEval.teacherName;
            const schoolName = teacherUser?.schoolName || viewingEval.schoolName;

            const kepsekUser = allUsers.find(
              (u) => u.role === 'KEPALA_SEKOLAH' && u.schoolName === schoolName
            ) || allUsers.find((u) => u.role === 'KEPALA_SEKOLAH');
            const kepsekName = kepsekUser?.name || 'Suwanto, S.Pd.SD';
            const kepsekNip = kepsekUser?.nip ? `NIP. ${kepsekUser.nip}` : 'NIP. 19680315 198910 1 002';

            const pengawasUser = allUsers.find(
              (u) => u.role === 'PENGAWAS' && u.name.toLowerCase() === viewingEval.supervisorName.toLowerCase()
            ) || allUsers.find((u) => u.role === 'PENGAWAS');
            const supervisorName = pengawasUser?.name || viewingEval.supervisorName;
            const supervisorNip = pengawasUser?.nip || '19650212 198711 1 001';
            const supervisorNipFormatted = supervisorNip.startsWith('NIP') ? supervisorNip : `NIP. ${supervisorNip}`;

            return (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn" id="report-modal">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto" id="report-modal-content">
                
                {/* Print and Close buttons */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center sticky top-0 rounded-t-2xl z-20">
                  <h5 className="font-bold text-xs flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-indigo-400" />
                    Lembar Laporan Hasil Supervisi Akademik (ASAGK)
                  </h5>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleDownloadPdf}
                      disabled={isDownloadingPdf}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      <Download className={`h-3.5 w-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
                      <span>{isDownloadingPdf ? 'MENGUNDUH...' : 'UNDUH'}</span>
                    </button>
                    <button
                      onClick={handlePrintReport}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Cetak Laporan atau Simpan sebagai PDF"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>CETAK</span>
                    </button>
                    <button
                      onClick={() => setViewingEval(null)}
                      className="p-1 text-slate-400 hover:text-white rounded cursor-pointer text-xs ml-2"
                    >
                      &times; Tutup
                    </button>
                  </div>
                </div>

                {/* Printable Certificate/Report Frame */}
                <div className="p-8 sm:p-10 space-y-6 text-slate-800 print:p-0" id="printable-report">
                  
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
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">KORWIL BIDANG PENDIDIKAN KECAMATAN KAPUAS KUALA</h3>
                      <p className="text-[10px] sm:text-xs text-slate-600">Alamat: Kantor Kecamatan Kapuas Kuala, Lupak Dalam, Kab. Kapuas, Kalimantan Tengah</p>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Arsip Digital Aplikasi Supervisi Akademik Guru Kelas (ASAGK)</p>
                    </div>
                  </div>

                  {/* Document Title */}
                  <div className="text-center space-y-1.5 pt-2">
                    <h4 className="text-sm font-bold underline tracking-wider uppercase">LAPORAN HASIL SUPERVISI AKADEMIK</h4>
                    <p className="text-xs text-slate-500 font-mono">Nomor Registrasi: {getFullRegistrationNumber(viewingEval, evaluations)}</p>
                  </div>

                  {/* Informational table */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4">
                    <div className="space-y-2">
                      <p><strong className="inline-block w-28 text-slate-500">Nama Guru:</strong> <span className="font-bold text-slate-900">{teacherName}</span></p>
                      <p><strong className="inline-block w-28 text-slate-500">Sekolah Dasar:</strong> <span className="font-bold text-slate-900">{schoolName}</span></p>
                      <p><strong className="inline-block w-28 text-slate-500">Mata Pelajaran:</strong> <span className="font-bold text-slate-900">{viewingEval.subject}</span></p>
                    </div>
                    <div className="space-y-2">
                      <p><strong className="inline-block w-28 text-slate-500">Materi Pokok:</strong> <span className="font-bold text-slate-900 italic">&ldquo;{viewingEval.topic}&rdquo;</span></p>
                      <p><strong className="inline-block w-28 text-slate-500">Tanggal Supervisi:</strong> <span className="font-bold text-slate-900">{viewingEval.date}</span></p>
                      <p><strong className="inline-block w-28 text-slate-500">Supervisor:</strong> <span className="font-bold text-slate-900">{supervisorName}</span></p>
                    </div>
                  </div>

                  {/* Scores breakdown table */}
                  <div className="pt-4">
                    <table className="w-full text-xs text-left border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-300 p-2 text-center w-10">No</th>
                          <th className="border border-slate-300 p-2">Indikator Supervisi Akademik</th>
                          <th className="border border-slate-300 p-2 text-center w-24">Skor (0-100)</th>
                          <th className="border border-slate-300 p-2">Catatan Khusus Pengawas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {viewingEval.scores.map((s, idx) => {
                          const catName = RUBRIC_CATEGORIES.find((c) => c.id === s.categoryId)?.name || 'Rubrik';
                          return (
                            <tr key={s.categoryId}>
                              <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                              <td className="border border-slate-300 p-2 font-semibold text-slate-800">{catName}</td>
                              <td className="border border-slate-300 p-2 text-center font-bold text-indigo-700">{s.score}</td>
                              <td className="border border-slate-300 p-2 text-slate-600 text-[11px] italic">{s.notes || '-'}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-bold text-slate-900 text-sm">
                          <td colSpan={2} className="border border-slate-300 p-2 text-right">SKOR RATA-RATA TOTAL:</td>
                          <td className="border border-slate-300 p-2 text-center text-indigo-700 font-extrabold">{viewingEval.finalScore}</td>
                          <td className="border border-slate-300 p-2 text-xs bg-indigo-50/50">
                            Predikat: <strong className="text-indigo-800">{getPredicateLabel(viewingEval.predicate)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* General findings notes & Recommendations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 text-xs">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-2">CATATAN UMUM PEMBELAJARAN</p>
                      <p className="text-slate-700 italic leading-relaxed">&ldquo;{viewingEval.generalNotes}&rdquo;</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-2">SARAN DAN REKOMENDASI TINDAK LANJUT</p>
                      <p className="text-slate-700 italic leading-relaxed">&ldquo;{viewingEval.recommendations}&rdquo;</p>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="pt-10 flex justify-between text-xs font-sans">
                    <div className="text-center space-y-16">
                      <p className="text-slate-500">Kepala Sekolah Mitra,</p>
                      <div className="space-y-1">
                        <p className="font-bold underline text-slate-800">{kepsekName}</p>
                        <p className="text-[10px] text-slate-500">{kepsekNip}</p>
                      </div>
                    </div>
                    <div className="text-center space-y-3">
                      <div>
                        <p className="text-slate-500">Lupak Dalam, {new Date(viewingEval.evaluatedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                        <p className="text-slate-500 mt-1 font-semibold">Supervisor / Pengawas Sekolah,</p>
                      </div>
                      <div className="py-1">
                        <ElectronicSignatureBarcode
                          supervisorName={supervisorName}
                          supervisorNip={supervisorNip}
                          evaluationId={viewingEval.id}
                          evaluationDate={new Date(viewingEval.evaluatedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                          teacherName={teacherName}
                          schoolName={schoolName}
                          finalScore={viewingEval.finalScore}
                          predicate={viewingEval.predicate}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold underline text-slate-800">{supervisorName}</p>
                        <p className="text-[10px] text-slate-500">{supervisorNipFormatted}</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Modal Footer actions */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-2">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className={`h-3.5 w-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
                    <span>{isDownloadingPdf ? 'MENGUNDUH PDF...' : 'UNDUH PDF'}</span>
                  </button>
                  <button
                    onClick={handlePrintReport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>CETAK LAPORAN</span>
                  </button>
                  <button
                    onClick={() => setViewingEval(null)}
                    className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    Tutup Laporan
                  </button>
                </div>

              </div>
            </div>
            );
          })()}

    </div>
  );
}
