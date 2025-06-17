import * as net from "node:net";

const allowedRoutes = ["/"];

function response(status: string) {
  return `HTTP/1.1 ${status}\r\n\r\n`;
}

function extractRouteFromRequest(request: string) {
  const requestArray = request.split("\r\n");
  const path = requestArray[0].split(" ")[1];
  return path;
}

console.log("Server running: Listening for events...");

// Listens for *raw TCP sockets*.
const server = net.createServer((socket: net.Socket) => {
  let request = "";

  socket.on("data", (chunk: Buffer) => {
    request += chunk.toString();
    const route = extractRouteFromRequest(request);

    if (!allowedRoutes.includes(route)) {
      socket.write(response("404 Not Found"));
      socket.end();
    } else {
      socket.write(response("200 OK"));
      socket.end();
    }
    socket.end();
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
