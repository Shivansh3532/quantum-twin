export function isRecordedMode(environment: Record<string, string | undefined> = process.env) {
  return environment.VERCEL === "1" || environment.QT_RECORDED_MODE === "1";
}
