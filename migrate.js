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

// Enforce exact 5 digits for Admin ID
extractedHtml = extractedHtml.replace(/id="admin-id"[^>]*>/i, match => {
  return match.replace(/maxlength="5"/i, 'minlength="5" maxlength="5" pattern="[0-9]{5}"');
});

// Enforce exact 8 digits for Verifier and Player fields
extractedHtml = extractedHtml.replace(/id="ver-regno"[^>]*>/i, match => {
  return match.replace(/pattern="\[0-9\]\{5,8\}"/i, 'pattern="[0-9]{8}" minlength="8"');
});
extractedHtml = extractedHtml.replace(/id="profile-regno"[^>]*>/i, match => {
  return match.replace(/pattern="\[0-9\]\{5,8\}"/i, 'pattern="[0-9]{8}" minlength="8"');
});

// In case att-regno and manual-regno just have maxlength="8", we upgrade them too
extractedHtml = extractedHtml.replace(/id="att-regno"[^>]*>/i, match => {
  if (match.includes('pattern="[0-9]{5,8}"')) return match.replace(/pattern="\[0-9\]\{5,8\}"/i, 'pattern="[0-9]{8}" minlength="8"');
  if (!match.includes('minlength="8"')) return match.replace(/maxlength="8"/i, 'minlength="8" maxlength="8" pattern="[0-9]{8}"');
  return match;
});
extractedHtml = extractedHtml.replace(/id="manual-regno"[^>]*>/i, match => {
  if (!match.includes('minlength="8"')) return match.replace(/maxlength="8"/i, 'minlength="8" maxlength="8" pattern="[0-9]{8}"');
  return match;
});

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
