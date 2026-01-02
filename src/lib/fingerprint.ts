import FingerprintJS, { Agent } from "@fingerprintjs/fingerprintjs";

let fpPromise: Promise<Agent> | null = null;

export async function getFingerprint(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }

  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}
