import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { del, get, put } from "@vercel/blob";
import { db, schema, cors, send, currentUser } from "../lib/auth.js";

export const config = { api: { bodyParser: false } };
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function safeFilename(value) {
  const name = String(value || "file").replace(/\\/g, "/").split("/").pop()
    .replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 180);
  return name || "file";
}
function attachmentName(name) {
  return "attachment; filename*=UTF-8''" + encodeURIComponent(name);
}
async function readLimited(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (!cors(req, res)) return send(res, 403, { error: "Origin not allowed" });
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (!["GET", "POST", "DELETE"].includes(req.method)) return send(res, 405, { error: "Method not allowed" });
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) return send(res, 503, { error: "Database is not configured" });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: "File storage is not connected" });

  const client = db();
  try {
    await schema(client);
    const user = await currentUser(req, client);
    if (!user) return send(res, 401, { error: "Please sign in" });
    const url = new URL(req.url, "https://cloud-api.invalid");

    if (req.method === "GET" && !url.searchParams.get("id")) {
      const result = await client.execute({
        sql: "SELECT id,filename,size,content_type,created_at FROM cloud_files WHERE user_id=? ORDER BY created_at DESC",
        args: [user.id]
      });
      return send(res, 200, { files: result.rows });
    }

    if (req.method === "POST") {
      const filename = safeFilename(decodeURIComponent(String(req.headers["x-file-name"] || "file")));
      const contentType = String(req.headers["content-type"] || "application/octet-stream").slice(0, 120);
      const declared = Number(req.headers["content-length"] || 0);
      if (declared > MAX_FILE_SIZE) return send(res, 413, { error: "File is too large. Maximum size is 4 MB." });
      const buffer = await readLimited(req);
      if (!buffer.length) return send(res, 400, { error: "The selected file is empty." });
      const id = randomUUID();
      const pathname = user.id + "/" + id + "/" + filename;
      const blob = await put(pathname, buffer, { access: "private", addRandomSuffix: false, contentType });
      const createdAt = new Date().toISOString();
      await client.execute({
        sql: "INSERT INTO cloud_files(id,user_id,blob_path,filename,size,content_type,created_at) VALUES(?,?,?,?,?,?,?)",
        args: [id, user.id, blob.pathname, filename, buffer.length, contentType, createdAt]
      });
      return send(res, 201, { ok: true, file: { id, filename, size: buffer.length, content_type: contentType, created_at: createdAt } });
    }

    const id = url.searchParams.get("id") || "";
    if (!/^[a-f0-9-]{36}$/i.test(id)) return send(res, 400, { error: "Invalid file ID" });
    const found = await client.execute({
      sql: "SELECT id,blob_path,filename,size,content_type FROM cloud_files WHERE id=? AND user_id=?",
      args: [id, user.id]
    });
    const file = found.rows[0];
    if (!file) return send(res, 404, { error: "File not found" });

    if (req.method === "DELETE") {
      await del(file.blob_path, { access: "private" });
      await client.execute({ sql: "DELETE FROM cloud_files WHERE id=? AND user_id=?", args: [id, user.id] });
      return send(res, 200, { ok: true });
    }

    const result = await get(file.blob_path, { access: "private" });
    if (!result) return send(res, 404, { error: "File content not found" });
    res.statusCode = 200;
    res.setHeader("Content-Type", file.content_type || "application/octet-stream");
    res.setHeader("Content-Disposition", attachmentName(file.filename));
    res.setHeader("Content-Length", String(file.size));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    if (error.message === "FILE_TOO_LARGE") return send(res, 413, { error: "File is too large. Maximum size is 4 MB." });
    console.error("Cloud files error:", error);
    return send(res, 500, { error: "File operation failed" });
  } finally {
    try { await client.close(); } catch {}
  }
}
