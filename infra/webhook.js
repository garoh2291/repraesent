"use strict";

const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs");

const SECRET = fs.readFileSync("/usr/local/etc/webhook.secret", "utf8").trim();
const PORT = 9001;

function verify(payload, signature) {
  if (!signature) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

let deploying = false;

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/hooks/b7e2f8a7970014936c6acaba744c86e3") {
    res.writeHead(404);
    return res.end("Not found\n");
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString();

    if (!verify(body, req.headers["x-hub-signature-256"])) {
      console.log(new Date().toISOString(), "Invalid signature");
      res.writeHead(403);
      return res.end("Forbidden\n");
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      return res.end("Bad request\n");
    }

    if (payload.ref !== "refs/heads/main") {
      console.log(new Date().toISOString(), "Ignoring push to", payload.ref);
      res.writeHead(200);
      return res.end("Skipped (not main)\n");
    }

    if (deploying) {
      console.log(new Date().toISOString(), "Deploy already in progress, skipping");
      res.writeHead(409);
      return res.end("Deploy already in progress\n");
    }

    console.log(
      new Date().toISOString(),
      "Deploy triggered by",
      (payload.pusher && payload.pusher.name) || "unknown"
    );
    res.writeHead(200);
    res.end("Deploy started\n");

    deploying = true;
    execFile("/usr/local/bin/deploy.sh", (err, stdout, stderr) => {
      deploying = false;
      if (err) {
        console.error(new Date().toISOString(), "Deploy FAILED:", err.message);
        if (stderr) console.error(stderr);
      } else {
        console.log(new Date().toISOString(), "Deploy completed");
      }
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(new Date().toISOString(), "Webhook listener on 127.0.0.1:" + PORT);
});
