import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../src/ui/api-response.js';
test('HTML gateway failures show a useful retry message without exposing the HTML', async () => {
  await assert.rejects(readApiResponse(new Response('<!DOCTYPE html><html>Gateway failure</html>', {status:502}), '/auth/login'), /^Error: ScheduleUp is temporarily unavailable \(HTTP 502\)/);
});
test('unexpected successful HTML responses do not leak a JSON parser error', async () => {
  await assert.rejects(readApiResponse(new Response('<!DOCTYPE html><html>Wrong server</html>'), '/auth/login'), /unexpected response \(HTTP 200\)/);
});
test('authentication errors and valid JSON responses retain their normal behavior', async () => {
  await assert.rejects(readApiResponse(Response.json({error:'Invalid email or password'}, {status:401}), '/auth/login'), /Invalid email or password/);
  await assert.rejects(readApiResponse(Response.json({error:'Unauthorized'}, {status:401}), '/state'), /Please sign in to continue/);
  assert.deepEqual(await readApiResponse(Response.json({ok:true}), '/auth/login'), {ok:true});
});
