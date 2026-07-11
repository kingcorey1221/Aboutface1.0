import { beforeEach, describe, expect, it } from "vitest";
import {
  createConsentRecord,
  createSessionAudit,
  deleteAllLocalData,
  readConsentRecords,
  readSessionAudits,
} from "./consentLog";

describe("consent and deletion", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("requires an explicit consent record before project use", () => {
    const record = createConsentRecord({
      photoName: "face.png",
      ownsOrHasPermission: true,
      notPublicFigure: true,
      notMinorWithoutConsent: true,
    });
    expect(record.confirmedAt).toBeTruthy();
    expect(readConsentRecords()).toHaveLength(1);
  });

  it("stores session audit records without raw video", () => {
    const audit = createSessionAudit("consent-1");
    expect(audit.rawVideoSaved).toBe(false);
    expect(audit.cloudProcessing).toBe(false);
    expect(readSessionAudits()).toHaveLength(1);
  });

  it("deletes local user data", () => {
    createSessionAudit("consent-1");
    deleteAllLocalData();
    expect(readSessionAudits()).toHaveLength(0);
  });
});
