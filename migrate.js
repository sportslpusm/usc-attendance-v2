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

const mockObject = `
window.google = { script: { run: new Proxy({}, {
  get: (target, prop) => (...args) => {
    console.log('[MOCK GAS]', prop, args);
    let s = null, f = null;
    const chain = {
       withSuccessHandler: h => { s = h; return chain; },
       withFailureHandler: h => { f = h; return chain; }
    };
    if (prop === 'withSuccessHandler' || prop === 'withFailureHandler') return chain[prop](args[0]);
    setTimeout(() => {
       let res = { success: true };
       if(prop === 'getActiveEvents') res = [{name:'Mock Event', eventCode:'EVT123'}];
       if(prop === 'getPublicVolunteerProfile') res = {success: true, name: 'Student Vol', regNo: args[0], totalHours: 12, totalEvents: 3, totalDays: 4, joinedDate: '2024-01-01', rank: 5};
       if(prop === 'getPublicLeaderboard') res = {success: true, leaders: [{name: 'Lebron', regNo:'12345678', rank:1, totalHours:100}]};
       if(prop === 'getAdminSession') res = {success: true, eventName: '__ADMIN_ONLY__'};
       
       if(s) s(res);
    }, 500);
  }
})}};
`;

const finalJs = mockObject + "\n" + extractedJs;

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
console.log("Migration perfect!");
