import { SiweMessage } from "siwe";
import { API_URL } from "./utils";

const TOKEN = "pullhaus-token";

export function authToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN);
}

export function setAuthToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN);
  else localStorage.setItem(TOKEN, token);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const token = authToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

export async function signIn(sign: (message: string) => Promise<`0x${string}`>, address: string, chainId: number) {
  const { nonce } = await api<{ nonce: string }>("/auth/nonce");
  const message = new SiweMessage({
    domain: window.location.host,
    address,
    statement: "Open your private Pullhaus atelier. This signature does not spend tokens.",
    uri: window.location.origin,
    version: "1",
    chainId,
    nonce,
  }).prepareMessage();
  const signature = await sign(message);
  const result = await api<{ token: string; address: string }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ message, signature }),
  });
  setAuthToken(result.token);
  return result.address;
}
