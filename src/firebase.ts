import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, SupervisionAgenda, SupervisionEvaluation, SecurityAuditLog } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying the firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Operation Types for Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Validation on Boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection test successful.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    } else {
      console.log('Firebase initialized. Connectivity check completed.');
    }
  }
}
testConnection();

// ==========================================
// Firestore Real-time Sync & Data Functions
// ==========================================

const USERS_PATH = 'users';
const AGENDAS_PATH = 'agendas';
const EVALUATIONS_PATH = 'evaluations';
const AUDIT_LOGS_PATH = 'audit_logs';

/**
 * Subscribe to real-time Users collection
 */
export function subscribeUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (error: unknown) => void
) {
  const colRef = collection(db, USERS_PATH);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((d) => {
        usersList.push(d.data() as UserProfile);
      });
      onData(usersList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, USERS_PATH);
    }
  );
}

/**
 * Subscribe to real-time Agendas collection
 */
export function subscribeAgendas(
  onData: (agendas: SupervisionAgenda[]) => void,
  onError?: (error: unknown) => void
) {
  const colRef = collection(db, AGENDAS_PATH);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const agendaList: SupervisionAgenda[] = [];
      snapshot.forEach((d) => {
        agendaList.push(d.data() as SupervisionAgenda);
      });
      onData(agendaList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, AGENDAS_PATH);
    }
  );
}

/**
 * Subscribe to real-time Evaluations collection
 */
export function subscribeEvaluations(
  onData: (evals: SupervisionEvaluation[]) => void,
  onError?: (error: unknown) => void
) {
  const colRef = collection(db, EVALUATIONS_PATH);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const evalList: SupervisionEvaluation[] = [];
      snapshot.forEach((d) => {
        evalList.push(d.data() as SupervisionEvaluation);
      });
      onData(evalList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, EVALUATIONS_PATH);
    }
  );
}

/**
 * Save or update a user document in Firestore
 */
export async function saveUserToFirestore(user: UserProfile): Promise<void> {
  const path = `${USERS_PATH}/${user.id}`;
  try {
    await setDoc(doc(db, USERS_PATH, user.id), user, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Batch write multiple users to Firestore (e.g. for initial seed or imports)
 */
export async function batchSaveUsersToFirestore(users: UserProfile[]): Promise<void> {
  if (users.length === 0) return;
  // Firestore batch limit is 500 operations
  const chunkSize = 400;
  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((u) => {
      const ref = doc(db, USERS_PATH, u.id);
      batch.set(ref, u, { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, USERS_PATH);
    }
  }
}

/**
 * Save or update an agenda in Firestore
 */
export async function saveAgendaToFirestore(agenda: SupervisionAgenda): Promise<void> {
  const path = `${AGENDAS_PATH}/${agenda.id}`;
  try {
    await setDoc(doc(db, AGENDAS_PATH, agenda.id), agenda, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete an agenda from Firestore
 */
export async function deleteAgendaFromFirestore(agendaId: string): Promise<void> {
  const path = `${AGENDAS_PATH}/${agendaId}`;
  try {
    await deleteDoc(doc(db, AGENDAS_PATH, agendaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Save or update an evaluation in Firestore
 */
export async function saveEvaluationToFirestore(evaluation: SupervisionEvaluation): Promise<void> {
  const path = `${EVALUATIONS_PATH}/${evaluation.id}`;
  try {
    await setDoc(doc(db, EVALUATIONS_PATH, evaluation.id), evaluation, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete an evaluation from Firestore
 */
export async function deleteEvaluationFromFirestore(evalId: string): Promise<void> {
  const path = `${EVALUATIONS_PATH}/${evalId}`;
  try {
    await deleteDoc(doc(db, EVALUATIONS_PATH, evalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Batch write initial agendas to Firestore
 */
export async function batchSaveAgendasToFirestore(agendas: SupervisionAgenda[]): Promise<void> {
  if (agendas.length === 0) return;
  const batch = writeBatch(db);
  agendas.forEach((a) => {
    const ref = doc(db, AGENDAS_PATH, a.id);
    batch.set(ref, a, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, AGENDAS_PATH);
  }
}

/**
 * Batch write initial evaluations to Firestore
 */
export async function batchSaveEvaluationsToFirestore(evals: SupervisionEvaluation[]): Promise<void> {
  if (evals.length === 0) return;
  const batch = writeBatch(db);
  evals.forEach((e) => {
    const ref = doc(db, EVALUATIONS_PATH, e.id);
    batch.set(ref, e, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, EVALUATIONS_PATH);
  }
}

/**
 * Clear supervision agendas and evaluations from Firestore
 */
export async function clearSupervisionDataInFirestore(
  agendaIds: string[],
  evaluationIds: string[]
): Promise<void> {
  const batch = writeBatch(db);
  agendaIds.forEach((id) => {
    batch.delete(doc(db, AGENDAS_PATH, id));
  });
  evaluationIds.forEach((id) => {
    batch.delete(doc(db, EVALUATIONS_PATH, id));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'clear_supervision');
  }
}

/**
 * Save an audit log to Firestore
 */
export async function saveAuditLogToFirestore(log: SecurityAuditLog): Promise<void> {
  const path = `${AUDIT_LOGS_PATH}/${log.id}`;
  try {
    await setDoc(doc(db, AUDIT_LOGS_PATH, log.id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribe to real-time Audit Logs collection
 */
export function subscribeAuditLogs(
  onData: (logs: SecurityAuditLog[]) => void,
  onError?: (error: unknown) => void
) {
  const colRef = collection(db, AUDIT_LOGS_PATH);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const logsList: SecurityAuditLog[] = [];
      snapshot.forEach((d) => {
        logsList.push(d.data() as SecurityAuditLog);
      });
      // Sort newest first
      logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onData(logsList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, AUDIT_LOGS_PATH);
    }
  );
}
