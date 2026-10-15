import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {tigerTls} from '../src/database-tls.js';
test('hosted Tiger CA keeps certificate verification enabled and overrides a local-only path',()=>{const ca=rootCertificates[0],result=tigerTls('/local-only/unavailable.pem',Buffer.from(ca).toString('base64'));assert.equal(result?.ca,ca);assert.equal(result?.rejectUnauthorized,true);});
test('invalid inline CA fails closed',()=>assert.throws(()=>tigerTls('',Buffer.from('not a certificate').toString('base64')),/valid PEM/));
test('absent CA leaves normal PostgreSQL connection TLS options untouched',()=>assert.equal(tigerTls('',''),undefined));
