export type UserRole = 'GURU' | 'KEPALA_SEKOLAH' | 'PENGAWAS';

export interface UserProfile {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  schoolName?: string;
  details?: string; // For Guru: e.g. "Guru Kelas IV", For Kepsek: "Kepala Sekolah SDN 1 Lupak", For Pengawas: "Pengawas Korwil Bidang Pendidikan"
  nip?: string;
  gradeLevel?: string;
}

export interface RppDocument {
  fileName: string;
  fileSize: string;
  uploadDate: string;
  contentTopic: string;
}

export interface SupervisionAgenda {
  id: string;
  teacherId: string;
  teacherName: string;
  schoolName: string;
  gradeLevel: string; // e.g., "Kelas IV"
  subject: string; // e.g., "Tematik - IPA"
  topic: string; // "Materi yang dipraktekkan"
  date: string;
  time: string;
  document: RppDocument | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  feedback?: string;
  submittedAt: string;
}

export interface RubricCategory {
  id: string;
  name: string;
  description: string;
  maxScore: number;
}

export interface RubricScore {
  categoryId: string;
  score: number; // e.g. 1-4 or 1-100
  notes?: string;
}

export interface SupervisionEvaluation {
  id: string;
  agendaId: string;
  teacherId: string;
  teacherName: string;
  schoolName: string;
  subject: string;
  topic: string;
  date: string;
  scores: RubricScore[];
  finalScore: number; // Average or calculated
  predicate: 'SANGAT_BAIK' | 'BAIK' | 'CUKUP' | 'PERLU_BIMBINGAN';
  generalNotes: string;
  recommendations: string;
  supervisorName: string;
  evaluatedAt: string;
}

export type SecurityActionType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'RATE_LIMIT_LOCKOUT'
  | 'CREATE_AGENDA'
  | 'APPROVE_AGENDA'
  | 'REJECT_AGENDA'
  | 'CREATE_EVALUATION'
  | 'DELETE_EVALUATION'
  | 'DELETE_AGENDA'
  | 'UPDATE_USER'
  | 'ADD_USER'
  | 'DELETE_USER'
  | 'CLEAR_DATA'
  | 'RESET_SYSTEM'
  | 'LOCK_SESSION'
  | 'UNLOCK_SESSION'
  | 'VERIFY_DOCUMENT';

export interface SecurityAuditLog {
  id: string;
  action: SecurityActionType;
  userName: string;
  userRole?: UserRole | string;
  details: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'ALERT';
}
