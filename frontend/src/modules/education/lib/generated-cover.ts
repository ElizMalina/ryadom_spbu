import type { MaterialPreview } from '../model/types';

/** Stable public cover URL, generated for any article missing a custom image. */
export function generatedCoverUrl(article: Pick<MaterialPreview, 'title' | 'summary' | 'category'>): string {
  const query = new URLSearchParams({
    title: article.title.slice(0, 150),
    topic: article.category.name.slice(0, 70),
    summary: article.summary.slice(0, 180),
  });
  return `/api/article-cover?${query.toString()}`;
}

/** Вся цветовая окружность 0–359°, а не четыре фиксированные темы. */
export const COVER_MOTIF_COUNT = 20;
export const COVER_COLOR_SCHEMES = 6;

function makePalette(seed: number, key: string) {
  const hue = hash(`hue:${key}`) % 360;
  const complement = (hue + 155 + seed % 50) % 360;
  const scheme = hash(`scheme:${key}`) % COVER_COLOR_SCHEMES;
  // HEX совместим с SVG-рендерерами и браузерами, включая старые WebKit.
  const hsl = (h: number, saturation: number, lightness: number): string => {
    const s = saturation / 100;
    const l = lightness / 100;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number): string => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  };
  switch (scheme) {
    case 0: return { bg: hsl(hue, 54, 91), accent: hsl(hue, 51, 24), soft: hsl(complement, 51, 72) }; // пастель
    case 1: return { bg: hsl(hue, 66, 82), accent: hsl(hue, 66, 22), soft: hsl(complement, 60, 60) }; // яркий светлый
    case 2: {
      const bg = hsl(hue, 70, 41);
      // У ярко-жёлтого, зелёного и бирюзового фона белый текст не контрастен.
      const channel = (i: number) => {
        const v = parseInt(bg.slice(i, i + 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
      return { bg, accent: (1.05 / (luminance + 0.05)) >= 4.5 ? '#ffffff' : '#000000', soft: hsl(complement, 72, 65) };
    } // насыщенный цвет
    case 3: return { bg: hsl(hue, 36, 18), accent: '#ffffff', soft: hsl(complement, 47, 41) }; // тёмный
    case 4: return { bg: hsl(hue, 34, 95), accent: hsl(complement, 55, 26), soft: hsl(hue, 56, 72) }; // почти белый
    default: return { bg: hsl(hue, 34, 73), accent: hsl(hue, 58, 19), soft: hsl(complement, 40, 55) }; // приглушённый
  }
}

/** Самодостаточные SVG-орнаменты, формируются только из доверенной разметки. */
function makeMotif(index: number, color: string, soft: string): string {
  const common = `fill="none" stroke="${color}" stroke-linecap="round"`;
  switch (index) {
    case 0: return `<g ${common} opacity=".55" stroke-width="12"><path d="M785 110 C875 215 1000 55 1205 175"/><path d="M785 285 C900 390 1025 225 1210 345"/><path d="M785 470 C920 555 1030 390 1200 510"/></g>`;
    case 1: return `<g ${common} opacity=".56" stroke-width="10"><circle cx="1050" cy="340" r="220"/><circle cx="1050" cy="340" r="170"/><circle cx="1050" cy="340" r="110"/><circle cx="1050" cy="340" r="48"/></g>`;
    case 2: return `<g ${common} opacity=".63" stroke-width="12"><path d="M820 510 V170 H1120 V510"/><path d="M885 220 H1050 M885 275 H1050 M885 330 H1030"/><path d="M1130 520 Q1190 375 1240 500"/></g>`;
    case 3: return `<g opacity=".48"><path d="M820 480 Q840 170 1010 115 Q1190 90 1230 280 Q1260 500 1030 560 Z" fill="${color}"/><circle cx="1130" cy="230" r="95" fill="${soft}"/></g>`;
    case 4: return `<g ${common} opacity=".58" stroke-width="10"><path d="M870 510 1030 175 1210 510 Z"/><path d="M900 510 1060 260 1180 510 Z"/><path d="M960 510 1075 350 1140 510 Z"/></g>`;
    case 5: return `<g ${common} opacity=".65" stroke-width="6"><path d="M830 340 935 160 1105 250 1200 140 M935 160 965 475 1185 530 1105 250"/></g><g fill="${color}" opacity=".8"><circle cx="830" cy="340" r="15"/><circle cx="935" cy="160" r="20"/><circle cx="1105" cy="250" r="17"/><circle cx="1200" cy="140" r="13"/><circle cx="965" cy="475" r="18"/><circle cx="1185" cy="530" r="21"/></g>`;
    case 6: return `<g opacity=".48" fill="${color}"><rect x="830" y="150" width="95" height="95"/><rect x="1030" y="150" width="95" height="95"/><rect x="930" y="250" width="95" height="95"/><rect x="1130" y="250" width="95" height="95"/><rect x="830" y="350" width="95" height="95"/><rect x="1030" y="350" width="95" height="95"/><rect x="930" y="450" width="95" height="95"/><rect x="1130" y="450" width="95" height="95"/></g>`;
    case 7: return `<g ${common} opacity=".65" stroke-width="10"><path d="M980 565 Q930 380 995 150"/><path d="M980 440 Q850 430 840 320 Q960 300 980 440Z"/><path d="M985 350 Q1130 340 1150 210 Q1020 205 985 350Z"/><path d="M995 250 Q885 220 900 110 Q1000 130 995 250Z"/></g>`;
    case 8: return `<g ${common} opacity=".64" stroke-width="12" stroke-linejoin="round"><path d="M780 490 925 255 1030 400 1120 220 1260 490"/><path d="M795 555 945 375 1050 475 1160 325 1250 480"/></g>`;
    case 9: return `<g ${common} opacity=".65" stroke-width="13" stroke-linejoin="round"><path d="M790 180 865 290 940 180 1015 290 1090 180 1165 290 1240 180"/><path d="M790 330 865 440 940 330 1015 440 1090 330 1165 440 1240 330"/></g>`;
    case 10: return `<g ${common} opacity=".45" stroke-width="24"><path d="M860 110 1120 630 M950 70 1210 590 M780 225 1020 665 M1080 40 1270 430"/></g>`;
    case 11: return `<g fill="${color}" opacity=".43">${Array.from({length: 7}, (_, row) => Array.from({length: 6}, (_, col) => `<circle cx="${810+col*75}" cy="${155+row*72}" r="${(row+col)%3===0?15:9}"/>`).join('')).join('')}</g>`;
    case 12: return `<g ${common} opacity=".62" stroke-width="10"><rect x="810" y="120" width="390" height="390"/><rect x="865" y="175" width="280" height="280"/><rect x="920" y="230" width="170" height="170"/><rect x="970" y="280" width="70" height="70"/></g>`;
    case 13: return `<g ${common} opacity=".6" stroke-width="10"><ellipse cx="1020" cy="260" rx="110" ry="210"/><ellipse cx="1020" cy="260" rx="110" ry="210" transform="rotate(60 1020 260)"/><ellipse cx="1020" cy="260" rx="110" ry="210" transform="rotate(120 1020 260)"/></g>`;
    case 14: return `<g ${common} opacity=".65" stroke-width="13">${Array.from({length: 12},(_,i)=>`<path d="M1050 335 L${Math.round(1050+290*Math.cos(i*Math.PI/6))} ${Math.round(335+290*Math.sin(i*Math.PI/6))}"/>`).join('')}</g><circle cx="1050" cy="335" r="92" fill="${soft}" opacity=".85"/>`;
    case 15: return `<g ${common} opacity=".6" stroke-width="9"><path d="M810 540 C730 380 930 180 1060 235 S1170 490 1250 140"/><path d="M830 580 C740 400 915 235 1060 290 S1170 515 1230 195"/><path d="M850 620 C760 430 915 295 1060 345 S1175 550 1210 255"/></g>`;
    case 16: return `<g ${common} opacity=".58" stroke-width="12"><path d="M810 520 A270 270 0 0 1 1210 160"/><path d="M840 520 A218 218 0 0 1 1190 215"/><path d="M870 520 A165 165 0 0 1 1160 270"/><path d="M900 520 A110 110 0 0 1 1130 340"/></g>`;
    case 17: return `<g opacity=".52" fill="${color}"><rect x="805" y="350" width="70" height="240"/><rect x="885" y="260" width="85" height="330"/><rect x="980" y="385" width="70" height="205"/><rect x="1060" y="175" width="90" height="415"/><rect x="1160" y="315" width="65" height="275"/></g>`;
    case 18: return `<g ${common} opacity=".67" stroke-width="11"><path d="M830 200 L830 500 Q930 455 1035 500 L1035 200 Q935 160 830 200Z"/><path d="M1035 500 Q1135 455 1230 500 V200 Q1130 160 1035 200Z"/><path d="M1035 215 V510"/></g>`;
    default: return `<g ${common} opacity=".66" stroke-width="12"><path d="M1050 310 C1140 300 1190 370 1150 450 C1110 530 940 515 880 425 C785 275 905 135 1055 135 C1230 135 1275 285 1230 365"/></g>`;
  }
}

function hash(text: string): number {
  let result = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    result ^= text.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function safeText(value: string, maximum: number): string {
  return value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapTitle(text: string, maxLen = 23, maxLines = 3): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxLen) { lines.push(line); line = ''; }
    if (lines.length >= maxLines) break;
    if (word.length > maxLen && !line) {
      lines.push(word.slice(0, maxLen - 1) + '…');
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (!lines.length) lines.push('Материал');
  if (lines.length === maxLines && text.length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/…?$/, '…');
  }
  return lines;
}

/** Render server-side editorial SVG artwork; never executes user-authored markup. */
export function generateArticleCover(titleValue: string, topicValue = '', summaryValue = ''): string {
  const title = safeText(titleValue, 150) || 'Психопросвет';
  const topic = safeText(topicValue, 70) || 'Психопросвет';
  const summary = safeText(summaryValue, 180);
  const seed = hash(`${title}|${topic}|${summary}`);
  // Отдельные хеши исключают корреляцию цвета и рисунка.
  const palette = makePalette(seed, `${title}|${topic}|${summary}`);
  const motif = hash(`motif:${title}|${topic}|${summary}`) % COVER_MOTIF_COUNT;
  const art = makeMotif(motif, palette.accent, palette.soft);
  const lines = wrapTitle(title);
  const startY = 288 - (lines.length - 1) * 26;
  const textLines = lines.map((line, i) => `<tspan x="75" y="${startY + i * 68}">${escapeXml(line)}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="Обложка статьи: ${escapeXml(title)}">
    <rect width="1280" height="720" fill="${palette.bg}"/>
    <circle cx="1150" cy="75" r="345" fill="${palette.soft}" opacity=".54"/>
    <circle cx="1150" cy="655" r="240" fill="${palette.soft}" opacity=".36"/>
    <g data-motif="${motif}">${art}</g>
    <rect x="60" y="55" width="595" height="585" fill="${palette.bg}" opacity=".70"/>
    <text x="75" y="122" font-family="Arial,Helvetica,sans-serif" fill="${palette.accent}" font-size="28" font-weight="700">${escapeXml(topic)}</text>
    <text font-family="Arial,Helvetica,sans-serif" fill="${palette.accent}" font-size="64" font-weight="700">${textLines}</text>
    <rect x="75" y="630" width="125" height="7" fill="${palette.accent}"/>
  </svg>`;
}
