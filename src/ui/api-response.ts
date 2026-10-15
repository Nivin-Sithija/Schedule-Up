export async function readApiResponse(response: Response, path: string): Promise<any> {
  let out: any;
  try { out = JSON.parse(await response.text()); }
  catch {
    if ([502, 503, 504].includes(response.status)) throw new Error(`ScheduleUp is temporarily unavailable (HTTP ${response.status}). Please try again shortly.`);
    throw new Error(`The server returned an unexpected response (HTTP ${response.status}). Refresh the page and try again.`);
  }
  if (!response.ok) throw new Error(response.status === 401 && !path.startsWith('/auth/') ? 'Please sign in to continue' : out?.details?.[0] || out?.error || 'Request failed');
  return out;
}
