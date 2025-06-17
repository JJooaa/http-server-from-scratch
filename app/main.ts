import * as net from "node:net";

function response(status: string, body?: string) {
  return (
    `HTTP/1.1 ${status}\r\n` +
    "Content-Type: text/plain\r\n" +
    `Content-Length: ${body?.length ?? 0}\r\n` +
    "\r\n" + // end of headers
    `${body ?? ""}`
  );
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

    if (route === "/") {
      socket.write(response("200 OK"));
      return socket.end();
    }
    if (route.includes("/echo/")) {
      const echoedValue = route.split("/echo/")[1]; // [ "", "echoed_value_here]" ]
      socket.write(response("200 OK", echoedValue));
      return socket.end();
    } else {
      socket.write(response("404 Not Found"));
      return socket.end();
    }
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
