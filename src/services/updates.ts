import { t } from "../i18n";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import appConfig from "../../app.json";
export type Release = {
  version: string;
  url: string;
  notes: string;
  apk?: { url: string; name: string; digest: string; size: number };
  newer: boolean;
};
export const UPDATE_REPOSITORY = "Eward-Nee/pulse-gym";
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
export async function checkRelease(): Promise<Release> {
  const repo = UPDATE_REPOSITORY;
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
          ? t("No public release found.")
          : t("GitHub is currently unavailable."),
      );
    const data = await response.json();
    const expected = `https://github.com/${repo}/releases/`;
    if (
      typeof data.html_url !== "string" ||
      !data.html_url.startsWith(expected)
    )
      throw new Error(t("Invalid release address."));
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
        Constants.expoConfig?.version || appConfig.expo.version,
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
export type UpdateProgress =
  | { phase: "downloading"; received: number; total: number }
  | { phase: "verifying"; received: number; total: number }
  | { phase: "installing" };
/** Bytes as megabytes with one decimal, e.g. 34257123 -> "32.7". */
export const megabytes = (bytes: number) =>
  (Math.max(0, bytes) / 1048576).toFixed(1);
export async function installRelease(
  release: Release,
  onProgress?: (p: UpdateProgress) => void,
) {
  if (!release.newer) throw new Error(t("No newer version to install."));
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
  // Progress can fire many times a second; the UI only needs ~10 updates/s.
  let last = 0;
  const report = (p: UpdateProgress, force = false) => {
    const now = Date.now();
    if (!onProgress || (!force && now - last < 100)) return;
    last = now;
    onProgress(p);
  };
  const expected = release.apk.size || 0;
  report({ phase: "downloading", received: 0, total: expected }, true);
  const download = FS.createDownloadResumable(
    release.apk.url,
    target,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
      report({
        phase: "downloading",
        received: totalBytesWritten,
        // -1 means the server sent no Content-Length; fall back to GitHub's asset size.
        total:
          totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : expected,
      }),
  );
  const result = await download.downloadAsync();
  if (!result || result.status < 200 || result.status > 299) {
    await FS.deleteAsync(target, { idempotent: true });
    throw new Error(
      t("The download failed. Check your connection and try again."),
    );
  }
  const hash = sha256.create(),
    file = new File(target),
    size = file.size,
    handle = file.open();
  report({ phase: "downloading", received: size, total: size }, true);
  try {
    let count = 0;
    while (handle.offset !== null && handle.offset < file.size) {
      hash.update(
        await handle.readBytes(
          Math.min(1024 * 1024, file.size - handle.offset),
        ),
      );
      report({
        phase: "verifying",
        received: handle.offset ?? size,
        total: size,
      });
      if (++count % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    handle.close();
  }
  report({ phase: "verifying", received: size, total: size }, true);
  if ("sha256:" + bytesToHex(hash.digest()) !== release.apk.digest) {
    await FS.deleteAsync(target, { idempotent: true });
    throw new Error(
      t("The download checksum does not match. Installation stopped."),
    );
  }
  report({ phase: "installing" }, true);
  const uri = await FS.getContentUriAsync(target);
  await Intent.startActivityAsync("android.intent.action.VIEW", {
    data: uri,
    flags: 1,
    type: "application/vnd.android.package-archive",
  });
}
