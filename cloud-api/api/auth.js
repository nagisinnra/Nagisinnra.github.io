import { db,schema,cors,send,hashPassword,verifyPassword,tokenHash,currentUser,newToken } from "../lib/auth.js";

export default async function handler(req,res){
  if(!cors(req,res))return send(res,403,{error:"Origin not allowed"});
  if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
  if(!["GET","POST"].includes(req.method))return send(res,405,{error:"Method not allowed"});
  if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)return send(res,503,{error:"Database is not configured"});
  const client=db();
  try{
    await schema(client);
    if(req.method==="GET"){
      const user=await currentUser(req,client);
      if(!user)return send(res,401,{error:"Please sign in"});
      return send(res,200,{user});
    }
    const body=req.body||{};
    const action=String(body.action||"");
    if(action==="login"){
      const username=String(body.username||"").trim().toLowerCase();
      const password=String(body.password||"");
      const found=await client.execute({sql:"SELECT id,username,password_hash,role FROM cloud_users WHERE username=?",args:[username]});
      const row=found.rows[0];
      if(!row||!verifyPassword(password,row.password_hash))return send(res,401,{error:"Account name or password is incorrect"});
      const token=newToken(),expires=new Date(Date.now()+7*24*60*60*1000).toISOString();
      await client.execute({sql:"INSERT INTO cloud_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",args:[tokenHash(token),row.id,expires]});
      return send(res,200,{token,user:{id:row.id,username:row.username,role:row.role}});
    }
    const user=await currentUser(req,client);
    if(!user)return send(res,401,{error:"Please sign in"});
    if(action==="logout"){
      const token=(req.headers.authorization||"").slice(7);
      await client.execute({sql:"DELETE FROM cloud_sessions WHERE token_hash=?",args:[tokenHash(token)]});
      return send(res,200,{ok:true});
    }
    if(action==="create-user"){
      if(user.role!=="admin")return send(res,403,{error:"Administrator access required"});
      const username=String(body.username||"").trim().toLowerCase();
      const password=String(body.password||"");
      if(!/^[a-z0-9_-]{3,24}$/.test(username))return send(res,400,{error:"Account name must be 3–24 characters (a-z, 0-9, _ or -)"});
      if(password.length<10||password.length>128)return send(res,400,{error:"Password must be 10–128 characters"});
      const id=newToken();
      await client.execute({sql:"INSERT INTO cloud_users(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)",
        args:[id,username,hashPassword(password),"user",new Date().toISOString()]});
      return send(res,201,{ok:true,username});
    }
    if(action==="list-users"){
      if(user.role!=="admin")return send(res,403,{error:"Administrator access required"});
      const rows=await client.execute("SELECT username,role,created_at FROM cloud_users ORDER BY created_at");
      return send(res,200,{users:rows.rows});
    }
    if(action==="change-password"){
      const password=String(body.password||"");
      if(password.length<10||password.length>128)return send(res,400,{error:"Password must be 10–128 characters"});
      await client.execute({sql:"UPDATE cloud_users SET password_hash=? WHERE id=?",args:[hashPassword(password),user.id]});
      return send(res,200,{ok:true});
    }
    return send(res,400,{error:"Unknown action"});
  }catch(error){
    if(String(error.message||"").includes("UNIQUE"))return send(res,409,{error:"That account name already exists"});
    console.error("Cloud auth error:",error);
    return send(res,500,{error:"Authentication request failed"});
  }finally{try{await client.close();}catch{}}
}