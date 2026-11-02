import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { hexToBytes } from "@noble/hashes/utils.js";
import { identityFrom, type Identity } from "../core/protocol";
let identity: Identity | undefined;
export async function getIdentity() {
  if (identity) return identity;
  const saved = await SecureStore.getItemAsync("pulse.identity.v1");
  identity = identityFrom(
    saved ? hexToBytes(saved) : Crypto.getRandomBytes(32),
  );
  if (!saved)
    await SecureStore.setItemAsync("pulse.identity.v1", identity.privateKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  return identity;
}
