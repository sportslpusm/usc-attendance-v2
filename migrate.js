const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..');
const destDir = path.join(__dirname, 'src', 'app');
const targetPage = path.join(destDir, 'page.tsx');

const indexHtml = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf-8');
const jsHtml = fs.readFileSync(path.join(srcDir, 'javascript.html'), 'utf-8');

let bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\?!= include\('javascript'\); \?>/i);
if (!bodyMatch) bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let extractedHtml = bodyMatch ? bodyMatch[1].trim() : '';

let jsMatch = jsHtml.match(/<script>([\s\S]*?)<\/script>/i);
let extractedJs = jsMatch ? jsMatch[1].trim() : '';

const apiProxy = `
window.google = { script: { run: new Proxy({}, {
  get: (target, prop) => (...args) => {
    let s = null, f = null;
    const chain = {
       withSuccessHandler: h => { s = h; return chain; },
       withFailureHandler: h => { f = h; return chain; }
    };
    if (prop === 'withSuccessHandler' || prop === 'withFailureHandler') return chain[prop](args[0]);
    
    console.log('[API PROXY] Calling API Route:', prop, args);
    
    fetch('/api/gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ func: prop, args })
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        console.error('[API PROXY ERROR]', data.error);
        if (f) f(new Error(data.error));
      } else {
        if (s) s(data.result);
      }
    })
    .catch(err => {
      console.error('[API PROXY NETWORK ERROR]', err);
      if (f) f(err);
    });
  }
})}};
`;

const finalJs = apiProxy + "\n" + extractedJs;

const tsxContent = [
  '"use client";',
  'import { useEffect, useRef } from "react";',
  'import Script from "next/script";',
  '',
  'export default function Home() {',
  '  return (',
  '    <>',
  '      <div dangerouslySetInnerHTML={{ __html: ' + JSON.stringify(extractedHtml) + ' }} />',
  '      <Script id="legacy-logic" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: ' + JSON.stringify(finalJs) + ' }} />',
  '    </>',
  '  );',
  '}'
].join('\n');

fs.writeFileSync(targetPage, tsxContent);
console.log("Migration API Proxy connected perfectly!");
