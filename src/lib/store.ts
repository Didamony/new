import { createStore, del, get, set, values, type UseStore } from "idb-keyval";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Flashcard, Material, Settings, Stats } from "./types";

const SETTINGS_KEY = "zakerly.settings";

export const defaultSettings: Settings = {
  provider: "free",
  apiKey: "",
  model: "claude-opus-5-5",
  geminiKey: "",
  geminiModel: "",
  lang: "ar",
  theme: "system",
  outputLang: "auto",
  dailyGoalMinutes: 45,
  focusMinutes: 25,
  breakMinutes: 5,
  name: "",
};

/* ---------------- tiny pub/sub ---------------- */

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const versions = new Map<string, number>();

function subscribe(topic: string, fn: Listener) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic)!.add(fn);
  return () => listeners.get(topic)!.delete(fn);
}

function emit(topic: string) {
  versions.set(topic, (versions.get(topic) ?? 0) + 1);
  listeners.get(topic)?.forEach((fn) => fn());
}

function useTopicVersion(topic: string) {
  return useSyncExternalStore(
    (fn) => subscribe(topic, fn),
    () => versions.get(topic) ?? 0,
  );
}

/* ---------------- settings ---------------- */

let settingsCache: Settings = loadSettings();

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...defaultSettings };
}

export function getSettings() {
  return settingsCache;
}

export function updateSettings(patch: Partial<Settings>) {
  settingsCache = { ...settingsCache, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache));
  } catch {
    /* storage unavailable */
  }
  emit("settings");
}

export function useSettings(): Settings {
  useTopicVersion("settings");
  return settingsCache;
}

/* ---------------- IndexedDB collections ---------------- */

/**
 * IndexedDB collection that falls back to memory when the browser blocks
 * storage (private windows, sandboxed previews), so the app still runs.
 */
function collection(dbName: string, storeName: string) {
  let idb: UseStore | null = null;
  let memory: Map<string, unknown> | null = null;
  try {
    idb = createStore(dbName, storeName);
  } catch {
    memory = new Map();
  }
  async function run<T>(useIdb: (store: UseStore) => Promise<T>, useMemory: (m: Map<string, unknown>) => T): Promise<T> {
    if (!memory) {
      try {
        return await useIdb(idb!);
      } catch {
        memory = new Map();
      }
    }
    return useMemory(memory);
  }
  return {
    get: <T>(key: string) => run((st) => get<T>(key, st), (m) => m.get(key) as T | undefined),
    set: (key: string, value: unknown) => run((st) => set(key, value, st), (m) => void m.set(key, value)),
    del: (key: string) => run((st) => del(key, st), (m) => void m.delete(key)),
    values: <T>() => run((st) => values<T>(st), (m) => [...m.values()] as T[]),
  };
}

const materialsDb = collection("zakerly-materials", "materials");
const cardsDb = collection("zakerly-cards", "cards");
const metaDb = collection("zakerly-meta", "meta");

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function listMaterials(): Promise<Material[]> {
  const all = (await materialsDb.values<Material>()) ?? [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getMaterial(id: string) {
  return materialsDb.get<Material>(id);
}

export async function saveMaterial(m: Material) {
  m.updatedAt = Date.now();
  await materialsDb.set(m.id, m);
  emit("materials");
}

export async function patchMaterial(id: string, patch: Partial<Material>) {
  const m = await getMaterial(id);
  if (!m) return;
  await saveMaterial({ ...m, ...patch });
}

export async function deleteMaterial(id: string) {
  await materialsDb.del(id);
  const cards = await listCards();
  await Promise.all(cards.filter((c) => c.materialId === id).map((c) => cardsDb.del(c.id)));
  emit("materials");
  emit("cards");
}

export async function listCards(): Promise<Flashcard[]> {
  return (await cardsDb.values<Flashcard>()) ?? [];
}

export async function saveCards(cards: Flashcard[]) {
  await Promise.all(cards.map((c) => cardsDb.set(c.id, c)));
  emit("cards");
}

export async function deleteCard(id: string) {
  await cardsDb.del(id);
  emit("cards");
}

/** Re-runs `load` whenever one of `topics` changes. */
export function useLive<T>(load: () => Promise<T>, topics: string[], deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const v = topics.map(useTopicVersion).join(".");
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, ...deps]);
  return data;
}

/* ---------------- stats ---------------- */

const emptyStats: Stats = {
  activeDays: [],
  minutesByDay: {},
  quizzesTaken: 0,
  cardsReviewed: 0,
  summariesMade: 0,
};

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getStats(): Promise<Stats> {
  return { ...emptyStats, ...((await metaDb.get<Stats>("stats")) ?? {}) };
}

let statsQueue: Promise<unknown> = Promise.resolve();

/** Serialised so concurrent updates never overwrite each other. */
export function bumpStats(fn: (s: Stats) => void) {
  statsQueue = statsQueue.then(async () => {
    const s = await getStats();
    const today = dayKey();
    if (!s.activeDays.includes(today)) s.activeDays = [...s.activeDays, today];
    fn(s);
    await metaDb.set("stats", s);
    emit("stats");
  });
  return statsQueue;
}

export function streakOf(days: string[]) {
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  // today not yet active doesn't break the streak
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
