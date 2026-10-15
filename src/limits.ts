export class RequestLimitError extends Error {
  statusCode = 429;
  constructor(public retryAfter: number) { super('Too many requests. Please wait before trying again.'); }
}
export class WindowLimiter {
  private buckets = new Map<string,{count:number;until:number}>();
  constructor(private capacity = 10000) {}
  consume(key:string, max:number, windowMs:number, now=Date.now()) {
    let bucket=this.buckets.get(key);
    if (!bucket || bucket.until<=now) {
      if(this.buckets.size>=this.capacity){for(const [id,item]of this.buckets)if(item.until<=now)this.buckets.delete(id);}
      if(!bucket && this.buckets.size>=this.capacity)throw new RequestLimitError(60);
      bucket={count:0,until:now+windowMs};this.buckets.set(key,bucket);
    }
    if(bucket.count>=max)throw new RequestLimitError(Math.max(1,Math.ceil((bucket.until-now)/1000)));
    bucket.count++;
  }
}
export const operationLimits = new WindowLimiter();
