import { createClient } from "@libsql/client";

const allowedOrigin = "https://nagisinnra.github.io";
const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
};

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Cloud-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    if (origin !== allowedOrigin) return json(res, 403, { error: "Origin not allowed" });
    res.statusCode = 204;
    return res.end();
  }
  if (origin && origin !== allowedOrigin) return json(res, 403, { error: "Origin not allowed" });
  if (!process.env.CLOUD_ACCESS_KEY || req.headers["x-cloud-key"] !== process.env.CLOUD_ACCESS_KEY) {
    return json(res, 401, { error: "Access denied" });
  }
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    return json(res, 503, { error: "Database is not configured" });
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  try {
    if (req.method === "GET") {
      const result = await client.execute(
        "SELECT id, title, body, updated_at FROM cloud_notes ORDER BY updated_at DESC"
      );
      return json(res, 200, { notes: result.rows.map(row => ({
        id: row.id, title: row.title, body: row.body, updated_at: row.updated_at
      })) });
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > 64 * 1024) return json(res, 413, { error: "Request too large" });
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
    catch { return json(res, 400, { error: "Invalid JSON" }); }

    if (req.method === "POST") {
      const id = String(body.id || "");
      const title = String(body.title || "Untitled note").slice(0, 120);
      const content = String(body.body || "").slice(0, 50000);
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return json(res, 400, { error: "Invalid note ID" });
      const updatedAt = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO cloud_notes (id, title, body, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, body=excluded.body, updated_at=excluded.updated_at`,
        args: [id, title, content, updatedAt]
      });
      return json(res, 200, { ok: true, updated_at: updatedAt });
    }

    if (req.method === "DELETE") {
      const id = String(body.id || "");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return json(res, 400, { error: "Invalid note ID" });
      await client.execute({ sql: "DELETE FROM cloud_notes WHERE id = ?", args: [id] });
      return json(res, 200, { ok: true });
    }
  } catch (error) {
    console.error("Nagisinnra Cloud API:", error);
    return json(res, 500, { error: "Database request failed" });
  } finally {
    try { await client.close(); } catch {}
  }
}