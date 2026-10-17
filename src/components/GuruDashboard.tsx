import React from 'react';
import { UserProfile, SupervisionAgenda, RppDocument, SupervisionEvaluation } from '../types';
import { Calendar, Clock, BookOpen, Layers, Upload, Send, CheckCircle, AlertTriangle, RefreshCw, FileText, Trash2, ExternalLink, Award, Printer } from 'lucide-react';

interface GuruDashboardProps {
  currentUser: UserProfile;
  agendas: SupervisionAgenda[];
  evaluations: SupervisionEvaluation[];
  onSubmitAgenda: (agendaData: Omit<SupervisionAgenda, 'id' | 'teacherId' | 'teacherName' | 'schoolName' | 'status' | 'submittedAt'>) => void;
  onDeleteAgenda?: (agendaId: string) => void;
  onDeleteEvaluation?: (evalId: string) => void;
  onViewRaport?: (evalId: string) => void;
}

export default function GuruDashboard({ currentUser, agendas, evaluations, onSubmitAgenda, onDeleteAgenda, onDeleteEvaluation, onViewRaport }: GuruDashboardProps) {
  // Form States
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('Kelas IV');
  const [subject, setSubject] = React.useState('Matematika');
  const [topic, setTopic] = React.useState('');
  
  // Document states
  const [simulatedFile, setSimulatedFile] = React.useState<RppDocument | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [formSuccess, setFormSuccess] = React.useState(false);
  
  // Re-submission state tracking (if editing a rejected one)
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Filter agendas for this specific teacher
  const myAgendas = agendas
    .filter((a) => a.teacherId === currentUser.id)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  // Filter evaluations for this specific teacher
  const myEvaluations = (evaluations || [])
    .filter((e) => e.teacherId === currentUser.id)
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());

  // Handle simulated file generation on file pick
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSimulatedFile({
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        uploadDate: new Date().toISOString().split('T')[0],
        contentTopic: topic || 'RPP Supervisi'
      });
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSimulatedFile({
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        uploadDate: new Date().toISOString().split('T')[0],
        contentTopic: topic || 'RPP Supervisi'
      });
    }
  };

  // Pre-load a sample RPP to make it extremely friendly for testing
  const loadTemplateRpp = () => {
    setSimulatedFile({
      fileName: `RPP_Supervisi_${subject.replace(/[^a-zA-Z0-9]/g, '_')}_${gradeLevel.replace(' ', '_')}.pdf`,
      fileSize: '1.4 MB',
      uploadDate: new Date().toISOString().split('T')[0],
      contentTopic: topic || `RPP ${subject}`
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);

    if (!date) {
      setFormError('Harap tentukan tanggal pelaksanaan supervisi.');
      return;
    }
    if (!time) {
      setFormError('Harap tentukan waktu pelaksanaan supervisi.');
      return;
    }
    if (!topic.trim()) {
      setFormError('Harap tuliskan materi pembelajaran yang akan dipraktekkan.');
      return;
    }
    if (!simulatedFile) {
      setFormError('Harap unggah RPP atau Modul Ajar terlebih dahulu.');
      return;
    }

    // Submit agenda data
    onSubmitAgenda({
      gradeLevel,
      subject,
      topic: topic.trim(),
      date,
      time,
      document: simulatedFile
    });

    // Reset form states
    setDate('');
    setTime('');
    setTopic('');
    setSimulatedFile(null);
    setEditingId(null);
    
    // Show success notification
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 4000);
  };

  const handleEditRejected = (agenda: SupervisionAgenda) => {
    setEditingId(agenda.id);
    setDate(agenda.date);
    setTime(agenda.time);
    setGradeLevel(agenda.gradeLevel);
    setSubject(agenda.subject);
    setTopic(agenda.topic);
    setSimulatedFile(agenda.document);
    
    // If the agenda exists and can be deleted on re-submission (or we just override it)
    if (onDeleteAgenda) {
      onDeleteAgenda(agenda.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="guru-dashboard">
      
      {/* Upper Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-650 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-100 mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Selamat Datang, {currentUser.name}!</h2>
        <p className="text-blue-100 text-sm mt-1 max-w-2xl">
          Atur agenda supervisi Anda dengan menginput jadwal mengajar, materi kelas yang akan dipraktikkan, serta mengunggah RPP untuk ditinjau oleh Kepala Sekolah Anda di <span className="font-semibold">{currentUser.schoolName}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form input */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6 relative">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 mb-5">
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-base">
                  {editingId ? 'Edit Pengajuan Agenda' : 'Pengajuan Agenda Baru'}
                </h3>
                <p className="text-[11px] text-slate-500">Tentukan rincian rencana supervisi akademik</p>
              </div>
            </div>

            {formSuccess && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 text-xs flex items-start space-x-2 mb-5 animate-fadeIn" id="success-submit-alert">
                <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-bold">Berhasil Diajukan!</p>
                  <p className="mt-0.5 text-emerald-600">Agenda supervisi Anda berhasil dikirim ke Kepala Sekolah untuk mendapatkan persetujuan.</p>
                </div>
              </div>
            )}

            {formError && (
              <div className="bg-rose-50 text-rose-700 p-3.5 rounded-xl border border-rose-100 text-xs flex items-start space-x-2 mb-5" id="error-submit-alert">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Class & Subject Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
                    <Layers className="h-3.5 w-3.5 text-slate-400 mr-1" />
                    Kelas
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-hidden transition-all"
                    id="select-grade"
                  >
                    <option value="Kelas I">Kelas I (Satu)</option>
                    <option value="Kelas II">Kelas II (Dua)</option>
                    <option value="Kelas III">Kelas III (Tiga)</option>
                    <option value="Kelas IV">Kelas IV (Empat)</option>
                    <option value="Kelas V">Kelas V (Lima)</option>
                    <option value="Kelas VI">Kelas VI (Enam)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400 mr-1" />
                    Mata Pelajaran
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-hidden transition-all"
                    id="select-subject"
                  >
                    <option value="Matematika">Matematika</option>
                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    <option value="Ilmu Pengetahuan Alam (IPA)">IPA</option>
                    <option value="Ilmu Pengetahuan Sosial (IPS)">IPS</option>
                    <option value="IPAS">IPAS (Kurikulum Merdeka)</option>
                    <option value="Pendidikan Pancasila (PPKn)">Pendidikan Pancasila</option>
                    <option value="Seni Budaya & Prakarya">Seni Budaya</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1" />
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-hidden transition-all"
                    id="input-date"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
                    <Clock className="h-3.5 w-3.5 text-slate-400 mr-1" />
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-hidden transition-all"
                    id="input-time"
                  />
                </div>
              </div>

              {/* Practice Topic Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Materi yang Akan Dipraktekkan
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-hidden transition-all h-20 resize-none"
                  placeholder="Contoh: Mengukur Keliling Bangun Datar dengan Satuan Baku"
                  id="input-topic"
                />
              </div>

              {/* RPP / Modul Upload Container */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Unggah RPP / Modul Ajar
                  </label>
                  <button
                    type="button"
                    onClick={loadTemplateRpp}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    Gunakan File Contoh
                  </button>
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50/50' 
                      : simulatedFile 
                        ? 'border-blue-200 bg-blue-50/20' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                  id="drag-drop-zone"
                >
                  {simulatedFile ? (
                    <div className="flex items-center justify-between bg-white border border-blue-100 rounded-xl p-3 text-left">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate" id="uploaded-file-name">{simulatedFile.fileName}</p>
                          <p className="text-[10px] text-slate-500">{simulatedFile.fileSize} • Terunggah {simulatedFile.uploadDate}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSimulatedFile(null)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Hapus file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto h-10 w-10 text-slate-400 bg-slate-100 rounded-full flex items-center justify-center">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="text-xs">
                        <label className="text-blue-600 font-bold hover:text-blue-700 cursor-pointer">
                          Pilih File RPP / Modul Ajar
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                        <span className="text-slate-500"> atau seret ke sini</span>
                      </div>
                      <p className="text-[9px] text-slate-400">Format yang didukung: PDF, DOCX (Maks. 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full mt-4 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                id="btn-agenda-submit"
              >
                <Send className="h-4 w-4" />
                <span>{editingId ? 'Ajukan Perubahan Agenda' : 'Ajukan Agenda Supervisi'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: History & Submitted agendas */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-base">Status Pengajuan Supervisi</h3>
                <p className="text-[11px] text-slate-500">Daftar agenda yang sedang dikonfirmasi atau telah disetujui</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full" id="agenda-count">
                {myAgendas.length} Pengajuan
              </span>
            </div>

            {myAgendas.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-700">Belum ada pengajuan</p>
                  <p className="text-[11px] text-slate-500 mt-1">Harap isi formulir di sebelah kiri untuk mengajukan jadwal dan modul RPP pembelajaran yang akan disupervisi.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" id="guru-agendas-list">
                {myAgendas.map((agenda) => (
                  <div
                    key={agenda.id}
                    className={`p-4 rounded-xl border transition-all ${
                      agenda.status === 'APPROVED' 
                        ? 'border-emerald-100 bg-emerald-50/10' 
                        : agenda.status === 'REJECTED' 
                          ? 'border-rose-100 bg-rose-50/10' 
                          : 'border-slate-100 bg-slate-50/30'
                    }`}
                    id={`agenda-item-${agenda.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        {/* Grade and Subject */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {agenda.gradeLevel}
                          </span>
                          <span className="text-xs font-semibold text-blue-700">
                            {agenda.subject}
                          </span>
                        </div>

                        {/* Practice Topic */}
                        <h4 className="text-sm font-bold text-slate-900 mt-2">
                          {agenda.topic}
                        </h4>

                        {/* Date and Time */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-slate-500 text-xs">
                          <span className="flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                            {agenda.date}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                            Pukul {agenda.time} WIB
                          </span>
                        </div>
                      </div>

                      {/* Status Badge & Actions */}
                      <div className="self-start flex items-center space-x-2">
                        {agenda.status === 'PENDING' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                            <RefreshCw className="h-3 w-3 animate-spin mr-1 text-amber-500" />
                            Menunggu Kepsek
                          </span>
                        )}
                        {agenda.status === 'APPROVED' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                            Disetujui Kepsek
                          </span>
                        )}
                        {agenda.status === 'REJECTED' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                            <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
                            Perlu Revisi
                          </span>
                        )}
                        {onDeleteAgenda && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Apakah Anda yakin ingin menghapus pengajuan agenda supervisi mapel ${agenda.subject}?`)) {
                                onDeleteAgenda(agenda.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Agenda Ini"
                            id={`btn-delete-guru-agenda-${agenda.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* RPP Attachment file */}
                    {agenda.document && (
                      <div className="mt-4 flex items-center justify-between bg-white border border-slate-100 p-2.5 rounded-lg text-xs">
                        <span className="flex items-center text-slate-700 min-w-0">
                          <FileText className="h-4 w-4 mr-2 text-rose-500 shrink-0" />
                          <span className="truncate font-medium">{agenda.document.fileName}</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">({agenda.document.fileSize})</span>
                        </span>
                        <span className="text-[10px] text-slate-400">RPP Terlampir</span>
                      </div>
                    )}

                    {/* Feedback box */}
                    {agenda.status === 'REJECTED' && agenda.feedback && (
                      <div className="mt-4 p-3 bg-red-50/50 rounded-lg border border-red-100/50 text-xs">
                        <p className="font-bold text-red-800">Catatan Revisi Kepala Sekolah:</p>
                        <p className="text-slate-700 mt-1 italic">&ldquo;{agenda.feedback}&rdquo;</p>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleEditRejected(agenda)}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded-md text-[11px] flex items-center cursor-pointer transition-colors shadow-xs"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Edit & Ajukan Ulang
                          </button>
                        </div>
                      </div>
                    )}

                    {agenda.status === 'APPROVED' && (
                      <div className="mt-3.5 pt-3.5 border-t border-dashed border-emerald-100/80 text-[11px] text-slate-500">
                        <span className="text-emerald-700 font-semibold">Catatan:</span> Rencana mengajar telah divalidasi. Agenda ini akan otomatis tampil di kalender Pengawas Sekolah saat login untuk dilakukan penilaian supervisi.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* REKAP RAPORT HASIL SUPERVISI */}
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-100/40 p-6 mt-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-base flex items-center">
                  <Award className="h-5 w-5 text-emerald-600 mr-2 shrink-0" />
                  Raport Hasil Supervisi Akademik
                </h3>
                <p className="text-[11px] text-slate-500">Hasil penilaian resmi dari Pengawas Sekolah</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100" id="raport-count">
                {myEvaluations.length} Raport
              </span>
            </div>

            {myEvaluations.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-700">Belum ada Raport Terbit</p>
                  <p className="text-[11px] text-slate-500 mt-1">Apabila kegiatan supervisi mengajar telah dinilai oleh Pengawas Sekolah, raport hasil belajar supervisi Anda akan otomatis diterbitkan di sini.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" id="guru-raport-list">
                {myEvaluations.map((evalItem) => (
                  <div
                    key={evalItem.id}
                    className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/10 hover:bg-emerald-50/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {evalItem.id}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          Tanggal {evalItem.date}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">
                        {evalItem.subject}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Topik: {evalItem.topic}</p>
                      
                      <div className="flex items-center space-x-4 mt-3">
                        <div className="text-xs">
                          <span className="text-slate-400 font-medium">Nilai Akhir: </span>
                          <span className="font-extrabold text-emerald-700 text-sm">{evalItem.finalScore}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-400 font-medium">Predikat: </span>
                          <span className="font-bold text-slate-700">{evalItem.predicate.replace('_', ' ')}</span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
