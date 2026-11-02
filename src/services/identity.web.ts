import { identityFrom } from "../core/protocol";
import { hexToBytes } from "@noble/hashes/utils.js";
export async function getIdentity() {
  const saved = localStorage.getItem("pulse.preview.identity");
  const identity = identityFrom(
    saved ? hexToBytes(saved) : crypto.getRandomValues(new Uint8Array(32)),
  );
  if (!saved)
    localStorage.setItem("pulse.preview.identity", identity.privateKey);
  return identity;
}
