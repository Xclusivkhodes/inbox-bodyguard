/** Browser calls. Empty base means this Next server. Set it when the UI is hosted apart from the API. */
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
  return `${base}${path}`;
}
