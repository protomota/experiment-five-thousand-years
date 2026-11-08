import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const require=createRequire(`${root}/publish-tools/package.json`);
const {S3Client,PutObjectCommand,HeadObjectCommand}=require('@aws-sdk/client-s3');
const release=process.argv[2];
if(!release||!/^[a-z0-9-]+$/.test(release))throw Error('Usage: node scripts/upload-release.mjs <prepared-release-id>');
const out=`${root}/releases/${release}`;
const report=JSON.parse(await readFile(`${out}/release.json`,'utf8'));
const required=name=>{const value=process.env[name];if(!value)throw Error(`Missing environment variable: ${name}`);return value;};
const client=new S3Client({region:'auto',endpoint:required('R2_ENDPOINT'),credentials:{accessKeyId:required('R2_ACCESS_KEY_ID'),secretAccessKey:required('R2_SECRET_ACCESS_KEY')},maxAttempts:5});
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const queue=[...report.objects];let completed=0;
async function worker(){while(queue.length){
 const object=queue.shift(),Key=`five-thousand-years/releases/${release}/${object.key}`,Bucket=required('R2_BUCKET');
 const Body=await readFile(`${out}/r2/${object.key}`);
 if(createHash('sha256').update(Body).digest('hex')!==object.sha256)throw Error(`Staged file changed: ${object.key}`);
 let existing;try{existing=await client.send(new HeadObjectCommand({Bucket,Key}));}catch(error){if(error.$metadata?.httpStatusCode!==404)throw error;}
 if(existing&&existing.Metadata?.sha256!==object.sha256)throw Error(`Refusing to overwrite a different immutable object: ${Key}`);
 if(!existing)await client.send(new PutObjectCommand({Bucket,Key,Body,ContentType:types[path.extname(object.key)]||'application/octet-stream',ContentEncoding:object.encoding,CacheControl:'public, max-age=31536000, immutable',Metadata:{sha256:object.sha256},IfNoneMatch:'*'}));
 const verified=await client.send(new HeadObjectCommand({Bucket,Key}));
 if(verified.ContentLength!==object.bytes||verified.Metadata?.sha256!==object.sha256)throw Error(`Verification failed: ${Key}`);
 completed++;if(completed%100===0)console.log(`Uploaded and verified ${completed}/${report.objects.length}`);
}}
await Promise.all(Array.from({length:6},worker));
await writeFile(`${out}/upload.json`,JSON.stringify({uploadedAt:new Date().toISOString(),objects:completed,totalBytes:report.totalBytes,cdn:report.cdn},null,2));
console.log(`Verified ${completed} objects at ${report.cdn}`);
