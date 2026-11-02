import { NativeModules } from "react-native";
import { MAX_PACKET, PORT } from "../core/protocol";
export const canConnect = () => !!NativeModules.TcpSockets;
export async function listen(
  onPacket: (line: string) => Promise<string>,
  onError: (e: Error) => void,
): Promise<() => void> {
  if (!canConnect())
    throw new Error(
      "Direkte koppeling benodig die native Android/iOS-bou, nie Expo Go nie.",
    );
  const Tcp = (await import("react-native-tcp-socket")).default;
  let active = 0;
  const connections = new Set<any>();
  const server = Tcp.createServer((socket) => {
    if (active >= 8) {
      socket.destroy();
      return;
    }
    active++;
    connections.add(socket);
    let data = "",
      processing = false;
    const timer = setTimeout(() => socket.destroy(), 12000);
    socket.on("close", () => {
      clearTimeout(timer);
      active--;
      connections.delete(socket);
    });
    socket.on("error", () => socket.destroy());
    socket.on("data", (chunk) => {
      if (processing) return;
      data += chunk.toString();
      if (data.length > MAX_PACKET + 1000) {
        socket.destroy();
        return;
      }
      const end = data.indexOf("\n");
      if (end >= 0) {
        processing = true;
        onPacket(data.slice(0, end))
          .then((reply) => socket.end(reply + "\n"))
          .catch(() => socket.destroy());
      }
    });
  });
  server.on("error", onError);
  server.listen({ port: PORT, host: "0.0.0.0" });
  return () => {
    connections.forEach((s) => s.destroy());
    server.close();
  };
}
export async function request(
  host: string,
  port: number,
  line: string,
): Promise<string> {
  if (!canConnect())
    throw new Error("Gebruik die native bou vir direkte verbindings.");
  const Tcp = (await import("react-native-tcp-socket")).default;
  return new Promise((resolve, reject) => {
    let response = "",
      done = false;
    const socket = Tcp.createConnection({ host, port }, () =>
      socket.write(line + "\n"),
    );
    const finish = (error?: Error, result?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve(result!);
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Vriend nie bereikbaar nie. Probeer op dieselfde Wi-Fi met albei apps oop.",
          ),
        ),
      8000,
    );
    socket.on("data", (chunk) => {
      response += chunk.toString();
      if (response.length > MAX_PACKET + 1000)
        return finish(new Error("Ongeldige antwoord."));
      const end = response.indexOf("\n");
      if (end >= 0) finish(undefined, response.slice(0, end));
    });
    socket.on("error", (e) => finish(e));
    socket.on("close", () => {
      if (!done) finish(new Error("Verbinding gesluit sonder bevestiging."));
    });
  });
}
