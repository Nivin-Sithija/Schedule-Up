export function readAuthForm(form:FormData,mode:'login'|'register'){
  const email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');
  if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Enter a valid email address.');
  if(!password)throw new Error('Enter your password.');
  if(password.length>128)throw new Error('Use a password of at most 128 characters.');
  if(mode==='login')return {email,password};
  const name=String(form.get('name')||'').trim(),confirmation=String(form.get('confirmPassword')||'');
  if(!name)throw new Error('Enter your name.');
  if(password.length<15)throw new Error('Use a password of at least 15 characters.');
  if(password!==confirmation)throw new Error('Passwords do not match. Re-enter the confirmation.');
  return {name,email,password};
}
