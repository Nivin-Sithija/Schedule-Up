import {readFileSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';
export function tigerTls(caPath:string,caBase64:string) {
  if(!caPath&&!caBase64)return undefined;
  const ca=caBase64?Buffer.from(caBase64,'base64').toString('utf8'):readFileSync(caPath,'utf8');
  try{new X509Certificate(ca);}catch{throw new Error('Tiger CA must contain a valid PEM certificate');}
  return {ca,rejectUnauthorized:true as const};
}
