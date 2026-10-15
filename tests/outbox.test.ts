import test from 'node:test';
import assert from 'node:assert/strict';
import {sentResponseId} from '../src/connector.js';
import {confirmSend,markUncertain} from '../src/outbox.js';
import {emptyState} from '../src/domain.js';
test('NOWEB raw successful send response matches its message.any webhook identifier',()=>{
 assert.equal(sentResponseId({key:{id:'ABC123',fromMe:true,remoteJid:'111@s.whatsapp.net'}}),'true_111@c.us_ABC123');
 assert.equal(sentResponseId({key:{id:'ABC123',fromMe:true,remoteJid:'999@lid'}}),'true_999@lid_ABC123');
});
test('other connector response formats remain supported',()=>{
 assert.equal(sentResponseId({id:'true_111@c.us_ABC'}),'true_111@c.us_ABC');
 assert.equal(sentResponseId({id:{_serialized:'true_111@c.us_ABC'}}),'true_111@c.us_ABC');
});
test('incomplete and non-outgoing responses remain unconfirmed',()=>{
 assert.equal(sentResponseId({key:{id:'ABC',fromMe:false,remoteJid:'111@s.whatsapp.net'}}),undefined);
 assert.equal(sentResponseId({key:{id:'ABC',fromMe:true}}),undefined);
 assert.equal(sentResponseId({}),undefined);
});
test('late confirmation clears uncertainty and cannot be overwritten by a timeout',()=>{
 const state=emptyState([]);state.schedules.push({id:'request',clientId:'client',taskId:'',taskRevision:0,text:'Test',at:new Date().toISOString(),approvedSeq:0,status:'sending'});
 assert.equal(markUncertain(state,'request','Timeout'),undefined);
 confirmSend(state,'request','provider-id');
 assert.equal(state.schedules[0].status,'sent');assert.equal(state.schedules[0].error,undefined);
 assert.equal(markUncertain(state,'request','Late timeout'),'provider-id');
 assert.equal(state.schedules[0].status,'sent');assert.equal(state.schedules[0].error,undefined);
});
