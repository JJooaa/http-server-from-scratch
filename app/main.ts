import * as net from "node:net";

type ResponseArgs = {
  status: string;
  body?: string;
  contentType?: string;
};

function response({
  status,
  body = "",
  contentType = "text/plain",
}: ResponseArgs) {
  return (
    `HTTP/1.1 ${status}\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `Content-Length: ${body.length ?? 0}\r\n` +
    "\r\n" + // end of headers
    `${body}`
  );
}

function extractRouteFromRequest(request: string) {
  const requestArray = request.split("\r\n");

  const body = requestArray.pop();
  const route = requestArray[0].split(" ")[1];
  const method = requestArray[0].split(" ")[0];

  return { route, body, method };
}

function getHeaderFromRequest(request: string, headerName: string) {
  const requestArray = request.split("\r\n");
  const header = requestArray.find((item) => item.includes(headerName))?.trim();
  const keyValue = header?.split(headerName); // ["User Agent:", " foobar"]

  return { key: keyValue?.[0], value: keyValue?.[1].trim() };
}

async function readFile(fileName: string) {
  const dirIndex = process.argv.indexOf("--directory");
  const directory = dirIndex !== -1 ? process.argv[dirIndex + 1] : "./files";
  const file = Bun.file(`${directory}/${fileName}`);

  if (await file.exists()) return await file.text();
  return null;
}

async function writeFile(fileName: string, body: string) {
  const dirIndex = process.argv.indexOf("--directory");
  const directory = dirIndex !== -1 ? process.argv[dirIndex + 1] : "./files";

  await Bun.write(`${directory}/${fileName}`, body);
}

console.log("Server running: Listening for events...");

// Listens for *raw TCP sockets*.
const server = net.createServer((socket: net.Socket) => {
  let request = "";

  socket.on("data", async (chunk: Buffer) => {
    request += chunk.toString();

    const { route, body, method } = extractRouteFromRequest(request);

    if (route === "/") {
      socket.write(response({ status: "200 OK" }));
      return socket.end();
    }

    if (route === "/user-agent") {
      const { value } = getHeaderFromRequest(request, "User-Agent:");
      socket.write(response({ status: "200 OK", body: value }));
      return socket.end();
    }

    if (route.includes("/echo/")) {
      const echoedValue = route.split("/echo/")[1]; // [ "", "echoed_value_here]" ]
      socket.write(response({ status: "200 OK", body: echoedValue }));
      return socket.end();
    }

    // Read file
    if (route.includes("/files/") && method === "GET") {
      const fileName = route.split("/files/")[1];
      const fileContents = await readFile(fileName);

      if (fileContents) {
        socket.write(
          response({
            status: "200 OK",
            body: fileContents,
            contentType: "application/octet-stream",
          })
        );
        return socket.end();
      } else {
        socket.write(
          response({
            status: "404 Not Found",
          })
        );
        return socket.end();
      }
    }

    // Write file
    if (route.includes("/files/") && method === "POST") {
      const fileName = route.split("/files/")[1];
      await writeFile(fileName, body as string);

      socket.write(
        response({
          status: "201 Created",
        })
      );
      return socket.end();
    }

    // Unhandled routes:
    socket.write(response({ status: "404 Not Found" }));
    return socket.end();
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
