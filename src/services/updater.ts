import { useSyncExternalStore } from "react";
import {
  checkRelease,
  installRelease,
  type Release,
  type UpdateProgress,
} from "./updates";
/**
 * App-wide update state. It lives outside React so a check or download keeps
 * going, and its progress bar is still correct, when you leave and re-open Setup.
 * It deliberately does not use the database queue: a long download must never
 * hold up reads and writes.
 */
export type UpdaterState = {
  checking: boolean;
  release: Release | null;
  progress: UpdateProgress | null;
  error: string;
};
let state: UpdaterState = {
  checking: false,
  release: null,
  progress: null,
  error: "",
};
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdaterState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export async function check() {
  if (state.checking || state.progress) return;
  set({ checking: true, error: "" });
  try {
    set({ release: await checkRelease() });
  } catch (e) {
    set({ error: (e as Error).message });
  } finally {
    set({ checking: false });
  }
}
export async function install() {
  const release = state.release;
  if (!release || state.checking || state.progress) return;
  set({ progress: { phase: "downloading", received: 0, total: 0 }, error: "" });
  try {
    await installRelease(release, (progress) => set({ progress }));
  } catch (e) {
    set({ error: (e as Error).message });
  } finally {
    set({ progress: null });
  }
}
export const useUpdater = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
