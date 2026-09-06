import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
const root=path.resolve(process.env.PORTAL_QA_BUILD_DIR||'');
if(!process.env.PORTAL_QA_BUILD_DIR)throw new Error('Set PORTAL_QA_BUILD_DIR to an explicit completed QA build.');
const port=Number(process.env.PORTAL_QA_PORT||4390);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.png':'image/png','.xml':'application/xml','.opml':'text/x-opml','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
  try {
    const parsed=new URL(req.url,'http://localhost');
    const requested=decodeURIComponent(parsed.pathname);
    let file=path.resolve(root,`.${requested}`);
    if(file!==root&&!file.startsWith(`${root}${path.sep}`)){res.writeHead(403);res.end();return;}
    let stat=await fs.stat(file).catch(()=>null);
    if(stat?.isDirectory()){file=path.join(file,'index.html');stat=await fs.stat(file).catch(()=>null);}
    if(!stat?.isFile()){res.writeHead(404);res.end('Not found');return;}
    let body=await fs.readFile(file);
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control',file.includes(`${path.sep}_astro${path.sep}`)?'public, max-age=31536000, immutable':'no-cache');
    res.setHeader('Vary','Accept-Encoding');
    if((req.headers['accept-encoding']||'').includes('gzip')){body=zlib.gzipSync(body);res.setHeader('Content-Encoding','gzip');}
    res.setHeader('Content-Length',body.length);res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(500);res.end('Local QA server error');}
}).listen(port,'127.0.0.1',()=>console.log(`Production client QA build at http://127.0.0.1:${port}`));
