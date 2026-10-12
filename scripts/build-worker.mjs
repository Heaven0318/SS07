import { readFileSync,writeFileSync,mkdirSync,rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),dest=resolve(root,'dist');
if(dest!==resolve(root,'dist'))throw Error('Invalid build path');
rmSync(dest,{recursive:true,force:true});mkdirSync(resolve(dest,'server'),{recursive:true});mkdirSync(resolve(dest,'.openai'),{recursive:true});
const files=['index.html','showcase.js','showcase.css','demo.html','demo.js','demo.css','loader.js','loader.css','widget.html','widget.js','widget.css'];
const assets=Object.fromEntries(files.map(file=>['/'+(file==='index.html'?'':file),{type:({html:'text/html',js:'text/javascript',css:'text/css'})[file.split('.').at(-1)],body:readFileSync(resolve(root,'public',file),'utf8')}]));
assets['/ss07-logo.jpg']={type:'image/jpeg',encoding:'base64',body:readFileSync(resolve(root,'public/ss07-logo.jpg')).toString('base64')};
let code=['server/provider.mjs','worker/limits.mjs','worker/index.mjs'].map(file=>readFileSync(resolve(root,file),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export (async function|function|const) /gm,'$1 ')).join('\n');
// Validation's fail helper has its own scope to avoid colliding with Worker helpers.
const validation=readFileSync(resolve(root,'server/validation.mjs'),'utf8').replace('export function validate','function validate');
code='const validate=(()=>{'+validation+';return validate;})();\n'+code;
code=code.replace('__SS07_ASSETS__',JSON.stringify(assets)).replace('__SS07_KNOWLEDGE__',readFileSync(resolve(root,'knowledge.json'),'utf8')).replace('__SS07_ORIGIN__',JSON.stringify(JSON.parse(readFileSync(resolve(root,'showcase.config.json'),'utf8')).origin));
writeFileSync(resolve(dest,'server/index.js'),code);writeFileSync(resolve(dest,'.openai/hosting.json'),readFileSync(resolve(root,'.openai/hosting.json')));
console.log('Built SS07 Worker with server API and isolated widget. No secrets included.');
