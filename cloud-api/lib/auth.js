import { createClient } from "@libsql/client";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const allowedOrigin = "https://nagisinnra.github.io";
export function cors(req,res) {
  const origin=req.headers.origin||"";
  if(origin===allowedOrigin){
    res.setHeader("Access-Control-Allow-Origin",allowedOrigin);
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, DELETE, OPTIONS");
    res.setHeader("Vary","Origin");
  }
  if(origin && origin!==allowedOrigin) return false;
  return true;
}
export function send(res,status,data){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(data));
}
export function db(){
  return createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
}
export async function schema(client){
  await client.execute(`CREATE TABLE IF NOT EXISTS cloud_users(
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS cloud_sessions(
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS cloud_notes(
    id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL, user_id TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS cloud_files(
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, blob_path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL, size INTEGER NOT NULL, content_type TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  const cols=await client.execute("PRAGMA table_info(cloud_notes)");
  if(!cols.rows.some(r=>r.name==="user_id")) await client.execute("ALTER TABLE cloud_notes ADD COLUMN user_id TEXT");
  const count=await client.execute("SELECT COUNT(*) AS n FROM cloud_users");
  if(Number(count.rows[0].n)===0 && process.env.INITIAL_ADMIN_USERNAME && process.env.INITIAL_ADMIN_PASSWORD){
    const id=randomBytes(16).toString("hex");
    await client.execute({sql:"INSERT INTO cloud_users(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)",
      args:[id,process.env.INITIAL_ADMIN_USERNAME,hashPassword(process.env.INITIAL_ADMIN_PASSWORD),"admin",new Date().toISOString()]});
    await client.execute({sql:"UPDATE cloud_notes SET user_id=? WHERE user_id IS NULL",args:[id]});
  }
}
export function hashPassword(password){
  const salt=randomBytes(16).toString("hex");
  const hash=scryptSync(password,salt,64).toString("hex");
  return "scrypt$"+salt+"$"+hash;
}
export function verifyPassword(password,stored){
  const [kind,salt,hash]=String(stored).split("$");
  if(kind!=="scrypt"||!salt||!hash)return false;
  const actual=scryptSync(password,salt,64);
  const expected=Buffer.from(hash,"hex");
  return expected.length===actual.length && timingSafeEqual(actual,expected);
}
export function tokenHash(token){return createHash("sha256").update(token).digest("hex");}
export async function currentUser(req,client){
  const header=req.headers.authorization||"";
  const token=header.startsWith("Bearer ")?header.slice(7):"";
  if(!token)return null;
  const result=await client.execute({sql:`SELECT u.id,u.username,u.role,s.expires_at
    FROM cloud_sessions s JOIN cloud_users u ON u.id=s.user_id
    WHERE s.token_hash=?`,args:[tokenHash(token)]});
  const user=result.rows[0];
  if(!user)return null;
  if(new Date(user.expires_at).getTime()<Date.now()){
    await client.execute({sql:"DELETE FROM cloud_sessions WHERE token_hash=?",args:[tokenHash(token)]});
    return null;
  }
  return {id:user.id,username:user.username,role:user.role};
}
export function newToken(){return randomBytes(32).toString("base64url");}
