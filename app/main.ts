import * as net from "node:net";

function responseHeaderGenerator(header: string, value: string) {
  return `${header}: ${value}\r\n` as const;
}

const CONTENT_ENCODING_TYPES = [
  "gzip",
  "compress",
  "deflate",
  "br",
  "zstd",
  "dcb",
  "dcz",
];

type ResponseArgs = {
  status: string;
  body?: string;
  contentType?: string;
  headers?: string[];
};

function response({
  status,
  body = "",
  contentType = "text/plain",
  headers,
}: ResponseArgs) {
  return (
    `HTTP/1.1 ${status}\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `Content-Length: ${body.length ?? 0}\r\n` +
    `${headers?.join() ?? ""}` +
    "\r\n" + // end of headers
    `${body}`
  );
}

function parseHttpRequest(request: string) {
  const requestHeadersArray = request.split("\r\n");
  const requestLine = requestHeadersArray.shift()?.split(" "); // "GET / HTTP/1.1"
  const body = requestHeadersArray.pop();

  const method = requestLine?.[0] ?? ""; // GET, POST, PUT, PATCH, etc..
  const route = requestLine?.[1] ?? ""; // "/foo" | "/bar"

  return { route, body, method, headers: requestHeadersArray };
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

    const { route, body, method, headers } = parseHttpRequest(request);

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
      const echoedValue = route.split("/echo/")[1]; // [ "", "echoed_value_here"]
      const acceptsEncoding = headers
        .find((item) => item.includes("Accept-Encoding"))
        ?.split(": ");
      const validContentEncoding = acceptsEncoding?.[1]
        .split(", ")
        .find((enc) => CONTENT_ENCODING_TYPES.includes(enc));

      if (acceptsEncoding && validContentEncoding) {
        socket.write(
          response({
            status: "200 OK",
            headers: [
              responseHeaderGenerator("Content-Encoding", validContentEncoding),
            ],
          })
        );
        return socket.end();
      } else {
        socket.write(response({ status: "200 OK", body: echoedValue }));
        return socket.end();
      }
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
