export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureAutoBackupScheduler } = await import("./lib/auto-backup");
  ensureAutoBackupScheduler();
}
