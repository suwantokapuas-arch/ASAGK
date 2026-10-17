# Security Specification for ASAGK Firebase Firestore

## 1. Data Invariants
1. `users`: Document IDs must be valid alphanumeric IDs. User profiles require valid `id`, `name`, `username`, and `role`. Roles must be one of `GURU`, `KEPALA_SEKOLAH`, or `PENGAWAS`.
2. `agendas`: Document IDs must be valid strings. Every agenda requires `id`, `teacherId`, `teacherName`, `schoolName`, `subject`, `topic`, `date`, and `status` (`PENDING`, `APPROVED`, `REJECTED`).
3. `evaluations`: Document IDs must be valid strings. Every evaluation requires `id`, `teacherId`, `teacherName`, `schoolName`, `subject`, `topic`, `date`, `finalScore` (0 <= finalScore <= 100), `predicate`, and `supervisorName`.
4. `audit_logs`: Immutable, append-only records of authentication and data modifications. Updates and deletions are strictly forbidden.
5. Verification & Raport lookup: Public read access is permitted for verified inspection of certificates and electronic signature barcodes (`/raport?raport={evalId}`).
6. Boundary constraints: All strings must have constrained lengths to prevent Denial of Wallet attacks.

## 2. The Dirty Dozen Payloads (Rejection Matrix)
1. **Payload 1**: Oversized User ID with junk characters (`../../etc/passwd` or 1KB string) -> Denied by `isValidId`.
2. **Payload 2**: User document missing required fields (`name` or `role`) -> Denied by schema validation.
3. **Payload 3**: User document with illegal role (`HACKER`) -> Denied by enum validation.
4. **Payload 4**: Agenda with illegal status (`DELETED_ALL`) -> Denied by status enum check.
5. **Payload 5**: Agenda with negative topic string or >5000 character payload -> Denied by length boundary.
6. **Payload 6**: Evaluation with negative score (-10) or >100 -> Denied by numeric range constraints (0 <= finalScore <= 100).
7. **Payload 7**: Evaluation with invalid predicate (`PERFECT_100`) -> Denied by predicate enum check.
8. **Payload 8**: System catch-all violation (writing to arbitrary collection `/secret_keys/doc1`) -> Denied by default-deny catch-all rule.
9. **Payload 9**: Attempting to inject script tags or malicious URLs into schoolName -> Constrained by character size limit and input sanitization.
10. **Payload 10**: Modification or deletion of audit logs -> Denied by `allow update, delete: if false`.
11. **Payload 11**: Empty agenda creation without teacherId -> Denied by required fields check.
12. **Payload 12**: Malformed score objects or spoofed document IDs where incoming().id != docId -> Denied by ID matching constraint.
