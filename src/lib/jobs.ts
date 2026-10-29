import { useSyncExternalStore } from "react";

/**
 * Background AI jobs keyed by material + tool, so a generation keeps running
 * (and keeps streaming) when the student switches tabs and comes back.
 */
export interface Job {
  running: boolean;
  partial: string;
  error: unknown;
  controller?: AbortController;
}

const idle: Job = { running: false, partial: "", error: null };
const jobs = new Map<string, Job>();
const subs = new Set<() => void>();

function set(key: string, job: Job) {
  jobs.set(key, job);
  subs.forEach((f) => f());
}

export function useJob(key: string): Job {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => jobs.get(key) ?? idle,
  );
}

export async function runJob(key: string, work: (signal: AbortSignal, onPartial: (s: string) => void) => Promise<void>) {
  if (jobs.get(key)?.running) return;
  const controller = new AbortController();
  set(key, { running: true, partial: "", error: null, controller });
  try {
    await work(controller.signal, (partial) => set(key, { ...(jobs.get(key) ?? idle), partial }));
    set(key, idle);
  } catch (error) {
    set(key, { running: false, partial: "", error });
  }
}

export function stopJob(key: string) {
  jobs.get(key)?.controller?.abort();
}
