# HTTP Server from Scratch (Node.js + TCP)

This is a simple HTTP/1.1 server built entirely using raw TCP sockets in Node.js. It manually parses incoming requests and crafts proper HTTP responses, without using any web frameworks or higher-level abstractions.

## 🚀 Why I Built This

I built this project as part of a learning challenge, to better understand what actually happens beneath the surface of a web server. Instead of relying on libraries, I wanted to break things down to the fundamentals — working directly with raw TCP sockets and writing my own HTTP handling logic.

## 🧠 What I Learned

This project gave me a much deeper understanding of how HTTP works at a lower level. I got to explore:

- The structure and purpose of HTTP headers
- How requests and responses are formed and transmitted over a TCP connection
- The difference between persistent and non-persistent connections
- How servers decide to keep a connection open or close it
- Why small details — like header formatting and `Content-Length` — really matter

It was a valuable exercise in thinking like a protocol, rather than a framework.

## 🔧 What It Supports

- Routing:
  - `/` responds with a basic 200 OK
  - `/user-agent` echoes the client’s user-agent
  - `/echo/:value` echoes the value in the URL
  - `/files/:filename` handles reading and writing plain text files (GET & POST)
- Basic compression support (gzip) if requested via `Accept-Encoding`
- Manual handling of HTTP status lines, headers, and bodies
- Basic connection control with `Connection: close`

## 🛠 Running the Server

```bash
bun run main.ts --directory ./files
```

This `curl` command exercises persistent connection handling and custom headers:

```bash
curl --http1.1 -v http://localhost:4221/echo/banana \
  --next http://localhost:4221/user-agent \
  -H "Connection: close" \
  -H "User-Agent: mango/raspberry-pineapple"
```
