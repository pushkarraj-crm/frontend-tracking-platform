// @vitest-environment node
import { Writable } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import handler,{rewriteCookie} from '../api/proxy.js';
class Result extends Writable {
  headers={};chunks=[];statusCode=200;
  setHeader(k,v){this.headers[k.toLowerCase()]=v;}
  _write(chunk,encoding,done){this.chunks.push(Buffer.from(chunk));done();}
  get text(){return Buffer.concat(this.chunks).toString();}
}
afterEach(()=>{delete process.env.API_ORIGIN;vi.restoreAllMocks();});
it('preserves refresh cookies while moving their path behind the frontend API',()=>{
 expect(rewriteCookie('refresh_token=test; HttpOnly; Path=/auth; SameSite=Strict')).toBe('refresh_token=test; HttpOnly; Path=/api/auth; SameSite=Strict; Secure');
 expect(rewriteCookie('csrf_token=test; Path=/; Secure')).toBe('csrf_token=test; Path=/; Secure');
});
it('proxies authenticated requests and streams CSV without caching',async()=>{
 process.env.API_ORIGIN='https://backend.example.com';
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('id,amount\n1,1.00',{headers:{'Content-Type':'text/csv','X-Export-Truncated':'false'}}));
 const res=new Result();await handler({url:'/api/proxy?upstreamPath=reports/export/conversions&country=IN',method:'GET',headers:{cookie:'refresh_token=test',authorization:'Bearer test'}},res);
 expect(fetcher.mock.calls[0][0].href).toBe('https://backend.example.com/reports/export/conversions?country=IN');
 expect(fetcher.mock.calls[0][1].headers.get('cookie')).toBe('refresh_token=test');
 expect(res.text).toContain('1,1.00');expect(res.headers['cache-control']).toBe('no-store');
});
it('rejects path traversal and does not contact an arbitrary destination',async()=>{
 process.env.API_ORIGIN='https://backend.example.com';const fetcher=vi.spyOn(globalThis,'fetch');const res=new Result();
 await handler({url:'/api/proxy?upstreamPath=../internal',method:'GET',headers:{}},res);
 expect(res.statusCode).toBe(400);expect(fetcher).not.toHaveBeenCalled();
});
it('returns an explicit setup error when the backend is not connected',async()=>{
 const res=new Result();await handler({url:'/api/proxy?upstreamPath=offers',method:'GET',headers:{}},res);expect(res.statusCode).toBe(503);
});

