import {cpSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'docs');
mkdirSync(output,{recursive:true});
cpSync(path.join(root,'public'),output,{recursive:true});
writeFileSync(path.join(output,'.nojekyll'),'');
console.log('GitHub Pages game prepared in docs/.');
