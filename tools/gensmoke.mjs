import fs from 'node:fs';
const B='https://prico-ai.onrender.com';
const J=async(p,tok,body)=>{const r=await fetch(B+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined});return r.json();};
const A=await J('/api/auth/register',null,{email:`g${Date.now()}@pricoai.test`,password:'secret123',name:'Gen'});
const img='data:image/jpeg;base64,'+fs.readFileSync('assets/seed/face1.jpg').toString('base64'), cut='data:image/png;base64,'+fs.readFileSync('assets/seed/cut1.png').toString('base64');
const f=await J('/api/faces',A.token,{consent:true,img,cut}); console.log('faces',f.faces?.length);
for (const id of ['p_muscle','v_flamingo']) { const g=await J('/api/generate',A.token,{templateId:id,faceIds:f.faces.map(x=>x.id)}); const jid=g.job?.id; let st; const t0=Date.now();
 for(let i=0;i<150&&jid;i++){await new Promise(r=>setTimeout(r,3000)); st=(await J('/api/jobs/'+jid,A.token)).job; if(st.status==='done'||st.status==='error'||st.status==='failed')break;}
 console.log(id, JSON.stringify(g).slice(0,80), st?.status, (Date.now()-t0)/1000+'s'); }
