export function inferenceFailure(error:unknown):string {
  let current:any=error;
  for(let i=0;current&&i<8;i++,current=current.cause){
    if(current.statusCode===429 || /429|rate.limit|quota/i.test(String(current.message||'')))return 'Provider rate limit reached; analysis retained for retry.';
    if(current.statusCode===401 || current.statusCode===403)return 'Provider rejected access; check the API key and its limits.';
  }
  return 'Check model endpoint.';
}
