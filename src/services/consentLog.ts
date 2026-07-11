import type { ConsentRecord, SessionAuditRecord } from "../types";

const CONSENT_KEY = "about-face-consent-records";
const SESSION_KEY = "about-face-session-audit";

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createConsentRecord(input: Omit<ConsentRecord, "id" | "confirmedAt">): ConsentRecord {
  const record: ConsentRecord = {
    ...input,
    id: crypto.randomUUID(),
    confirmedAt: new Date().toISOString(),
  };
  const records = readConsentRecords();
  writeJson(CONSENT_KEY, [...records, record]);
  return record;
}

export function readConsentRecords(): ConsentRecord[] {
  return readJson<ConsentRecord[]>(CONSENT_KEY, []);
}

export function createSessionAudit(consentRecordId: string | null): SessionAuditRecord {
  const record: SessionAuditRecord = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    rawVideoSaved: false,
    cloudProcessing: false,
    consentRecordId,
    suspensionFlag: false,
  };
  const records = readSessionAudits();
  writeJson(SESSION_KEY, [...records, record]);
  return record;
}

export function readSessionAudits(): SessionAuditRecord[] {
  return readJson<SessionAuditRecord[]>(SESSION_KEY, []);
}

export function deleteAllLocalData() {
  localStorage.removeItem(CONSENT_KEY);
  localStorage.removeItem(SESSION_KEY);
}
