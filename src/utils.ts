import { SupervisionEvaluation } from './types';

/**
 * Returns the standardized full registration number for an evaluation in the range 001 s/d 100 /2026.
 * Format: ASAGK/001/2026 ... ASAGK/100/2026
 */
export function getFullRegistrationNumber(
  evaluation: SupervisionEvaluation,
  evaluationsList?: SupervisionEvaluation[]
): string {
  if (!evaluation) return 'ASAGK/001/2026';

  const evalYear = evaluation.evaluatedAt
    ? new Date(evaluation.evaluatedAt).getFullYear()
    : 2026;

  const upperId = (evaluation.id || '').toUpperCase();

  // If already formatted like ASAGK/001/2026 or ASAGK/EVAL_001/2026
  if (upperId.startsWith('ASAGK/')) {
    const parts = upperId.split('/');
    if (parts.length >= 2) {
      const numMatch = parts[1].match(/\d+/);
      if (numMatch) {
        const parsed = parseInt(numMatch[0], 10);
        const bounded = Math.min(Math.max(parsed, 1), 100);
        const seq = String(bounded).padStart(3, '0');
        const year = parts[2] || String(evalYear);
        return `ASAGK/${seq}/${year}`;
      }
    }
  }

  // Handle known/standard evaluation IDs or extract sequence number
  let seqNum = 1;

  if (evaluation.id === 'eval_001') {
    seqNum = 1;
  } else if (evaluation.id === 'eval_mulia_1') {
    seqNum = 2;
  } else if (evaluation.id === 'eval_purwanti_1') {
    seqNum = 3;
  } else if (evaluation.id === 'eval_norlatipah_1') {
    seqNum = 4;
  } else {
    // Try extract number from ID e.g. eval_005 -> 5
    const numMatch = evaluation.id.match(/\d+/);
    if (numMatch) {
      seqNum = parseInt(numMatch[0], 10);
    } else if (evaluationsList && evaluationsList.length > 0) {
      const idx = evaluationsList.findIndex((e) => e.id === evaluation.id);
      if (idx !== -1) {
        seqNum = idx + 1;
      }
    }
  }

  // Ensure bounded strictly between 1 and 100
  const boundedNum = Math.min(Math.max(seqNum, 1), 100);
  const formattedSeq = String(boundedNum).padStart(3, '0');

  return `ASAGK/${formattedSeq}/${evalYear}`;
}

/**
 * Normalizes and searches for an evaluation based on user input.
 * Handles exact IDs (e.g. "001", "eval_001"), case-insensitivity, 
 * full registration numbers in range 001/2026 s/d 100/2026 (e.g. "ASAGK/001/2026"), 
 * and teacher/school search terms.
 */
export function normalizeAndFindEvaluation(
  query: string,
  evaluationsList: SupervisionEvaluation[]
): SupervisionEvaluation | undefined {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return undefined;

  // 1. Direct exact match against ID or full registration number
  let found = evaluationsList.find((e) => {
    const idLower = e.id.toLowerCase();
    const fullReg = getFullRegistrationNumber(e, evaluationsList).toLowerCase();
    return idLower === cleanQuery || fullReg === cleanQuery;
  });
  if (found) return found;

  // 2. Search by registration number range digit e.g. "001", "1", "002", "100"
  const queryNumMatch = cleanQuery.match(/\b\d{1,3}\b/);
  if (queryNumMatch) {
    const qNum = parseInt(queryNumMatch[0], 10);
    if (qNum >= 1 && qNum <= 100) {
      found = evaluationsList.find((e) => {
        const fullReg = getFullRegistrationNumber(e, evaluationsList);
        const matchReg = fullReg.match(/ASAGK\/(\d{3})\/2026/);
        if (matchReg) {
          const eNum = parseInt(matchReg[1], 10);
          return eNum === qNum;
        }
        return false;
      });
      if (found) return found;
    }
  }

  // 3. Match by path parts (e.g. "ASAGK/001/2026" or "001/2026")
  const parts = cleanQuery.split('/');
  for (const part of parts) {
    const subPart = part.trim();
    if (subPart) {
      found = evaluationsList.find((e) => {
        const idLower = e.id.toLowerCase();
        const fullReg = getFullRegistrationNumber(e, evaluationsList).toLowerCase();
        return idLower === subPart || fullReg.includes(subPart);
      });
      if (found) return found;
    }
  }

  // 4. Try matching with non-alphanumeric characters stripped
  const alphaNumQuery = cleanQuery.replace(/[^a-z0-9]/g, '');
  found = evaluationsList.find((e) => {
    const alphaNumId = e.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const alphaNumFull = getFullRegistrationNumber(e, evaluationsList).toLowerCase().replace(/[^a-z0-9]/g, '');
    return alphaNumId === alphaNumQuery || alphaNumFull === alphaNumQuery;
  });
  if (found) return found;

  // 5. Search by teacher name, school name, or subject
  found = evaluationsList.find((e) => {
    return (
      e.teacherName.toLowerCase().includes(cleanQuery) ||
      e.schoolName.toLowerCase().includes(cleanQuery) ||
      e.subject.toLowerCase().includes(cleanQuery)
    );
  });
  if (found) return found;

  return undefined;
}


