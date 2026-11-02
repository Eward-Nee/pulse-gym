export type PermissionState =
  "checking" | "enabled" | "disabled" | "blocked" | "unsupported" | "error";
export type Permission = { granted: boolean; canAskAgain: boolean };
export const permissionState = (p: Permission): PermissionState =>
  p.granted ? "enabled" : p.canAskAgain ? "disabled" : "blocked";

// Keep OS permission state authoritative; do not persist a stale "enabled" flag.
export function notificationController(
  adapter: {
    supported: boolean;
    read: () => Promise<Permission>;
    request: () => Promise<Permission>;
  },
  publish: (state: PermissionState) => void,
) {
  let revision = 0,
    disposed = false,
    requesting = false;
  async function run(request: boolean) {
    if (disposed || requesting) return;
    const current = ++revision;
    if (!adapter.supported) {
      publish("unsupported");
      return;
    }
    if (request) requesting = true;
    publish("checking");
    try {
      const p = await (request ? adapter.request() : adapter.read());
      if (!disposed && current === revision) publish(permissionState(p));
    } catch {
      if (!disposed && current === revision) publish("error");
    } finally {
      if (request) requesting = false;
    }
  }
  return {
    refresh: () => run(false),
    enable: () => run(true),
    dispose() {
      disposed = true;
      revision++;
    },
  };
}
