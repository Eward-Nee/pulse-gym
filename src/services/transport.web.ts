export const canConnect = () => false;
export async function listen(
  _onPacket: (line: string) => Promise<string>,
  _onError: (e: Error) => void,
): Promise<() => void> {
  throw new Error("Direkte koppeling werk in die native app.");
}
export async function request(
  _host: string,
  _port: number,
  _line: string,
): Promise<string> {
  throw new Error("Direkte koppeling werk in die native app.");
}
