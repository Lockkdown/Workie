/** Best-effort alerts. Failures degrade to the visual state [D90] [D98]. */
export async function requestAlertPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function notifyBestEffort(title: string, body: string): void {
  try {
    if (typeof Notification === "undefined") {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      return;
    }
    new Notification(title, { body });
  } catch {
    return;
  }
}

export function playCueBestEffort(optedIn: boolean): void {
  if (!optedIn || typeof AudioContext === "undefined") {
    return;
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
  } catch {
    return;
  }
}
