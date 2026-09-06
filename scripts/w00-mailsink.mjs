// W00 isolated-test loopback SMTP sink. Captures mail on 127.0.0.1 only and
// NEVER relays: it opens no outbound sockets. Mail is appended as JSON lines
// to the mailbox file for test assertions. Not for production use.
import fs from "node:fs";
import net from "node:net";

const HOST = "127.0.0.1";
const PORT = Number(process.argv[2] || "2525");
const MAILBOX = process.argv[3] || (process.env.TEMP || "/tmp") + "/w00-mailbox.jsonl";

function appendRecord(record) {
  fs.appendFileSync(MAILBOX, JSON.stringify(record) + "\n");
}

const server = net.createServer((socket) => {
  socket.write("220 w00-mailsink loopback only\r\n");
  let buffer = "";
  let inData = false;
  let dataLines = [];
  let mailFrom = "";
  let rcptTo = [];

  function resetTransaction() {
    inData = false;
    dataLines = [];
    mailFrom = "";
    rcptTo = [];
  }

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index;
    while ((index = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (inData) {
        if (line === ".") {
          inData = false;
          appendRecord({
            at: new Date().toISOString(),
            from: mailFrom,
            to: rcptTo,
            raw: dataLines.join("\n"),
          });
          console.log(`captured mail from=${mailFrom} to=${rcptTo.join(",")}`);
          resetTransaction();
          socket.write("250 queued in loopback sink\r\n");
        } else {
          dataLines.push(line.startsWith("..") ? line.slice(1) : line);
        }
        continue;
      }
      const [verb, ...rest] = line.split(" ");
      switch ((verb || "").toUpperCase()) {
        case "EHLO":
        case "HELO":
          socket.write("250-w00-mailsink\r\n250 8BITMIME\r\n");
          break;
        case "MAIL":
          mailFrom = rest.join(" ");
          socket.write("250 ok\r\n");
          break;
        case "RCPT":
          rcptTo.push(rest.join(" "));
          socket.write("250 ok\r\n");
          break;
        case "DATA":
          inData = true;
          socket.write("354 end with . on its own line\r\n");
          break;
        case "RSET":
          resetTransaction();
          socket.write("250 ok\r\n");
          break;
        case "NOOP":
          socket.write("250 ok\r\n");
          break;
        case "QUIT":
          socket.write("221 bye\r\n");
          socket.end();
          break;
        default:
          socket.write("502 unimplemented\r\n");
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`w00-mailsink listening on ${HOST}:${PORT} mailbox=${MAILBOX}`);
});
