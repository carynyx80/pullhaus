import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

function safeKey(key: string): string {
  const clean = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.includes("..")) throw new Error("bad media key");
  return clean;
}

async function putLocal(key: string, body: Buffer): Promise<string> {
  const rel = safeKey(key);
  const root = path.resolve(config.storageDir);
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) throw new Error("bad media key");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return `${config.publicUrl}/media/${rel}`;
}

async function putS3(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
  const Bucket = process.env.S3_BUCKET || "";
  await client.send(new PutObjectCommand({ Bucket, Key: safeKey(key), Body: body, ContentType: contentType }));
  const base = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${Bucket}`;
  return `${base}/${safeKey(key)}`;
}

async function putGreenfield(key: string, body: Buffer, contentType: string): Promise<string> {
  const rpc = process.env.GREENFIELD_RPC_URL;
  const chainId = process.env.GREENFIELD_CHAIN_ID;
  const bucket = process.env.GREENFIELD_BUCKET;
  const privateKey = process.env.GREENFIELD_PRIVATE_KEY;
  if (!rpc || !chainId || !bucket || !privateKey) throw new Error("Greenfield env is incomplete");
  const sdk = (await new Function("return import('@bnb-chain/greenfield-js-sdk')")()) as {
    Client?: { create: (rpc: string, chainId: string) => any };
  };
  if (!sdk.Client?.create) throw new Error("Greenfield SDK did not export Client.create");
  const client = sdk.Client.create(rpc, chainId);
  const account = await client.account.recoverAccountFromPrivateKey?.(privateKey);
  const address = account?.address ?? client.account.getAccount?.(privateKey)?.address;
  if (!address) throw new Error("Could not recover a Greenfield account from GREENFIELD_PRIVATE_KEY");
  const objectName = safeKey(key);
  await client.object.createObject({
    bucketName: bucket,
    objectName,
    creator: address,
    visibility: "VISIBILITY_TYPE_PUBLIC_READ",
    contentType,
    redundancyType: "REDUNDANCY_EC_TYPE",
    payloadSize: body.length,
    expectSecondarySpAddresses: [],
  });
  await client.object.uploadObject({ bucketName: bucket, objectName, body, txnHash: "" }, { type: "ECDSA", privateKey });
  const host = process.env.GREENFIELD_PUBLIC_URL || rpc;
  return `${host}/${bucket}/${objectName}`;
}

export async function putMedia(key: string, body: Buffer, contentType: string): Promise<string> {
  if (config.mediaDriver === "s3") return putS3(key, body, contentType);
  if (config.mediaDriver === "greenfield") {
    try {
      return await putGreenfield(key, body, contentType);
    } catch (error) {
      console.warn("Greenfield upload failed, storing locally", error);
    }
  }
  return putLocal(key, body);
}

export function mediaPath(key: string): string {
  const rel = safeKey(key);
  const root = path.resolve(config.storageDir);
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) throw new Error("bad media key");
  return file;
}
