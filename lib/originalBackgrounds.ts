import sharp from "sharp";

function defs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#06070B"/>
      <stop offset=".55" stop-color="#0A0813"/>
      <stop offset="1" stop-color="#160A2B"/>
    </linearGradient>
    <radialGradient id="purpleGlow" cx="72%" cy="45%" r="46%">
      <stop stop-color="#7C3AED" stop-opacity=".65"/>
      <stop offset=".55" stop-color="#7C3AED" stop-opacity=".12"/>
      <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#1A1630" stop-opacity=".96"/>
      <stop offset="1" stop-color="#0B0D15" stop-opacity=".96"/>
    </linearGradient>
    <linearGradient id="violet" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#8B5CF6"/><stop offset="1" stop-color="#B14CFF"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="24"/></filter>
  </defs>`;
}

function productCard(x:number,y:number,w:number,h:number,title:string,subtitle:string,accent:string){
  return `
  <g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="18" fill="#0C0E16" stroke="#ffffff" stroke-opacity=".10"/>
    <rect x="8" y="8" width="${w-16}" height="${Math.round(h*.65)}" rx="13" fill="${accent}" opacity=".16"/>
    <circle cx="${w/2}" cy="${Math.round(h*.34)}" r="${Math.round(Math.min(w,h)*.18)}" fill="${accent}" opacity=".70" filter="url(#glow)"/>
    <path d="M${w*.34} ${h*.34} L${w*.50} ${h*.20} L${w*.66} ${h*.34} L${w*.50} ${h*.48} Z" fill="#fff" opacity=".88"/>
    <text x="${w/2}" y="${h*.77}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(w*.105)}" font-weight="700" fill="#fff">${title}</text>
    <text x="${w/2}" y="${h*.88}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(w*.065)}" fill="#8B91A3">${subtitle}</text>
  </g>`;
}

function homeSvg(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
    ${defs()}
    <rect width="1400" height="900" fill="url(#bg)"/>
    <rect width="1400" height="900" fill="url(#purpleGlow)"/>
    <circle cx="1060" cy="315" r="260" fill="#7C3AED" opacity=".10" filter="url(#soft)"/>

    <!-- Nexus storefront wall -->
    <rect x="650" y="105" width="590" height="430" rx="30" fill="url(#glass)" stroke="#8B5CF6" stroke-opacity=".22"/>
    <rect x="695" y="145" width="500" height="86" rx="18" fill="#080A10" stroke="#ffffff" stroke-opacity=".08"/>
    <circle cx="748" cy="188" r="28" fill="none" stroke="url(#violet)" stroke-width="8" filter="url(#glow)"/>
    <path d="M735 174 L762 188 L735 202 Z" fill="#B76CFF"/>
    <text x="792" y="184" font-family="Arial,Helvetica,sans-serif" font-size="33" font-weight="800" fill="#fff">NEXUS</text>
    <text x="916" y="184" font-family="Arial,Helvetica,sans-serif" font-size="33" font-weight="800" fill="#A855F7">GAMES</text>
    <text x="795" y="209" font-family="Arial,Helvetica,sans-serif" font-size="12" letter-spacing="4" fill="#81798F">PLAY MORE</text>

    <!-- monitors / desk -->
    <rect x="720" y="575" width="510" height="38" rx="10" fill="#13101F"/>
    <rect x="775" y="345" width="355" height="205" rx="18" fill="#090A11" stroke="#B25CFF" stroke-opacity=".45"/>
    <rect x="792" y="362" width="321" height="171" rx="12" fill="#100B21"/>
    <circle cx="952" cy="445" r="66" fill="#6D28D9" opacity=".18" filter="url(#glow)"/>
    <path d="M915 444 L951 405 L997 445 L951 487 Z" fill="none" stroke="#A855F7" stroke-width="10" filter="url(#glow)"/>
    <rect x="930" y="550" width="45" height="28" fill="#14111D"/>
    <rect x="883" y="578" width="139" height="12" rx="6" fill="#262036"/>

    <!-- controller and store bag -->
    <path d="M704 625 C731 607 782 607 808 625 L830 666 C838 683 818 696 804 684 L777 663 H735 L708 684 C694 696 674 683 682 666 Z" fill="#11131B" stroke="#8B5CF6" stroke-width="5"/>
    <circle cx="730" cy="646" r="8" fill="#8B5CF6"/><circle cx="785" cy="644" r="6" fill="#22D3EE"/>
    <rect x="1118" y="590" width="90" height="105" rx="14" fill="#0F1018" stroke="#8B5CF6" stroke-width="4"/>
    <path d="M1142 592 C1142 560 1184 560 1184 592" fill="none" stroke="#8B5CF6" stroke-width="5"/>
    <text x="1163" y="646" text-anchor="middle" font-family="Arial" font-size="27" font-weight="800" fill="#A855F7">N</text>

    <!-- product shelf -->
    <rect x="650" y="255" width="590" height="68" rx="16" fill="#090A11" stroke="#fff" stroke-opacity=".05"/>
    ${productCard(680,266,72,122,"PS","GIFT","#2563EB")}
    ${productCard(762,266,72,122,"XBOX","PASS","#16A34A")}
    ${productCard(844,266,72,122,"STEAM","WALLET","#2563EB")}
    ${productCard(926,266,72,122,"ML","DIAMONDS","#7C3AED")}
    ${productCard(1008,266,72,122,"RBX","ROBUX","#A855F7")}
    ${productCard(1090,266,72,122,"MC","MINECOINS","#22C55E")}

    <!-- ambience -->
    <path d="M615 740 C820 665 1030 775 1290 650" fill="none" stroke="#7C3AED" stroke-width="4" opacity=".28"/>
    <path d="M640 780 C850 700 1080 805 1330 675" fill="none" stroke="#22D3EE" stroke-width="2" opacity=".20"/>
    <rect x="620" y="90" width="650" height="660" rx="36" fill="none" stroke="#fff" stroke-opacity=".035"/>
  </svg>`;
}

function loginSvg(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
    ${defs()}
    <rect width="1000" height="1200" fill="url(#bg)"/>
    <rect width="1000" height="1200" fill="url(#purpleGlow)"/>
    <circle cx="680" cy="360" r="300" fill="#7C3AED" opacity=".12" filter="url(#soft)"/>

    <!-- digital storefront -->
    <rect x="150" y="125" width="700" height="780" rx="40" fill="url(#glass)" stroke="#8B5CF6" stroke-opacity=".24"/>
    <rect x="205" y="175" width="590" height="120" rx="22" fill="#080A10" stroke="#fff" stroke-opacity=".07"/>
    <circle cx="270" cy="235" r="34" fill="none" stroke="#A855F7" stroke-width="8" filter="url(#glow)"/>
    <path d="M254 219 L288 235 L254 251 Z" fill="#B76CFF"/>
    <text x="330" y="230" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="800" fill="#fff">NEXUS</text>
    <text x="485" y="230" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="800" fill="#A855F7">GAMES</text>
    <text x="332" y="260" font-family="Arial" font-size="13" letter-spacing="5" fill="#7D748D">DIGITAL STORE</text>

    <!-- storefront glass shelves -->
    <rect x="205" y="335" width="590" height="430" rx="26" fill="#090A11" stroke="#fff" stroke-opacity=".06"/>
    <rect x="235" y="378" width="530" height="3" fill="#8B5CF6" opacity=".45"/>
    <rect x="235" y="586" width="530" height="3" fill="#8B5CF6" opacity=".25"/>
    ${productCard(248,400,130,170,"PS","GIFT CARDS","#2563EB")}
    ${productCard(435,400,130,170,"XBOX","GAME PASS","#16A34A")}
    ${productCard(622,400,130,170,"STEAM","WALLET","#2563EB")}
    ${productCard(248,610,130,170,"ML","DIAMONDS","#7C3AED")}
    ${productCard(435,610,130,170,"RBX","ROBUX","#A855F7")}
    ${productCard(622,610,130,170,"MC","MINECOINS","#22C55E")}

    <!-- shopping bag -->
    <rect x="365" y="835" width="270" height="195" rx="25" fill="#0C0D15" stroke="#8B5CF6" stroke-width="5"/>
    <path d="M425 835 C425 760 575 760 575 835" fill="none" stroke="#8B5CF6" stroke-width="8"/>
    <circle cx="500" cy="930" r="45" fill="#7C3AED" opacity=".18" filter="url(#glow)"/>
    <text x="500" y="949" text-anchor="middle" font-family="Arial" font-size="55" font-weight="800" fill="#B76CFF">N</text>
    <text x="500" y="995" text-anchor="middle" font-family="Arial" font-size="13" letter-spacing="4" fill="#8F8AA0">PLAY MORE</text>

    <path d="M120 1090 C335 1005 610 1120 885 1010" fill="none" stroke="#7C3AED" stroke-width="4" opacity=".30"/>
    <path d="M100 1130 C360 1035 625 1145 920 1025" fill="none" stroke="#22D3EE" stroke-width="2" opacity=".18"/>
  </svg>`;
}

export async function originalBackground(kind:"home"|"login"){
  const svg = kind === "login" ? loginSvg() : homeSvg();
  const image = await sharp(Buffer.from(svg)).jpeg({quality:92,progressive:true,chromaSubsampling:"4:4:4"}).toBuffer();
  return new Response(new Uint8Array(image), {
    headers:{
      "Content-Type":"image/jpeg",
      "Cache-Control":"public, max-age=31536000, immutable"
    }
  });
}
