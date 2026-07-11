export type ErrorReport = {
  id: string;
  createdAt: string;
  category: "unauthorized-likeness" | "camera" | "model" | "recording" | "other";
  message: string;
};

const REPORT_KEY = "about-face-error-reports";

export function submitLocalReport(category: ErrorReport["category"], message: string): ErrorReport {
  const report: ErrorReport = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    category,
    message,
  };
  const reports = readLocalReports();
  localStorage.setItem(REPORT_KEY, JSON.stringify([...reports, report]));
  return report;
}

export function readLocalReports(): ErrorReport[] {
  const raw = localStorage.getItem(REPORT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ErrorReport[];
  } catch {
    return [];
  }
}
