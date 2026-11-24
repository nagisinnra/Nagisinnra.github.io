import { db,schema,cors,send,currentUser } from "../lib/auth.js";
export default async function handler(req,res){
  if(!cors(req,res))return send(res,403,{error:"Origin not allowed"});
  if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
  if(!["GET","POST","DELETE"].includes(req.method))return send(res,405,{error:"Method not allowed"});
  if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)return send(res,503,{error:"Database is not configured"});
  const client=db();
  try{
    await schema(client);
    const user=await currentUser(req,client);
    if(!user)return send(res,401,{error:"Please sign in"});
    if(req.method==="GET"){
      const result=await client.execute({sql:"SELECT id,title,body,updated_at FROM cloud_notes WHERE user_id=? ORDER BY updated_at DESC",args:[user.id]});
      return send(res,200,{notes:result.rows});
    }
    const body=req.body||{};
    const id=String(body.id||"");
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))return send(res,400,{error:"Invalid note ID"});
    if(req.method==="POST"){
      const title=String(body.title||"Untitled note").slice(0,120);
      const content=String(body.body||"").slice(0,50000);
      const updatedAt=new Date().toISOString();
      await client.execute({sql:`INSERT INTO cloud_notes(id,title,body,updated_at,user_id) VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,updated_at=excluded.updated_at
        WHERE cloud_notes.user_id=excluded.user_id`,args:[id,title,content,updatedAt,user.id]});
      return send(res,200,{ok:true,updated_at:updatedAt});
    }
    await client.execute({sql:"DELETE FROM cloud_notes WHERE id=? AND user_id=?",args:[id,user.id]});
    return send(res,200,{ok:true});
  }catch(error){console.error("Cloud notes error:",error);return send(res,500,{error:"Database request failed"});}
  finally{try{await client.close();}catch{}}
}