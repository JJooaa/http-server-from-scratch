import { gzipSync } from "bun";
import * as net from "node:net";

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
  contentType?: string;
  contentLength: number;
  headers?: string;
  headersRaw?: string[];
};

/**
 * Example when writing a response - it's recommended to send the body as a second socket.write() statement:
 *
 * const body = "foobar"
 *
 * socket.write(response({ status: "200 OK", contentLength: body.length }));
 * socket.write(body)
 *
 */
function response({
  status,
  contentType = "text/plain",
  contentLength = 0,
  headers,
  headersRaw,
}: ResponseArgs) {
  const { value } = getHeaderFromHeaders(headersRaw ?? [], "Connection:");
  const closeConnection = value ? "Connection: close\r\n" : "";

  return (
    `HTTP/1.1 ${status}\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `Content-Length: ${contentLength}\r\n` +
    `${headers ?? ""}` +
    closeConnection +
    "\r\n" // end of headers
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

function getHeaderFromHeaders(headers: string[], headerName: string) {
  const header = headers.find((item) => item.includes(headerName));
  const keyValue = header?.split(":"); // ["User Agent:", " foobar"]

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
  socket.on("data", async (chunk: Buffer) => {
    const { route, body, method, headers } = parseHttpRequest(chunk.toString());
    const shouldClose = headers.some((h) =>
      h.toLowerCase().includes("connection: close")
    );

    if (route === "/") {
      socket.write(
        response({ status: "200 OK", contentLength: 0, headersRaw: headers })
      );
      if (shouldClose) socket.end();
      return;
    }

    if (route === "/user-agent") {
      const { value } = getHeaderFromHeaders(headers, "User-Agent:");
      socket.write(
        response({
          status: "200 OK",
          contentLength: value?.length ?? 0,
          headersRaw: headers,
        })
      );
      socket.write(value as string);
      if (shouldClose) socket.end();
      return;
    }

    if (route.includes("/echo/")) {
      const echoedValue = route.split("/echo/")[1]; // [ "", "echoed_value_here"]
      const { key, value } = getHeaderFromHeaders(headers, "Accept-Encoding:");

      const validContentEncoding = value
        ?.split(", ") // encoding schemas are seperated by a comma
        .find((enc) => CONTENT_ENCODING_TYPES.includes(enc));

      if (key && validContentEncoding) {
        const compressed = Buffer.from(gzipSync(echoedValue));
        socket.write(
          response({
            status: "200 OK",
            contentLength: compressed.length,
            headers: `Content-Encoding: ${validContentEncoding}\r\n`,
            headersRaw: headers,
          })
        );
        socket.write(compressed);
        if (shouldClose) socket.end();
        return;
      } else {
        socket.write(
          response({
            status: "200 OK",
            contentLength: echoedValue.length,
            headersRaw: headers,
          })
        );
        socket.write(echoedValue);
        if (shouldClose) socket.end();
        return;
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
            contentLength: fileContents.length,
            contentType: "application/octet-stream",
            headersRaw: headers,
          })
        );
        socket.write(fileContents);
        if (shouldClose) socket.end();
        return;
      } else {
        socket.write(
          response({
            status: "404 Not Found",
            contentLength: 0,
            headersRaw: headers,
          })
        );
        if (shouldClose) socket.end();
        return;
      }
    }

    // Write file
    if (route.includes("/files/") && method === "POST") {
      const fileName = route.split("/files/")[1];
      await writeFile(fileName, body as string);

      socket.write(
        response({
          status: "201 Created",
          contentLength: 0,
          headersRaw: headers,
        })
      );
      if (shouldClose) socket.end();
      return;
    }

    // Unhandled routes:
    socket.write(
      response({
        status: "404 Not Found",
        contentLength: 0,
        headersRaw: headers,
      })
    );
    if (shouldClose) socket.end();
    return;
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
