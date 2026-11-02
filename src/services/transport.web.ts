import { t } from "../i18n";
export const canConnect = () => false;
export async function listen(
  _onPacket: (line: string) => Promise<string>,
  _onError: (e: Error) => void,
): Promise<() => void> {
  throw new Error(t("Direct connection works in the native app."));
}
export async function request(
  _host: string,
  _port: number,
  _line: string,
): Promise<string> {
  throw new Error(t("Direct connection works in the native app."));
}
