import { t } from "../i18n";
import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { Buffer } from "buffer";
export const PORT = 47478,
  MAX_PACKET = 512_000;
export type Identity = { privateKey: string; publicKey: string; id: string };
export type Invite = {
  v: 1;
  id: string;
  publicKey: string;
  name: string;
  host: string;
  port: number;
};
export type Message = {
  id: string;
  sentAt: number;
  type:
    | "ack"
    | "hello"
    | "accepted"
    | "challenge"
    | "challenge-status"
    | "snapshot";
  body: unknown;
};
export type Packet = {
  v: 1;
  from: string;
  to: string;
  nonce: string;
  box: string;
};
export const peerId = (key: string) =>
  "AG-" +
  bytesToHex(sha256(hexToBytes(key)))
    .slice(0, 24)
    .toUpperCase();
export function identityFrom(privateBytes: Uint8Array): Identity {
  const publicKey = bytesToHex(x25519.getPublicKey(privateBytes));
  return {
    privateKey: bytesToHex(privateBytes),
    publicKey,
    id: peerId(publicKey),
  };
}
export function fingerprint(key: string) {
  return bytesToHex(sha256(hexToBytes(key)))
    .match(/.{1,4}/g)!
    .join(" ");
}
export function validHost(host: string) {
  return (
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) &&
    host.split(".").every((x) => +x <= 255) &&
    host !== "0.0.0.0" &&
    host !== "255.255.255.255"
  );
}
export function parseInvite(text: string): Invite {
  if (
    typeof text !== "string" ||
    text.length > 3000 ||
    !text.startsWith("PULSE1:")
  )
    throw new Error(t("Paste the full PULSE1 invitation code."));
  let x: Invite;
  try {
    const encoded = text.slice(7);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1)
      throw new Error("Invalid base64url");
    const bytes = Buffer.from(
      encoded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    if (urlBase64(bytes) !== encoded)
      throw new Error("Non-canonical base64url");
    x = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(t("The invitation code is invalid."));
  }
  if (
    !x ||
    typeof x !== "object" ||
    x.v !== 1 ||
    !/^[a-f0-9]{64}$/.test(x.publicKey) ||
    x.id !== peerId(x.publicKey) ||
    typeof x.name !== "string" ||
    x.name.length > 80 ||
    typeof x.host !== "string" ||
    !validHost(x.host) ||
    !Number.isInteger(x.port) ||
    x.port < 1024 ||
    x.port > 65535
  )
    throw new Error(t("The invitation contains invalid details."));
  return x;
}
function urlBase64(bytes: Buffer) {
  // React Native's buffer polyfill supports base64, but not Node's base64url.
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function makeInvite(x: Invite) {
  return "PULSE1:" + urlBase64(Buffer.from(JSON.stringify(x), "utf8"));
}
function keyFor(me: Identity, peer: string) {
  return hkdf(
    sha256,
    x25519.getSharedSecret(hexToBytes(me.privateKey), hexToBytes(peer)),
    undefined,
    utf8ToBytes(["pulse-v1", ...[me.publicKey, peer].sort()].join(":")),
    32,
  );
}
export function seal(
  me: Identity,
  to: string,
  message: Message,
  random: (n: number) => Uint8Array,
): Packet {
  const plaintext = utf8ToBytes(JSON.stringify(message));
  if (plaintext.length > 200_000)
    throw new Error(
      t(
        "The shared packet is too large. Reduce the shared templates or history.",
      ),
    );
  const nonce = random(24);
  const aad = utf8ToBytes(`pulse-v1:${me.publicKey}:${to}`);
  const box = xchacha20poly1305(keyFor(me, to), nonce, aad).encrypt(plaintext);
  return {
    v: 1,
    from: me.publicKey,
    to,
    nonce: bytesToHex(nonce),
    box: bytesToHex(box),
  };
}
export function open(me: Identity, p: Packet, now = Date.now()): Message {
  if (
    !p ||
    p.v !== 1 ||
    p.to !== me.publicKey ||
    !/^[a-f0-9]{64}$/.test(p.from) ||
    p.from === me.publicKey ||
    !/^[a-f0-9]{48}$/.test(p.nonce) ||
    typeof p.box !== "string" ||
    p.box.length > MAX_PACKET ||
    !/^(?:[a-f0-9]{2})+$/.test(p.box)
  )
    throw new Error(t("Invalid encrypted message."));
  const bytes = xchacha20poly1305(
    keyFor(me, p.from),
    hexToBytes(p.nonce),
    utf8ToBytes(`pulse-v1:${p.from}:${p.to}`),
  ).decrypt(hexToBytes(p.box));
  const m = JSON.parse(Buffer.from(bytes).toString("utf8")) as Message;
  if (
    typeof m.id !== "string" ||
    m.id.length > 80 ||
    m.id.length < 8 ||
    !Number.isFinite(m.sentAt) ||
    m.sentAt > now + 300000 ||
    ![
      "ack",
      "hello",
      "accepted",
      "challenge",
      "challenge-status",
      "snapshot",
    ].includes(m.type)
  )
    throw new Error(t("Invalid message content."));
  return m;
}
