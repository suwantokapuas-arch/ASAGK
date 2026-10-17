import React from 'react';
import { UserProfile, SupervisionAgenda, SupervisionEvaluation } from '../types';
import { CheckCircle, XCircle, FileText, Calendar, Clock, User, MessageSquare, AlertCircle, FileCheck, Layers, BookOpen, X, ExternalLink, Award, Download, Trash2, Printer } from 'lucide-react';

interface KepalaSekolahDashboardProps {
  currentUser: UserProfile;
  agendas: SupervisionAgenda[];
  evaluations: SupervisionEvaluation[];
  onApproveAgenda: (agendaId: string, feedback?: string) => void;
  onRejectAgenda: (agendaId: string, feedback: string) => void;
  onDeleteAgenda?: (agendaId: string) => void;
  onDeleteEvaluation?: (evalId: string) => void;
  onViewRaport?: (evalId: string) => void;
}

export default function KepalaSekolahDashboard({
  currentUser,
  agendas,
  evaluations,
  onApproveAgenda,
  onRejectAgenda,
  onDeleteAgenda,
  onDeleteEvaluation,
  onViewRaport,
}: KepalaSekolahDashboardProps) {
  const [feedbackInputs, setFeedbackInputs] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState<'PENDING' | 'HISTORY' | 'REPORTS'>('PENDING');
  const [viewingDocumentAgenda, setViewingDocumentAgenda] = React.useState<SupervisionAgenda | null>(null);

  // Filter agendas that belong to teachers in the principal's school
  const schoolAgendas = agendas.filter(
    (a) => a.schoolName.toLowerCase() === currentUser.schoolName?.toLowerCase()
  );

  // Filter evaluations that belong to teachers in the principal's school
  const schoolEvaluations = (evaluations || []).filter(
    (e) => e.schoolName.toLowerCase() === currentUser.schoolName?.toLowerCase()
  );

  const pendingAgendas = schoolAgendas.filter((a) => a.status === 'PENDING');
  const processedAgendas = schoolAgendas.filter((a) => a.status !== 'PENDING');

  const handleFeedbackChange = (agendaId: string, value: string) => {
    setFeedbackInputs((prev) => ({ ...prev, [agendaId]: value }));
  };

  const handleApprove = (agendaId: string) => {
    const feedback = feedbackInputs[agendaId] || '';
    onApproveAgenda(agendaId, feedback.trim());
    // Clear feedback input
    setFeedbackInputs((prev) => {
      const copy = { ...prev };
      delete copy[agendaId];
      return copy;
    });
  };

  const handleReject = (agendaId: string) => {
    const feedback = feedbackInputs[agendaId] || '';
    if (!feedback.trim()) {
      alert('Harap berikan catatan/alasan penolakan agar guru dapat merevisi dengan jelas.');
      return;
    }
    onRejectAgenda(agendaId, feedback.trim());
    // Clear feedback input
    setFeedbackInputs((prev) => {
      const copy = { ...prev };
      delete copy[agendaId];
      return copy;
    });
  };

  const handleApproveFromModal = (agendaId: string) => {
    const feedback = feedbackInputs[agendaId] || '';
    onApproveAgenda(agendaId, feedback.trim());
    setViewingDocumentAgenda(null);
    setFeedbackInputs((prev) => {
      const copy = { ...prev };
      delete copy[agendaId];
      return copy;
    });
  };

  const handleRejectFromModal = (agendaId: string) => {
    const feedback = feedbackInputs[agendaId] || '';
    if (!feedback.trim()) {
      alert('Harap berikan catatan/alasan penolakan agar guru dapat merevisi dengan jelas.');
      return;
    }
    onRejectAgenda(agendaId, feedback.trim());
    setViewingDocumentAgenda(null);
    setFeedbackInputs((prev) => {
      const copy = { ...prev };
      delete copy[agendaId];
      return copy;
    });
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = "";

    if (activeTab === 'REPORTS') {
      fileName = `rekap_raport_supervisi_${currentUser.schoolName?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'sekolah'}_${new Date().toISOString().slice(0,10)}.csv`;
      
      // Header for Evaluations
      const headers = [
        "ID Evaluasi",
        "Nama Guru",
        "Sekolah Dasar",
        "Mata Pelajaran",
        "Materi Pokok",
        "Tanggal Supervisi",
        "Nama Pengawas/Supervisor",
        "Skor Akhir",
        "Predikat",
        "Catatan Umum",
        "Rekomendasi",
        "Waktu Evaluasi"
      ];
      
      const rows = schoolEvaluations.map(e => [
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
    } else {
      // Export agendas (pending or history)
      const isPending = activeTab === 'PENDING';
      const listToExport = isPending ? pendingAgendas : processedAgendas;
      fileName = `rekap_agenda_supervisi_${isPending ? 'pending' : 'riwayat'}_${currentUser.schoolName?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'sekolah'}_${new Date().toISOString().slice(0,10)}.csv`;

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
        "Catatan/Feedback"
      ];

      const rows = listToExport.map(a => [
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="kepsek-dashboard">
      
      {/* Principal Profile & School Info */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-100 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full uppercase">Persetujuan Jadwal</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">{currentUser.name}</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Validasi agenda kegiatan pembelajaran mengajar di <span className="font-semibold underline">{currentUser.schoolName}</span>.
            </p>
          </div>
          <div className="bg-white/10 px-4 py-3 rounded-2xl border border-white/10 text-center sm:text-right shrink-0">
            <span className="block text-xs text-emerald-100 font-semibold">Tugas Kepala Sekolah</span>
            <span className="text-lg font-bold text-white block mt-0.5">Persetujuan Dokumen RPP</span>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">Menunggu Validasi</span>
            <span className="text-3xl font-extrabold text-amber-500 block mt-1" id="metric-pending">{pendingAgendas.length}</span>
          </div>
          <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">Telah Disetujui</span>
            <span className="text-3xl font-extrabold text-emerald-500 block mt-1" id="metric-approved">
              {processedAgendas.filter((a) => a.status === 'APPROVED').length}
            </span>
          </div>
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/30 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">Dikembalikan / Revisi</span>
            <span className="text-3xl font-extrabold text-rose-500 block mt-1" id="metric-rejected">
              {processedAgendas.filter((a) => a.status === 'REJECTED').length}
            </span>
          </div>
          <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Tabs Area */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
        
        {/* Tab Headers */}
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="tab-kepsek-pending"
            >
              Menunggu Persetujuan ({pendingAgendas.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="tab-kepsek-history"
            >
              Riwayat Keputusan ({processedAgendas.length})
            </button>
            <button
              onClick={() => setActiveTab('REPORTS')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'REPORTS'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="tab-kepsek-reports"
            >
              Raport Guru ({schoolEvaluations.length})
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-150 text-emerald-800 font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
              id="btn-kepsek-export-csv"
              title="Ekspor daftar ke file CSV untuk Microsoft Excel"
            >
              <Download className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>EKSPOR {activeTab === 'REPORTS' ? 'RAPORT' : 'AGENDA'} CSV</span>
            </button>
            <p className="text-xs text-slate-500 flex items-center hidden md:flex">
              <FileCheck className="h-4 w-4 mr-1.5 text-slate-400" />
              Supervisi Akademik Guru Kelas
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'PENDING' ? (
            pendingAgendas.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="h-12 w-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-700">Semua Berkas Sudah Diproses</p>
                  <p className="text-[11px] text-slate-500 mt-1">Belum ada pengajuan RPP atau jadwal mengajar baru dari guru kelas di sekolah Anda saat ini.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6" id="kepsek-pending-list">
                {pendingAgendas.map((agenda) => (
                  <div
                    key={agenda.id}
                    className="border border-slate-150 rounded-xl p-5 hover:shadow-xs transition-shadow bg-slate-50/10"
                    id={`pending-item-${agenda.id}`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: Agenda & Teacher Details */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-start space-x-3">
                          <div className="h-9 w-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                            {agenda.teacherName.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500">Guru Kelas</span>
                            <h4 className="font-bold text-slate-800 text-sm">{agenda.teacherName}</h4>
                            <span className="text-[11px] text-slate-400 block mt-0.5">Diajukan pada: {new Date(agenda.submittedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</span>
                          </div>
                        </div>

                        {/* Subject details & Topic */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded flex items-center">
                              <Layers className="h-3 w-3 mr-1" />
                              {agenda.gradeLevel}
                            </span>
                            <span className="text-xs font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded flex items-center">
                              <BookOpen className="h-3 w-3 mr-1" />
                              {agenda.subject}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Materi Pelajaran</span>
                            <p className="text-xs font-bold text-slate-800 mt-0.5">{agenda.topic}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50 text-xs">
                            <div className="flex items-center text-slate-600">
                              <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                              <span>{agenda.date}</span>
                            </div>
                            <div className="flex items-center text-slate-600">
                              <Clock className="h-4 w-4 mr-2 text-slate-400" />
                              <span>Pukul {agenda.time} WIB</span>
                            </div>
                          </div>
                        </div>

                        {/* Document review link */}
                        {agenda.document && (
                          <button
                            type="button"
                            onClick={() => setViewingDocumentAgenda(agenda)}
                            className="w-full flex items-center justify-between bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-100/50 p-3 rounded-xl text-xs text-left cursor-pointer transition-all group"
                            id={`btn-tinjau-document-${agenda.id}`}
                          >
                            <div className="flex items-center min-w-0">
                              <FileText className="h-4 w-4 mr-2.5 text-rose-500 shrink-0 group-hover:scale-110 transition-transform" />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 truncate block group-hover:text-emerald-700 transition-colors">{agenda.document.fileName}</span>
                                <span className="text-slate-500 text-[10px]">{agenda.document.fileSize} • Uploaded RPP/Modul</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md shrink-0 transition-colors">
                              Tinjau RPP
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Right: Actions and feedback textarea */}
                      <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center">
                            <MessageSquare className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
                            Catatan atau Rekomendasi (Opsional)
                          </label>
                          <textarea
                            value={feedbackInputs[agenda.id] || ''}
                            onChange={(e) => handleFeedbackChange(agenda.id, e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-hidden transition-all h-24 resize-none"
                            placeholder="Tuliskan catatan persetujuan atau alasan revisi/penolakan..."
                            id={`feedback-input-${agenda.id}`}
                          />
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                          <button
                            onClick={() => handleReject(agenda.id)}
                            className="flex-1 py-2.5 px-3 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                            id={`btn-reject-${agenda.id}`}
                          >
                            <XCircle className="h-4 w-4 shrink-0" />
                            <span>Tolak / Revisi</span>
                          </button>
                          <button
                            onClick={() => handleApprove(agenda.id)}
                            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-100 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                            id={`btn-approve-${agenda.id}`}
                          >
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            <span>Setujui Agenda</span>
                          </button>
                          {onDeleteAgenda && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Hapus pengajuan agenda untuk ${agenda.teacherName}?`)) {
                                  onDeleteAgenda(agenda.id);
                                }
                              }}
                              className="p-2.5 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-colors cursor-pointer shrink-0"
                              title="Hapus Agenda"
                              id={`btn-delete-kepsek-agenda-${agenda.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'HISTORY' ? (
            processedAgendas.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <User className="h-6 w-6" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-700">Belum Ada Riwayat</p>
                  <p className="text-[11px] text-slate-500 mt-1">Anda belum melakukan tindakan persetujuan atau penolakan jadwal pada periode ini.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" id="kepsek-history-list">
                {processedAgendas.map((agenda) => (
                  <div
                    key={agenda.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      agenda.status === 'APPROVED' 
                        ? 'border-emerald-100 bg-emerald-50/5' 
                        : 'border-rose-100 bg-rose-50/5'
                    }`}
                    id={`history-item-${agenda.id}`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800">{agenda.teacherName}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[11px] font-semibold text-slate-500">{agenda.gradeLevel} - {agenda.subject}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1.5">{agenda.topic}</p>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-slate-500">
                        <span>Jadwal: {agenda.date} @ {agenda.time} WIB</span>
                        {agenda.feedback && (
                          <span className="text-slate-600">
                            <strong>Catatan Anda:</strong> &ldquo;{agenda.feedback}&rdquo;
                          </span>
                        )}
                      </div>

                      {/* Document in history */}
                      {agenda.document && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setViewingDocumentAgenda(agenda)}
                            className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileText className="h-3 w-3 text-rose-500" />
                            <span>{agenda.document.fileName}</span>
                            <span className="text-[10px] text-slate-400">({agenda.document.fileSize})</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 self-start sm:self-center flex items-center space-x-2">
                      {agenda.status === 'APPROVED' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                          Telah Disetujui
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                          <XCircle className="h-3.5 w-3.5 mr-1 text-rose-500" />
                          Ditolak (Revisi)
                        </span>
                      )}
                      {onDeleteAgenda && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus riwayat agenda supervisi untuk ${agenda.teacherName}?`)) {
                              onDeleteAgenda(agenda.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Agenda"
                          id={`btn-delete-kepsek-history-${agenda.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            schoolEvaluations.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-700">Belum Ada Raport Terbit</p>
                  <p className="text-[11px] text-slate-500 mt-1">Belum ada guru di sekolah Anda yang telah dinilai oleh Pengawas Sekolah.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" id="kepsek-raport-list">
                {schoolEvaluations.map((evalItem) => (
                  <div
                    key={evalItem.id}
                    className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/10 hover:bg-emerald-50/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    id={`raport-item-${evalItem.id}`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {evalItem.id}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          Tanggal Penilaian: {evalItem.date}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">
                        {evalItem.teacherName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Mata Pelajaran: {evalItem.subject} • Topik: {evalItem.topic}</p>
                      
                      <div className="flex items-center space-x-4 mt-3">
                        <div className="text-xs">
                          <span className="text-slate-400 font-medium">Nilai Akhir: </span>
                          <span className="font-extrabold text-emerald-700 text-sm">{evalItem.finalScore}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-400 font-medium">Predikat: </span>
                          <span className="font-bold text-slate-700">{evalItem.predicate.replace('_', ' ')}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Oleh: {evalItem.supervisorName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}?raport=${evalItem.id}&print=true`;
                          window.open(url, '_blank');
                        }}
                        className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm shadow-indigo-100 border border-transparent"
                        title="Cetak Raport atau Simpan sebagai PDF"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Cetak Raport</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onViewRaport) {
                            onViewRaport(evalItem.id);
                          } else {
                            const url = new URL(window.location.href);
                            url.searchParams.set('raport', evalItem.id);
                            window.open(url.toString(), '_blank');
                          }
                        }}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm shadow-emerald-100 border border-transparent"
                      >
                        <span>Buka Raport</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* DETAIL MODAL (PENINJAUAN DOKUMEN RPP) */}
      {viewingDocumentAgenda && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="document-review-modal">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-sm">Peninjauan Dokumen RPP / Modul Ajar</h3>
                  <p className="text-[11px] text-slate-500">Materi: {viewingDocumentAgenda.topic}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingDocumentAgenda(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                id="btn-close-review-modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content - Split layout */}
            <div className="flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-12 text-slate-800">
              
              {/* Left Sidebar Info */}
              <div className="md:col-span-4 bg-slate-50/50 p-6 border-b md:border-b-0 md:border-r border-slate-100 space-y-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Guru Pengaju</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">{viewingDocumentAgenda.teacherName}</p>
                  <p className="text-[10px] text-slate-500">{viewingDocumentAgenda.schoolName}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Mata Pelajaran & Kelas</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {viewingDocumentAgenda.gradeLevel}
                    </span>
                    <span className="text-[10px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded">
                      {viewingDocumentAgenda.subject}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Rencana Observasi</span>
                  <p className="text-xs font-semibold text-slate-700 mt-1">{viewingDocumentAgenda.date}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Pukul {viewingDocumentAgenda.time} WIB</p>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Detail File Terlampir</span>
                  <div className="bg-white border border-slate-100 p-2.5 rounded-xl text-xs mt-1.5">
                    <p className="font-bold text-slate-800 truncate" title={viewingDocumentAgenda.document?.fileName}>
                      {viewingDocumentAgenda.document?.fileName}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{viewingDocumentAgenda.document?.fileSize} • PDF Document</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Status Dokumen</span>
                  <div className="mt-2">
                    {viewingDocumentAgenda.status === 'PENDING' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                        Menunggu Keputusan
                      </span>
                    )}
                    {viewingDocumentAgenda.status === 'APPROVED' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Telah Disetujui
                      </span>
                    )}
                    {viewingDocumentAgenda.status === 'REJECTED' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                        Ditolak / Perlu Revisi
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Document Content */}
              <div className="md:col-span-8 p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 uppercase tracking-wider">I. Tujuan Pembelajaran (TP)</h4>
                  <ul className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed">
                    <li>Melalui pengamatan media interaktif dan penyelidikan langsung, siswa kelas dapat mendeskripsikan serta memahami konsep pokok materi <span className="font-semibold text-slate-900">&ldquo;{viewingDocumentAgenda.topic}&rdquo;</span> secara kritis dan kolaboratif.</li>
                    <li>Siswa aktif memecahkan permasalahan nyata yang berkaitan dengan materi secara bergotong royong di dalam kelompok kerja masing-masing.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 uppercase tracking-wider">II. Langkah-Langkah Kegiatan Pembelajaran</h4>
                  <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                    <div>
                      <p className="font-bold text-slate-800">1. Kegiatan Pendahuluan (15 Menit)</p>
                      <p className="mt-1 pl-4 text-slate-600">Guru menyapa murid dengan hangat, berdoa bersama, memeriksa kehadiran kelas, melakukan apersepsi kontekstual, dan mengomunikasikan tujuan belajar serta alur penilaian hari ini.</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">2. Kegiatan Inti (50 Menit - Student Centered)</p>
                      <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-slate-600">
                        <li><strong className="text-slate-800">Orientasi Masalah:</strong> Guru memaparkan pemantik visual/benda nyata untuk merangsang rasa bernalar kritis.</li>
                        <li><strong className="text-slate-800">Gotong Royong:</strong> Murid berdiskusi aktif memecahkan Lembar Kerja Peserta Didik (LKPD) dalam kelompok heterogen.</li>
                        <li><strong className="text-slate-800">Presentasi & Tanggapan:</strong> Setiap kelompok menyajikan hasil kerjanya secara percaya diri untuk ditanggapi oleh kelompok lain.</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">3. Kegiatan Penutup (15 Menit)</p>
                      <p className="mt-1 pl-4 text-slate-600">Merangkum pemahaman konsep utama bersama murid, merefleksikan tingkat pemahaman serta minat belajar hari ini, memberikan penugasan mandiri terukur, dan menutup dengan doa bersama.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 uppercase tracking-wider">III. Strategi Diferensiasi</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-indigo-50/20 border border-indigo-100/55 p-3 rounded-xl">
                      <p className="font-bold text-indigo-900">Diferensiasi Proses</p>
                      <p className="text-[11px] text-slate-600 mt-1">Menggunakan ragam media visual & kinestetik nyata serta memberikan pendampingan personal (scaffolding) bagi yang memerlukan.</p>
                    </div>
                    <div className="bg-sky-50/20 border border-sky-100/55 p-3 rounded-xl">
                      <p className="font-bold text-sky-900">Diferensiasi Produk</p>
                      <p className="text-[11px] text-slate-600 mt-1">Murid dibebaskan menyampaikan presentasi kesimpulan berupa gambar berpita, rangkuman teks, atau pemaparan lisan interaktif.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 uppercase tracking-wider">IV. Rencana Asesmen / Penilaian</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 leading-relaxed">
                    <li><strong className="text-slate-800">Asesmen Sikap (Formatif):</strong> Penilaian jurnal observasi keaktifan kerja sama gotong-royong selama dinamika kelompok berlangsung.</li>
                    <li><strong className="text-slate-800">Asesmen Pengetahuan (Sumatif):</strong> Penilaian tertulis mandiri menggunakan lembar evaluasi isian singkat di akhir materi.</li>
                  </ul>
                </div>
              </div>

            </div>

            {/* Modal Footer / Review Actions */}
            <div className="bg-slate-50 border-t border-slate-100 p-6 shrink-0">
              {viewingDocumentAgenda.status === 'PENDING' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
                      <MessageSquare className="h-4 w-4 text-slate-400 mr-2" />
                      Catatan Validasi atau Masukan Revisi untuk Guru
                    </label>
                    <textarea
                      value={feedbackInputs[viewingDocumentAgenda.id] || ''}
                      onChange={(e) => handleFeedbackChange(viewingDocumentAgenda.id, e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-hidden transition-all h-20 resize-none"
                      placeholder="Berikan masukan perbaikan RPP, catatan persetujuan, atau alasan pengembalian/revisi..."
                      id={`modal-feedback-input-${viewingDocumentAgenda.id}`}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewingDocumentAgenda(null)}
                      className="w-full sm:w-auto py-2.5 px-5 border border-slate-200 text-slate-500 font-bold rounded-2xl text-xs hover:bg-slate-100 transition-colors cursor-pointer text-center"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectFromModal(viewingDocumentAgenda.id)}
                      className="w-full sm:w-auto py-2.5 px-5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                      id={`btn-modal-reject-${viewingDocumentAgenda.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Tolak & Minta Revisi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveFromModal(viewingDocumentAgenda.id)}
                      className="w-full sm:w-auto py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-100 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                      id={`btn-modal-approve-${viewingDocumentAgenda.id}`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Setujui Agenda & RPP</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-slate-850">
                  <div className="text-xs">
                    <span className="font-bold text-slate-800">Catatan Validasi Anda: </span>
                    <span className="text-slate-600 italic block mt-1">&ldquo;{viewingDocumentAgenda.feedback || 'Jadwal dan dokumen RPP disetujui untuk dilaksanakan.'}&rdquo;</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDocumentAgenda(null)}
                    className="w-full sm:w-auto py-2 px-5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer text-center shrink-0"
                  >
                    Tutup Peninjauan
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
