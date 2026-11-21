import jwt from "jsonwebtoken";
import { SiweMessage } from "siwe";
import { config } from "./config.js";
import { prisma } from "./db.js";

export async function issueNonce(): Promise<string> {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await prisma.nonce.create({ data: { id: nonce } });
  return nonce;
}

export async function verifySiwe(message: string, signature: string, domain: string): Promise<string> {
  const siwe = new SiweMessage(message);
  const nonce = siwe.nonce;
  const stored = nonce ? await prisma.nonce.findUnique({ where: { id: nonce } }) : null;
  if (!stored) throw new Error("Nonce expired");
  await prisma.nonce.delete({ where: { id: nonce } });
  if (siwe.domain !== domain && siwe.domain !== "localhost" && siwe.domain !== "127.0.0.1") {
    throw new Error("Domain mismatch");
  }
  const result = await siwe.verify({ signature, nonce });
  if (result.success === false) throw new Error(result.error?.type || "Bad signature");
  return (result.data?.address || siwe.address).toLowerCase();
}

export function signToken(address: string): string {
  return jwt.sign({ address }, config.jwtSecret, { expiresIn: "7d" });
}

export function readAddress(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { address?: string };
    return payload.address?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
