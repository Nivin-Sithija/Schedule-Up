import test from 'node:test';
import assert from 'node:assert/strict';
import {inferenceFailure} from '../src/ai-errors.js';
test('upstream 429 is classified even when the provider message omits its status',()=>assert.match(inferenceFailure({message:'Provider returned error',statusCode:429}),/rate limit/));
test('wrapped authorization failures are classified without exposing response content',()=>assert.equal(inferenceFailure({cause:{statusCode:403,responseBody:'private provider response'}}),'Provider rejected access; check the API key and its limits.'));
