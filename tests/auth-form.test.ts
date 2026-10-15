import test from 'node:test';
import assert from 'node:assert/strict';
import {readAuthForm} from '../src/ui/auth-form.js';
function fields(values:Record<string,string>){const form=new FormData();for(const [key,value] of Object.entries(values))form.set(key,value);return form;}
test('registration reads submitted fields including browser-autofilled values',()=>{
  const value={name:'Example',email:'person@example.test',password:'A long test passphrase',confirmPassword:'A long test passphrase'};
  assert.deepEqual(readAuthForm(fields(value),'register'),{name:value.name,email:value.email,password:value.password});
});
test('registration exposes short passwords and confirmation mismatches explicitly',()=>{
  const value={name:'Example',email:'person@example.test',password:'A long test passphrase',confirmPassword:'Different passphrase'};
  assert.throws(()=>readAuthForm(fields(value),'register'),/Passwords do not match/);
  assert.throws(()=>readAuthForm(fields({...value,password:'short'}),'register'),/at least 15/);
  assert.throws(()=>readAuthForm(fields({...value,email:''}),'register'),/valid email/);
});
