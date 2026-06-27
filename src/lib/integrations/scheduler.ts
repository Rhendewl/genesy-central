export interface Scheduler {
  schedule(fn: () => void, delayMs: number): void;
}

export class TimerScheduler implements Scheduler {
  schedule(fn: () => void, delayMs: number): void {
    setTimeout(fn, delayMs);
  }
}
