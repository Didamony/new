import type { Flashcard } from "./types";
import { uid } from "./store";

const DAY = 24 * 60 * 60 * 1000;

export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy

export function newCard(materialId: string, front: string, back: string): Flashcard {
  const now = Date.now();
  return { id: uid(), materialId, front, back, ease: 2.5, interval: 0, reps: 0, due: now, createdAt: now };
}

/** Simplified SM-2. */
export function schedule(card: Flashcard, grade: Grade): Flashcard {
  const now = Date.now();
  let { ease, interval, reps } = card;

  if (grade === 0) {
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
    return { ...card, ease, interval, reps, due: now + 10 * 60 * 1000 };
  }

  const q = grade + 2; // 3..5
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  reps += 1;
  if (reps === 1) interval = grade === 3 ? 3 : 1;
  else if (reps === 2) interval = grade === 1 ? 3 : 6;
  else interval = Math.round(interval * ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1));

  return { ...card, ease, interval, reps, due: now + interval * DAY };
}

export function previewInterval(card: Flashcard, grade: Grade): number {
  const next = schedule(card, grade);
  return next.due - Date.now();
}

export function isDue(card: Flashcard) {
  return card.due <= Date.now();
}
