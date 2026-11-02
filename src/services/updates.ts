import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
export type Release = {
  version: string;
  url: string;
  notes: string;
  apk?: { url: string; name: string; digest: string; size: number };
  newer: boolean;
};
export const validRepo = (repo: string) =>
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
export function newerVersion(next: string, current: string) {
  const parse = (v: string) =>
    /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v)?.slice(1).map(Number);
  const a = parse(next),
    b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
export async function checkRelease(repo: string): Promise<Release> {
  if (!validRepo(repo))
    throw new Error("Gebruik eienaar/repository, bv. jou-naam/pulse-gym.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "Geen publieke release gevind nie."
          : "GitHub is tans nie beskikbaar nie.",
      );
    const data = await response.json();
    const expected = `https://github.com/${repo}/releases/`;
    if (
      typeof data.html_url !== "string" ||
      !data.html_url.startsWith(expected)
    )
      throw new Error("Ongeldige release-adres.");
    const asset = data.assets?.find(
      (a: any) =>
        /\.apk$/i.test(a.name) &&
        typeof a.digest === "string" &&
        /^sha256:[a-f0-9]{64}$/.test(a.digest) &&
        a.browser_download_url?.startsWith(expected) &&
        a.size > 0 &&
        a.size < 200_000_000,
    );
    return {
      version: String(data.tag_name),
      url: data.html_url,
      notes: String(data.body || "").slice(0, 3000),
      newer: newerVersion(
        data.tag_name,
        Constants.expoConfig?.version || "0.1.0",
      ),
      apk: asset
        ? {
            url: asset.browser_download_url,
            name: asset.name,
            digest: asset.digest,
            size: asset.size,
          }
        : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}
export async function installRelease(release: Release) {
  if (Platform.OS !== "android" || !release.apk) {
    await Linking.openURL(release.url);
    return;
  }
  const FS = await import("expo-file-system/legacy");
  const { File } = await import("expo-file-system");
  const { sha256 } = await import("@noble/hashes/sha2.js");
  const { bytesToHex } = await import("@noble/hashes/utils.js");
  const Intent = await import("expo-intent-launcher");
  const target = FS.cacheDirectory + "pulse-update.apk";
  await FS.downloadAsync(release.apk.url, target);
  const hash = sha256.create(),
    file = new File(target),
    handle = file.open();
  try {
    let count = 0;
    while (handle.offset !== null && handle.offset < file.size) {
      hash.update(
        await handle.readBytes(
          Math.min(1024 * 1024, file.size - handle.offset),
        ),
      );
      if (++count % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    handle.close();
  }
  if ("sha256:" + bytesToHex(hash.digest()) !== release.apk.digest) {
    await FS.deleteAsync(target, { idempotent: true });
    throw new Error("Die aflaai se kontrolesom pas nie. Installasie gestop.");
  }
  const uri = await FS.getContentUriAsync(target);
  await Intent.startActivityAsync("android.intent.action.VIEW", {
    data: uri,
    flags: 1,
    type: "application/vnd.android.package-archive",
  });
}
