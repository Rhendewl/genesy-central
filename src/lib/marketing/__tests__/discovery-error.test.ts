// @vitest-environment node
import {expect,it} from 'vitest';
import {metaDiscoveryError} from '../discovery-error';
import {competitorUsernameInput} from '../competitor-domain';
it.each([
 [400,{code:190,message:'Invalid token'},'credentials',503],
 [403,{code:10,message:'Missing permission'},'permission',403],
 [400,{code:100,message:'Tried accessing nonexisting field (business_discovery) on node type (User)'},'configuration',503],
 [400,{code:100,message:'Invalid username'},'profile_unavailable',404],
 [400,{code:110,error_subcode:2207013,message:'Invalid user id'},'profile_unavailable',404],
 [400,{code:4,message:'Limit'},'rate_limit',429],
 [503,{message:'Unavailable'},'temporary',502],
 [400,{code:100,message:'Unknown rejection'},'rejected',422]
])('distinguishes Meta failures without claiming every profile needs approval %j',(status,error,kind,http)=>{
 const e=metaDiscoveryError(status as number,error as Record<string,unknown>,'test-secret');expect(e.kind).toBe(kind);expect(e.status).toBe(http);expect(e.message).not.toContain('não liberou');
});
it('redacts credentials and URLs from the private maintenance diagnostic',()=>{const e=metaDiscoveryError(400,{code:100,message:'test-secret https://graph.facebook.com/me?access_token=test-secret'},'test-secret');expect(e.message).not.toContain('test-secret');expect(e.diagnostic).not.toContain('test-secret');expect(e.diagnostic).not.toContain('https://');});
it('accepts handles or canonical profile links and rejects posts, external hosts and credentials',()=>{
 expect(competitorUsernameInput(' @GenesyCompany ')).toBe('genesycompany');expect(competitorUsernameInput('https://www.instagram.com/GenesyCompany/?igsh=x')).toBe('genesycompany');for(const v of ['https://evil.test/profile','https://instagram.com/p/abc/','http://instagram.com/target','https://user:pass@instagram.com/target','https://instagram.com/reels/','https://instagram.com/a/b','x){id}'])expect(()=>competitorUsernameInput(v)).toThrow();
});
