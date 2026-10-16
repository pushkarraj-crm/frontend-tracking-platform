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
afterEach(()=>{delete process.env.API_ORIGIN;delete process.env.COMPANY_BASE_DOMAIN;vi.restoreAllMocks();});
it('preserves refresh cookies while moving their path behind the frontend API',()=>{
 expect(rewriteCookie('refresh_token=test; HttpOnly; Path=/auth; SameSite=Strict')).toBe('refresh_token=test; HttpOnly; Path=/api/auth; SameSite=Strict; Secure');
 expect(rewriteCookie('csrf_token=test; Path=/; Secure')).toBe('csrf_token=test; Path=/; Secure');
});
it('proxies authenticated requests and streams CSV without caching',async()=>{
 process.env.API_ORIGIN='https://backend.example.com';
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('id,amount\n1,1.00',{headers:{'Content-Type':'text/csv','X-Export-Truncated':'false'}}));
 const res=new Result();await handler({url:'/api/proxy?upstreamPath=reports/export/conversions&country=IN',method:'GET',headers:{cookie:'refresh_token=test; csrf_token=csrf; unrelated_private_cookie=omit',authorization:'Bearer test'}},res);
 expect(fetcher.mock.calls[0][0].href).toBe('https://backend.example.com/reports/export/conversions?country=IN');
 expect(fetcher.mock.calls[0][1].headers.get('cookie')).toBe('refresh_token=test; csrf_token=csrf');
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


it('routes companies from the request host and ignores a supplied company header',async()=>{
 process.env.API_ORIGIN='https://backend.example.com'; process.env.COMPANY_BASE_DOMAIN='example.com';
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{headers:{'Content-Type':'application/json'}}));
 await handler({url:'/api/proxy?upstreamPath=offers',method:'GET',headers:{host:'media.example.com','x-company-slug':'other'}},new Result());
 expect(fetcher.mock.calls[0][1].headers.get('x-company-slug')).toBe('media');
});
it('does not route root or unrelated hosts to a supplied company',async()=>{
 process.env.API_ORIGIN='https://backend.example.com'; process.env.COMPANY_BASE_DOMAIN='example.com';
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response('{}'));
 for(const host of ['example.com','media.example.com.evil.test']) {
  await handler({url:'/api/proxy?upstreamPath=offers',method:'GET',headers:{host,'x-company-slug':'media'}},new Result());
 }
 for(const call of fetcher.mock.calls) expect(call[1].headers.get('x-company-slug')).toBeNull();
});
