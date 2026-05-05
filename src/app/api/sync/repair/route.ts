import { GET as syncGet } from "../route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/sync";
  url.searchParams.set("repair", "1");
  if (!url.searchParams.has("limit")) {
    url.searchParams.set("limit", "3");
  }

  return syncGet(new Request(url, {
    headers: request.headers,
    method: request.method,
    signal: request.signal,
  }));
}
