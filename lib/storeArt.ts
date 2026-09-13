import sharp from "sharp";

const configs: Record<string,{accent:string; accent2:string; symbol:string; motif:string}> = {
  "mobile-legends": {accent:"#8B5CF6",accent2:"#22D3EE",symbol:"◆",motif:"crystal"},
  playstation: {accent:"#2563EB",accent2:"#60A5FA",symbol:"PS",motif:"waves"},
  xbox: {accent:"#16A34A",accent2:"#86EFAC",symbol:"X",motif:"cross"},
  minecraft: {accent:"#22C55E",accent2:"#A3E635",symbol:"▦",motif:"blocks"},
  roblox: {accent:"#8B5CF6",accent2:"#F472B6",symbol:"◇",motif:"blocks"},
  valorant: {accent:"#DC2626",accent2:"#FB7185",symbol:"V",motif:"slashes"},
  steam: {accent:"#2563EB",accent2:"#93C5FD",symbol:"●",motif:"rings"}
};

function motif(kind:string, accent:string, accent2:string){
  if(kind==="rings") return \`
    <circle cx="310" cy="330" r="150" fill="none" stroke="\${accent2}" stroke-width="18" opacity=".75"/>
    <circle cx="310" cy="330" r="64" fill="#080A10" stroke="#fff" stroke-width="14"/>
    <path d="M160 455 L260 365" stroke="#fff" stroke-width="30" stroke-linecap="round"/>
    <circle cx="145" cy="470" r="48" fill="#080A10" stroke="\${accent2}" stroke-width="12"/>\`;
  if(kind==="blocks") return \`
    <g transform="translate(88 155)">
      <rect x="0" y="110" width="150" height="150" rx="18" fill="\${accent}" opacity=".8"/>
      <rect x="155" y="0" width="150" height="150" rx="18" fill="\${accent2}" opacity=".7"/>
      <rect x="315" y="135" width="135" height="135" rx="18" fill="#fff" opacity=".16"/>
      <path d="M25 165 H125 M75 115 V215 M190 55 H270 M230 20 V95" stroke="#fff" stroke-width="14" opacity=".75"/>
    </g>\`;
  if(kind==="slashes") return \`
    <path d="M120 175 L275 520 L350 520 L205 210 Z" fill="\${accent}" opacity=".88"/>
    <path d="M505 175 L350 520 L275 520 L420 210 Z" fill="\${accent2}" opacity=".88"/>
    <path d="M220 290 L312 455 L405 290" fill="none" stroke="#fff" stroke-width="18" opacity=".8"/>\`;
  if(kind==="cross") return \`
    <circle cx="312" cy="340" r="180" fill="#08100A" stroke="\${accent2}" stroke-width="12"/>
    <path d="M180 210 Q312 145 445 210 Q365 245 312 305 Q258 245 180 210 Z" fill="\${accent2}"/>
    <path d="M180 465 Q235 355 312 305 Q390 355 445 465" fill="none" stroke="\${accent2}" stroke-width="26" stroke-linecap="round"/>\`;
  if(kind==="waves") return \`
    <path d="M135 220 H290 V375 H135 Z" fill="none" stroke="#fff" stroke-width="20"/>
    <circle cx="445" cy="295" r="78" fill="none" stroke="\${accent2}" stroke-width="20"/>
    <path d="M170 500 L235 390 L300 500 Z M375 405 L485 515 M485 405 L375 515" fill="none" stroke="#fff" stroke-width="18"/>\`;
  return \`
    <path d="M312 135 L500 320 L312 545 L124 320 Z" fill="#0B0812" stroke="\${accent}" stroke-width="16"/>
    <path d="M312 135 L382 320 L312 545 L242 320 Z" fill="\${accent}" opacity=".32"/>
    <path d="M124 320 H500 M242 320 L312 135 L382 320" stroke="#fff" stroke-width="12" opacity=".72"/>\`;
}

function posterSvg(name:string){
  const c=configs[name] || configs["mobile-legends"];
  return \`<svg width="640" height="820" viewBox="0 0 640 820" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="\${c.accent}" stop-opacity=".52"/>
      <stop offset=".45" stop-color="#111326" stop-opacity=".94"/>
      <stop offset="1" stop-color="#05060B"/>
    </radialGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="\${c.accent2}"/><stop offset="1" stop-color="\${c.accent}"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#fff" stroke-opacity=".035"/></pattern>
  </defs>
  <rect width="640" height="820" fill="url(#bg)"/>
  <rect width="640" height="820" fill="url(#grid)"/>
  <circle cx="320" cy="335" r="250" fill="\${c.accent}" opacity=".10" filter="url(#glow)"/>
  <path d="M-40 690 C120 520 230 720 410 555 C505 468 585 470 700 390" fill="none" stroke="\${c.accent2}" stroke-width="5" opacity=".45"/>
  <g filter="url(#glow)">\${motif(c.motif,c.accent,c.accent2)}</g>
  <g opacity=".22"><circle cx="320" cy="340" r="238" fill="none" stroke="#fff"/><circle cx="320" cy="340" r="275" fill="none" stroke="\${c.accent2}" stroke-dasharray="5 15"/></g>
  <rect x="24" y="24" width="592" height="772" rx="26" fill="none" stroke="#fff" stroke-opacity=".08"/>
  <path d="M48 90 H175" stroke="\${c.accent2}" stroke-width="4"/>
  <circle cx="48" cy="90" r="5" fill="#22C55E"/>
  </svg>\`;
}

function heroSvg(){
 return \`<svg width="1500" height="720" viewBox="0 0 1500 720" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#05060B"/><stop offset=".48" stop-color="#080713"/><stop offset="1" stop-color="#14072B"/></linearGradient>
  <radialGradient id="orb" cx="75%" cy="45%" r="45%"><stop stop-color="#8B5CF6" stop-opacity=".75"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient>
  <linearGradient id="armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D8B4FE"/><stop offset=".45" stop-color="#7C3AED"/><stop offset="1" stop-color="#22D3EE"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 </defs>
 <rect width="1500" height="720" fill="url(#bg)"/><rect width="1500" height="720" fill="url(#orb)"/>
 <g transform="translate(790 10)">
   <path d="M330 35 C230 25 155 92 140 190 C124 285 173 322 188 377 C207 447 150 520 109 690 H650 C624 535 561 449 586 354 C611 258 556 109 454 56 C415 36 371 29 330 35Z" fill="#090711"/>
   <path d="M230 160 C265 92 362 70 438 102 C503 129 533 198 507 259 C474 337 387 355 316 327 C235 295 199 221 230 160Z" fill="url(#armor)" opacity=".48"/>
   <path d="M277 105 C327 56 447 56 506 139 C453 108 398 121 350 162 C325 184 306 216 286 255 C250 226 237 145 277 105Z" fill="#D8CCFF" opacity=".82"/>
   <path d="M235 169 C206 130 193 82 222 43 C257 77 283 93 320 100 C273 110 249 133 235 169Z" fill="#B494FF"/>
   <path d="M485 161 C538 101 566 55 552 14 C608 49 634 120 601 196 C574 260 526 287 480 304 C515 253 518 205 485 161Z" fill="#5B21B6"/>
   <path d="M267 320 C355 381 480 351 533 284 C568 365 593 484 650 690 H109 C148 533 192 411 267 320Z" fill="#11101A" stroke="#7C3AED" stroke-width="10"/>
   <path d="M169 516 L343 409 L506 530 L434 689 H201Z" fill="#171125" stroke="url(#armor)" stroke-width="10"/>
   <path d="M80 560 L239 456 M511 454 L688 563" stroke="#8B5CF6" stroke-width="15" filter="url(#glow)"/>
   <path d="M337 179 L390 168" stroke="#F0ABFC" stroke-width="9" stroke-linecap="round" filter="url(#glow)"/>
   <circle cx="364" cy="174" r="5" fill="#fff"/>
 </g>
 <g opacity=".22" filter="url(#glow)">
   <path d="M780 90 L1060 300 L840 600" fill="none" stroke="#8B5CF6" stroke-width="26"/>
   <path d="M820 130 L1100 340 L880 640" fill="none" stroke="#22D3EE" stroke-width="6"/>
 </g>
 </svg>\`;
}

function communitySvg(){
 return \`<svg width="1500" height="360" viewBox="0 0 1500 360" xmlns="http://www.w3.org/2000/svg">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#12052C"/><stop offset=".55" stop-color="#0B0A20"/><stop offset="1" stop-color="#1F0750"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
 <rect width="1500" height="360" rx="30" fill="url(#bg)"/>
 <g transform="translate(860 25)" filter="url(#g)">
  <circle cx="230" cy="175" r="130" fill="#0B0C19" stroke="#7C3AED" stroke-width="10"/>
  <rect x="135" y="105" width="190" height="145" rx="58" fill="#141529" stroke="#8B5CF6" stroke-width="8"/>
  <ellipse cx="190" cy="165" rx="22" ry="34" fill="#67E8F9"/>
  <ellipse cx="270" cy="165" rx="22" ry="34" fill="#C084FC"/>
  <path d="M160 265 C210 300 257 300 306 265" fill="none" stroke="#8B5CF6" stroke-width="9" stroke-linecap="round"/>
  <path d="M108 245 L50 320 M350 242 L420 315" stroke="#8B5CF6" stroke-width="18" stroke-linecap="round"/>
 </g>
 <g opacity=".32"><path d="M0 320 C250 210 390 330 620 175 C780 70 920 115 1500 20" fill="none" stroke="#7C3AED" stroke-width="3"/><path d="M0 300 C260 190 410 300 650 150 C810 55 1000 80 1500 5" fill="none" stroke="#22D3EE" stroke-width="2"/></g>
 </svg>\`;
}

export async function artResponse(kind:string){
  const svg = kind==="hero" ? heroSvg() : kind==="community" ? communitySvg() : posterSvg(kind);
  const jpeg = await sharp(Buffer.from(svg)).jpeg({quality:94,progressive:true,chromaSubsampling:"4:4:4"}).toBuffer();
  return new Response(new Uint8Array(jpeg),{headers:{"Content-Type":"image/jpeg","Cache-Control":"public, max-age=31536000, immutable"}});
}
