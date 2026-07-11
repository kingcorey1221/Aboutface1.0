export type SecureStorageStatus = {
  mode: "local-only" | "supabase-ready";
  message: string;
};

export function getSecureStorageStatus(): SecureStorageStatus {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (url && anonKey) {
    return {
      mode: "supabase-ready",
      message: "Supabase settings are present. Use private buckets and signed URLs before enabling uploads.",
    };
  }

  return {
    mode: "local-only",
    message: "This MVP runs local-only by default. Webcam frames are not uploaded or retained.",
  };
}
