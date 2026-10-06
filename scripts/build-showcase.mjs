import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const dest = resolve(root, 'dist'); mkdirSync(dest, { recursive:true });
const files = ['index.html','showcase.js','showcase.css','demo.html','demo.js','demo.css','loader.js','loader.css','widget.html','widget.js','widget.css'];
for (const file of files) copyFileSync(resolve(root,'public',file),resolve(dest,file));
let index = readFileSync(resolve(dest,'index.html'),'utf8');
index = index.replace('data-ss07-preview="false"','data-ss07-preview="true"');
writeFileSync(resolve(dest,'index.html'),index);
const knowledge = JSON.parse(readFileSync(resolve(root,'knowledge.json'),'utf8'));
const config = JSON.parse(readFileSync(resolve(root,'showcase.config.json'),'utf8'));
const publicConfig = { sample:knowledge.sample, navigation:knowledge.navigation, hostOrigins:[config.origin], links:[...knowledge.projects,knowledge.contact].filter(x=>x.url).map(x=>({label:x.name||'GitHub profile',url:x.url})) };
writeFileSync(resolve(dest,'preview-config.json'),JSON.stringify(publicConfig));
// The historical sample demo is clearly labeled and also avoids nonexistent API calls when hosted.
const demoScript = readFileSync(resolve(dest,'demo.js'),'utf8').replace('theme: initialTheme,','theme: initialTheme, previewOnly: true,');
writeFileSync(resolve(dest,'demo.js'),demoScript);
console.log('Built private SS07 showcase. AI backend deliberately disconnected; no secrets or database included.');
