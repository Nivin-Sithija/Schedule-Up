import {env,pipeline} from '@huggingface/transformers';
if(process.env.EMBEDDING_CACHE_PATH)env.cacheDir=process.env.EMBEDDING_CACHE_PATH;
const extractor=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
const result=await extractor('ScheduleUp embedding readiness',{pooling:'mean',normalize:true});
if(result.data.length!==384)throw new Error('Unexpected embedding dimensions');
await extractor.dispose();
console.log('Embedding model cached and verified (384 dimensions).');
