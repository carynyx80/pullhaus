type Socket = { readyState: number; OPEN: number; send: (body: string) => void };

const sockets = new Set<Socket>();

export const hub = {
  add(socket: Socket) {
    sockets.add(socket);
  },
  remove(socket: Socket) {
    sockets.delete(socket);
  },
  publish(type: string, payload: unknown) {
    const body = JSON.stringify({ type, payload });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(body);
    }
  },
};
