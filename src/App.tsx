import React from 'react';
import { UserProfile, SupervisionAgenda, SupervisionEvaluation } from './types';
import { USERS, INITIAL_AGENDAS, INITIAL_EVALUATIONS } from './data/mockData';
import { normalizeAndFindEvaluation } from './utils';
import LandingPage from './components/LandingPage';
import Header from './components/Header';
import GuruDashboard from './components/GuruDashboard';
import KepalaSekolahDashboard from './components/KepalaSekolahDashboard';
import PengawasDashboard from './components/PengawasDashboard';
import FullPageReport from './components/FullPageReport';
import SessionLockModal from './components/SessionLockModal';
import { sanitizeString, sanitizeObject, logSecurityEvent } from './security';
import {
  subscribeUsers,
  subscribeAgendas,
  subscribeEvaluations,
  saveUserToFirestore,
  batchSaveUsersToFirestore,
  saveAgendaToFirestore,
  deleteAgendaFromFirestore,
  batchSaveAgendasToFirestore,
  saveEvaluationToFirestore,
  deleteEvaluationFromFirestore,
  batchSaveEvaluationsToFirestore,
  clearSupervisionDataInFirestore,
} from './firebase';

export default function App() {
  const [users, setUsers] = React.useState<UserProfile[]>(() => {
    const savedUsers = localStorage.getItem('asagk_users');
    if (savedUsers) {
      try {
        const parsed: UserProfile[] = JSON.parse(savedUsers);
        const userMap = new Map(parsed.map((u) => [u.id, u]));
        let hasNew = false;
        USERS.forEach((u) => {
          if (!userMap.has(u.id)) {
            userMap.set(u.id, u);
            hasNew = true;
          }
        });
        const merged = Array.from(userMap.values());
        if (hasNew) {
          localStorage.setItem('asagk_users', JSON.stringify(merged));
        }
        return merged;
      } catch (e) {
        return USERS;
      }
    } else {
      localStorage.setItem('asagk_users', JSON.stringify(USERS));
      return USERS;
    }
  });

  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem('asagk_current_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error("Error parsing saved user session", e);
        return null;
      }
    }
    return null;
  });

  const [agendas, setAgendas] = React.useState<SupervisionAgenda[]>(() => {
    const savedAgendas = localStorage.getItem('asagk_agendas');
    const isCleared = localStorage.getItem('asagk_cleared') === 'true';
    if (savedAgendas) {
      try {
        const parsed = JSON.parse(savedAgendas);
        if (parsed.length === 0 && !isCleared) {
          return INITIAL_AGENDAS;
        }
        return parsed;
      } catch (e) {
        return INITIAL_AGENDAS;
      }
    } else {
      localStorage.setItem('asagk_agendas', JSON.stringify(INITIAL_AGENDAS));
      return INITIAL_AGENDAS;
    }
  });

  const [evaluations, setEvaluations] = React.useState<SupervisionEvaluation[]>(() => {
    const savedEvaluations = localStorage.getItem('asagk_evaluations');
    const isCleared = localStorage.getItem('asagk_cleared') === 'true';
    if (savedEvaluations) {
      try {
        const parsed = JSON.parse(savedEvaluations);
        if (parsed.length === 0 && !isCleared) {
          return INITIAL_EVALUATIONS;
        }
        return parsed;
      } catch (e) {
        return INITIAL_EVALUATIONS;
      }
    } else {
      localStorage.setItem('asagk_evaluations', JSON.stringify(INITIAL_EVALUATIONS));
      return INITIAL_EVALUATIONS;
    }
  });
  
  // Check for public raport query param
  const [raportId, setRaportId] = React.useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('raport');
  });

  const handleCloseRaport = () => {
    try {
      window.close();
    } catch (e) {
      // fallback
    }
    setRaportId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('raport');
    window.history.pushState({}, '', url.toString());
  };

  // 1. Session Lock & Inactivity Guard
  const [isSessionLocked, setIsSessionLocked] = React.useState(false);

  React.useEffect(() => {
    if (!currentUser) return;

    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsSessionLocked((alreadyLocked) => {
          if (!alreadyLocked) {
            logSecurityEvent({
              action: 'LOCK_SESSION',
              userName: currentUser.name,
              userRole: currentUser.role,
              details: 'Sesi terkunci otomatis setelah 15 menit tanpa aktivitas pengguna'
            });
            return true;
          }
          return alreadyLocked;
        });
      }, INACTIVITY_LIMIT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [currentUser]);

  // 2. Firebase Firestore Real-Time Synchronization
  const [isFirebaseSynced, setIsFirebaseSynced] = React.useState(false);

  React.useEffect(() => {
    // 1. Subscribe to Users
    const unsubUsers = subscribeUsers((remoteUsers) => {
      if (remoteUsers.length > 0) {
        // Merge with local USERS if any newly added mock user is missing
        const remoteMap = new Map(remoteUsers.map((u) => [u.id, u]));
        const missing: UserProfile[] = [];
        USERS.forEach((u) => {
          if (!remoteMap.has(u.id)) {
            missing.push(u);
            remoteMap.set(u.id, u);
          }
        });
        const combined = Array.from(remoteMap.values());
        setUsers(combined);
        localStorage.setItem('asagk_users', JSON.stringify(combined));
        if (missing.length > 0) {
          batchSaveUsersToFirestore(missing).catch((err) =>
            console.warn('Sync missing users to Firestore error:', err)
          );
        }
      } else {
        // First run: seed all initial users to Firestore
        batchSaveUsersToFirestore(USERS).catch((err) =>
          console.warn('Initial users seed to Firestore error:', err)
        );
      }
      setIsFirebaseSynced(true);
    });

    // 2. Subscribe to Agendas
    const isCleared = localStorage.getItem('asagk_cleared') === 'true';
    const unsubAgendas = subscribeAgendas((remoteAgendas) => {
      if (remoteAgendas.length > 0) {
        setAgendas(remoteAgendas);
        localStorage.setItem('asagk_agendas', JSON.stringify(remoteAgendas));
      } else if (!isCleared) {
        // Seed initial agendas if empty and not explicitly cleared
        batchSaveAgendasToFirestore(INITIAL_AGENDAS).catch((err) =>
          console.warn('Initial agendas seed error:', err)
        );
      } else {
        setAgendas([]);
      }
      setIsFirebaseSynced(true);
    });

    // 3. Subscribe to Evaluations
    const unsubEvaluations = subscribeEvaluations((remoteEvals) => {
      if (remoteEvals.length > 0) {
        setEvaluations(remoteEvals);
        localStorage.setItem('asagk_evaluations', JSON.stringify(remoteEvals));
      } else if (!isCleared) {
        // Seed initial evaluations if empty and not explicitly cleared
        batchSaveEvaluationsToFirestore(INITIAL_EVALUATIONS).catch((err) =>
          console.warn('Initial evaluations seed error:', err)
        );
      } else {
        setEvaluations([]);
      }
      setIsFirebaseSynced(true);
    });

    return () => {
      unsubUsers();
      unsubAgendas();
      unsubEvaluations();
    };
  }, []);

  // 2. State synchronization helpers
  const saveUsersToStorage = (updatedUsers: UserProfile[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('asagk_users', JSON.stringify(updatedUsers));
  };

  const saveAgendasToStorage = (updatedAgendas: SupervisionAgenda[]) => {
    setAgendas(updatedAgendas);
    localStorage.setItem('asagk_agendas', JSON.stringify(updatedAgendas));
    if (updatedAgendas.length === 0) {
      localStorage.setItem('asagk_cleared', 'true');
    }
  };

  const saveEvaluationsToStorage = (updatedEvaluations: SupervisionEvaluation[]) => {
    setEvaluations(updatedEvaluations);
    localStorage.setItem('asagk_evaluations', JSON.stringify(updatedEvaluations));
    if (updatedEvaluations.length === 0) {
      localStorage.setItem('asagk_cleared', 'true');
    }
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('asagk_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('asagk_current_user');
  };

  const handleSwitchUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      handleLogin(user);
    }
  };

  const handleUpdateUsers = (newUsers: UserProfile[]) => {
    saveUsersToStorage(newUsers);
    batchSaveUsersToFirestore(newUsers).catch((err) => console.error('Save users to Firestore error:', err));

    // Identify any users that were removed
    const removedUserIds = users.filter((u) => !newUsers.some((nu) => nu.id === u.id)).map((u) => u.id);
    const removedUserNames = users.filter((u) => !newUsers.some((nu) => nu.id === u.id)).map((u) => u.name.toLowerCase());

    let currentEvals = evaluations;

    if (removedUserIds.length > 0) {
      // Remove agendas belonging to deleted users
      const remainingAgendas = agendas.filter((a) => 
        !removedUserIds.includes(a.teacherId) && !removedUserNames.includes(a.teacherName.toLowerCase())
      );
      if (remainingAgendas.length !== agendas.length) {
        saveAgendasToStorage(remainingAgendas);
        agendas.filter(a => !remainingAgendas.some(ra => ra.id === a.id)).forEach(a => {
          deleteAgendaFromFirestore(a.id).catch(console.error);
        });
      }

      // Remove evaluations belonging to deleted users
      const remainingEvaluations = evaluations.filter((e) => 
        !removedUserIds.includes(e.teacherId) && !removedUserNames.includes(e.teacherName.toLowerCase())
      );
      if (remainingEvaluations.length !== evaluations.length) {
        currentEvals = remainingEvaluations;
        saveEvaluationsToStorage(remainingEvaluations);
        evaluations.filter(e => !remainingEvaluations.some(re => re.id === e.id)).forEach(e => {
          deleteEvaluationFromFirestore(e.id).catch(console.error);
        });
      }
    }

    // Sync evaluations with updated user details
    const updatedEvaluations = currentEvals.map((e) => {
      const teacherUser = newUsers.find(
        (u) => u.id === e.teacherId || u.name.toLowerCase() === e.teacherName.toLowerCase()
      );
      const supervisorUser = newUsers.find(
        (u) => u.role === 'PENGAWAS' && (u.id === e.supervisorName || u.name.toLowerCase() === e.supervisorName.toLowerCase())
      ) || newUsers.find((u) => u.role === 'PENGAWAS');

      let newTeacherName = e.teacherName;
      let newSchoolName = e.schoolName;
      let newSupervisorName = e.supervisorName;

      if (teacherUser) {
        newTeacherName = teacherUser.name;
        if (teacherUser.schoolName) {
          newSchoolName = teacherUser.schoolName;
        }
      }
      if (supervisorUser) {
        newSupervisorName = supervisorUser.name;
      }

      if (
        newTeacherName !== e.teacherName ||
        newSchoolName !== e.schoolName ||
        newSupervisorName !== e.supervisorName
      ) {
        return {
          ...e,
          teacherName: newTeacherName,
          schoolName: newSchoolName,
          supervisorName: newSupervisorName,
        };
      }
      return e;
    });

    if (JSON.stringify(updatedEvaluations) !== JSON.stringify(currentEvals)) {
      saveEvaluationsToStorage(updatedEvaluations);
      batchSaveEvaluationsToFirestore(updatedEvaluations).catch(console.error);
    }

    // Sync agendas with updated user details
    const updatedAgendas = agendas.map((a) => {
      const teacherUser = newUsers.find(
        (u) => u.id === a.teacherId || u.name.toLowerCase() === a.teacherName.toLowerCase()
      );
      if (teacherUser) {
        return {
          ...a,
          teacherName: teacherUser.name,
          schoolName: teacherUser.schoolName || a.schoolName,
          gradeLevel: teacherUser.gradeLevel || a.gradeLevel,
        };
      }
      return a;
    });

    if (JSON.stringify(updatedAgendas) !== JSON.stringify(agendas)) {
      saveAgendasToStorage(updatedAgendas);
      batchSaveAgendasToFirestore(updatedAgendas).catch(console.error);
    }

    if (currentUser && !newUsers.some((u) => u.id === currentUser.id)) {
      handleLogout();
    }
  };

  const handleClearSupervision = () => {
    localStorage.setItem('asagk_cleared', 'true');
    clearSupervisionDataInFirestore(
      agendas.map((a) => a.id),
      evaluations.map((e) => e.id)
    ).catch(console.error);
    saveAgendasToStorage([]);
    saveEvaluationsToStorage([]);
  };

  const handleDeleteEvaluation = (evalId: string) => {
    const target = normalizeAndFindEvaluation(evalId, evaluations);
    const targetId = target ? target.id : evalId;

    const updated = evaluations.filter((e) => {
      if (e.id === targetId || e.id.toLowerCase() === targetId.toLowerCase()) return false;
      if (target && e.id === target.id) return false;
      return true;
    });

    saveEvaluationsToStorage(updated);
    deleteEvaluationFromFirestore(targetId).catch(console.error);

    // Clean up download history in localStorage as well
    try {
      const savedHistory = localStorage.getItem('asagk_download_history');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        const updatedHistory = parsedHistory.filter(
          (h: any) => h.evaluationId !== targetId && h.evaluationId !== evalId
        );
        localStorage.setItem('asagk_download_history', JSON.stringify(updatedHistory));
      }
    } catch (err) {
      console.warn('Error clearing download history item:', err);
    }
  };

  // Guru/Kepsek/Pengawas Actions: Delete agenda and any linked evaluation
  const handleDeleteAgenda = (agendaId: string) => {
    const targetAgenda = agendas.find((a) => a.id === agendaId || a.id.toLowerCase() === agendaId.toLowerCase());
    const targetId = targetAgenda ? targetAgenda.id : agendaId;

    const updatedAgendas = agendas.filter((a) => a.id !== targetId && a.id.toLowerCase() !== targetId.toLowerCase());
    saveAgendasToStorage(updatedAgendas);
    deleteAgendaFromFirestore(targetId).catch(console.error);

    const deletedEvals: string[] = [];
    const updatedEvals = evaluations.filter((e) => {
      if (e.agendaId && (e.agendaId === targetId || e.agendaId.toLowerCase() === targetId.toLowerCase())) {
        deletedEvals.push(e.id);
        return false;
      }
      if (targetAgenda && e.teacherName.toLowerCase() === targetAgenda.teacherName.toLowerCase() && e.subject.toLowerCase() === targetAgenda.subject.toLowerCase()) {
        deletedEvals.push(e.id);
        return false;
      }
      return true;
    });

    if (updatedEvals.length !== evaluations.length) {
      saveEvaluationsToStorage(updatedEvals);
      deletedEvals.forEach((id) => deleteEvaluationFromFirestore(id).catch(console.error));
    }
  };

  const handleResetAllData = () => {
    localStorage.removeItem('asagk_cleared');
    localStorage.removeItem('asagk_download_history');
    saveAgendasToStorage(INITIAL_AGENDAS);
    saveEvaluationsToStorage(INITIAL_EVALUATIONS);
    saveUsersToStorage(USERS);
    batchSaveAgendasToFirestore(INITIAL_AGENDAS).catch(console.error);
    batchSaveEvaluationsToFirestore(INITIAL_EVALUATIONS).catch(console.error);
    batchSaveUsersToFirestore(USERS).catch(console.error);
    handleLogout();
  };

  const handleViewRaport = (id: string) => {
    setRaportId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('raport', id);
    window.history.pushState({}, '', url.toString());
  };

  // 3. Guru Actions: Submit new schedule/agenda
  const handleSubmitAgenda = (agendaData: Omit<SupervisionAgenda, 'id' | 'teacherId' | 'teacherName' | 'schoolName' | 'status' | 'submittedAt'>) => {
    if (!currentUser) return;

    const cleanSubject = sanitizeString(agendaData.subject);
    const cleanTopic = sanitizeString(agendaData.topic);
    const cleanGrade = sanitizeString(agendaData.gradeLevel);

    const newAgenda: SupervisionAgenda = {
      ...agendaData,
      subject: cleanSubject,
      topic: cleanTopic,
      gradeLevel: cleanGrade,
      id: `agenda_${Date.now()}`,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      schoolName: currentUser.schoolName || 'SDN 1 Lupak Dalam',
      status: 'PENDING',
      submittedAt: new Date().toISOString()
    };

    const updated = [newAgenda, ...agendas];
    saveAgendasToStorage(updated);
    saveAgendaToFirestore(newAgenda).catch(console.error);

    logSecurityEvent({
      action: 'CREATE_AGENDA',
      userName: currentUser.name,
      userRole: currentUser.role,
      details: `Guru mengajukan jadwal supervisi: "${cleanSubject} - ${cleanTopic}" (${newAgenda.date})`
    });
  };

  // 4. Principal Actions: Approve/Reject requests
  const handleApproveAgenda = (agendaId: string, feedback?: string) => {
    let approvedItem: SupervisionAgenda | null = null;
    const cleanFeedback = sanitizeString(feedback);
    const updated = agendas.map((agenda) => {
      if (agenda.id === agendaId) {
        approvedItem = {
          ...agenda,
          status: 'APPROVED' as const,
          feedback: cleanFeedback || 'Jadwal dan dokumen RPP disetujui untuk dilaksanakan.'
        };
        return approvedItem;
      }
      return agenda;
    });
    saveAgendasToStorage(updated);
    if (approvedItem) {
      saveAgendaToFirestore(approvedItem).catch(console.error);
      logSecurityEvent({
        action: 'APPROVE_AGENDA',
        userName: currentUser?.name || 'Kepala Sekolah',
        userRole: currentUser?.role,
        details: `Kepala Sekolah menyetujui jadwal supervisi guru ${(approvedItem as SupervisionAgenda).teacherName}`
      });
    }
  };

  const handleRejectAgenda = (agendaId: string, feedback: string) => {
    let rejectedItem: SupervisionAgenda | null = null;
    const cleanFeedback = sanitizeString(feedback);
    const updated = agendas.map((agenda) => {
      if (agenda.id === agendaId) {
        rejectedItem = {
          ...agenda,
          status: 'REJECTED' as const,
          feedback: cleanFeedback
        };
        return rejectedItem;
      }
      return agenda;
    });
    saveAgendasToStorage(updated);
    if (rejectedItem) {
      saveAgendaToFirestore(rejectedItem).catch(console.error);
      logSecurityEvent({
        action: 'REJECT_AGENDA',
        userName: currentUser?.name || 'Kepala Sekolah',
        userRole: currentUser?.role,
        details: `Kepala Sekolah meminta revisi/menolak jadwal supervisi guru ${(rejectedItem as SupervisionAgenda).teacherName}`,
        status: 'WARNING'
      });
    }
  };

  // 5. Supervisor Actions: Record evaluation
  const handleSaveEvaluation = (evalData: Omit<SupervisionEvaluation, 'id' | 'supervisorName' | 'evaluatedAt'>) => {
    if (!currentUser) return;

    const nextSeq = String(evaluations.length + 1).padStart(3, '0');
    const newId = evaluations.some(e => e.id.toLowerCase() === `eval_${nextSeq}`)
      ? `eval_${nextSeq}_${Date.now().toString().slice(-4)}`
      : `eval_${nextSeq}`;

    // Ensure final score is valid bounded float
    const boundedFinalScore = Math.max(0, Math.min(100, typeof evalData.finalScore === 'number' ? evalData.finalScore : 80));

    const newEvaluation: SupervisionEvaluation = {
      ...evalData,
      subject: sanitizeString(evalData.subject),
      topic: sanitizeString(evalData.topic),
      generalNotes: sanitizeString(evalData.generalNotes),
      recommendations: sanitizeString(evalData.recommendations),
      finalScore: boundedFinalScore,
      id: newId,
      supervisorName: currentUser.name,
      evaluatedAt: new Date().toISOString()
    };

    const updated = [newEvaluation, ...evaluations];
    saveEvaluationsToStorage(updated);
    saveEvaluationToFirestore(newEvaluation).catch(console.error);

    logSecurityEvent({
      action: 'CREATE_EVALUATION',
      userName: currentUser.name,
      userRole: currentUser.role,
      details: `Pengawas menerbitkan lembar evaluasi raport (${newId}) untuk ${newEvaluation.teacherName} (Skor: ${newEvaluation.finalScore})`
    });
  };


  if (raportId) {
    let currentEvaluations = evaluations;
    if (currentEvaluations.length === 0) {
      const savedEvaluations = localStorage.getItem('asagk_evaluations');
      if (savedEvaluations) {
        try {
          currentEvaluations = JSON.parse(savedEvaluations);
        } catch (e) {
          currentEvaluations = INITIAL_EVALUATIONS;
        }
      } else {
        currentEvaluations = INITIAL_EVALUATIONS;
      }
    }
    const targetEvaluation = normalizeAndFindEvaluation(raportId, currentEvaluations);
    if (targetEvaluation) {
      return (
        <FullPageReport 
          evaluation={targetEvaluation} 
          allUsers={users}
          onClose={handleCloseRaport} 
          onDeleteEvaluation={handleDeleteEvaluation}
        />
      );
    } else {
      // Invalid ID: alert user and fallback
      setTimeout(() => {
        alert(`Raport dengan Nomor/ID "${raportId}" tidak ditemukan. Pastikan Anda memasukkan ID atau nomor registrasi yang terdaftar.`);
        handleCloseRaport();
      }, 100);
    }
  }

  const handleManualLock = () => {
    if (!currentUser) return;
    setIsSessionLocked(true);
    logSecurityEvent({
      action: 'LOCK_SESSION',
      userName: currentUser.name,
      userRole: currentUser.role,
      details: 'Pengguna mengunci layar secara manual untuk keamanan dokumen'
    });
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-800 antialiased font-sans flex flex-col justify-between relative" id="app-root-container">
      {/* Session Lock Modal Overlay if locked */}
      {isSessionLocked && currentUser && (
        <SessionLockModal
          currentUser={currentUser}
          onUnlock={() => setIsSessionLocked(false)}
          onLogout={handleLogout}
        />
      )}

      {currentUser ? (
        <>
          <div className="flex-grow">
            {/* Header with profile actions, lock session, & user role switch panel */}
            <Header 
              currentUser={currentUser} 
              allUsers={users} 
              onSwitchUser={handleSwitchUser} 
              onLogout={handleLogout} 
              onLockSession={handleManualLock}
              isFirebaseConnected={isFirebaseSynced}
            />

             {/* Role-based Dashboard routing */}
            <main className="animate-fadeIn pb-12" id="main-content-area">
              {currentUser.role === 'GURU' && (
                <GuruDashboard 
                  currentUser={currentUser} 
                  agendas={agendas} 
                  evaluations={evaluations}
                  onSubmitAgenda={handleSubmitAgenda}
                  onDeleteAgenda={handleDeleteAgenda}
                  onDeleteEvaluation={handleDeleteEvaluation}
                  onViewRaport={handleViewRaport}
                />
              )}
              {currentUser.role === 'KEPALA_SEKOLAH' && (
                <KepalaSekolahDashboard 
                  currentUser={currentUser} 
                  agendas={agendas} 
                  evaluations={evaluations}
                  onApproveAgenda={handleApproveAgenda} 
                  onRejectAgenda={handleRejectAgenda} 
                  onDeleteAgenda={handleDeleteAgenda}
                  onDeleteEvaluation={handleDeleteEvaluation}
                  onViewRaport={handleViewRaport}
                />
              )}
              {currentUser.role === 'PENGAWAS' && (
                <PengawasDashboard 
                  currentUser={currentUser} 
                  agendas={agendas} 
                  evaluations={evaluations} 
                  onSubmitEvaluation={handleSaveEvaluation} 
                  onDeleteEvaluation={handleDeleteEvaluation}
                  onDeleteAgenda={handleDeleteAgenda}
                  onViewRaport={handleViewRaport}
                  allUsers={users}
                  onUpdateUsers={handleUpdateUsers}
                  onResetAllData={handleResetAllData}
                  onClearSupervision={handleClearSupervision}
                />
              )}
            </main>
          </div>

          {/* Footer inside Dashboard layout */}
          <footer className="bg-white border-t border-slate-100 py-4 text-center text-[11px] text-slate-400 font-medium">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p>ASAGK Kecamatan Kapuas Kuala &copy; {new Date().getFullYear()}</p>
              <p className="text-slate-500 font-semibold">@created by suwantokapuas</p>
            </div>
          </footer>
        </>
      ) : (
        <LandingPage allUsers={users} onLoginSuccess={handleLogin} evaluations={evaluations} onViewRaport={handleViewRaport} />
      )}
    </div>
  );
}
