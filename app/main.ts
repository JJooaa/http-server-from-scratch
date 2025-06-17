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

function extractUserAgentFromRequest(request: string) {
  const requestArray = request.split("\r\n");
  const userAgent = requestArray.find((item) => item.includes("User-Agent"));
  return userAgent;
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
      extractUserAgentFromRequest(request);

      return socket.end();
    }

    if (route === "/user-agent") {
      const userAgent = extractUserAgentFromRequest(request)
        ?.split("User-Agent:")[1]
        .trim();
      console.log(userAgent);
      socket.write(response("200 OK", userAgent));
      return socket.end();
    }

    if (route.includes("/echo/")) {
      const echoedValue = route.split("/echo/")[1]; // [ "", "echoed_value_here]" ]
      socket.write(response("200 OK", echoedValue));
      return socket.end();
    }

    // Unhandled routes:
    socket.write(response("404 Not Found"));
    return socket.end();
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
