// Converte o design.html (1280x720) no template do componente Hypit.
// Uso: node tools/gen-template.mjs <design.html> <pasta-fonts>
// As fontes viram data: URIs dentro do programa HTML, então o render não depende de rede.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const [designPath, fontsDir] = process.argv.slice(2).map(p => resolve(p));
if (!designPath || !fontsDir) throw new Error("uso: node tools/gen-template.mjs <design.html> <pasta-fonts>");
const page = readFileSync(designPath, "utf8");
const between = (a, b) => { const i = page.indexOf(a), j = page.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error(`design.html sem ${a}`); return page.slice(i + a.length, j); };

// O design.html segue as convenções do design-starter.html; estas trocas exigem os trechos exatos.
let css = between("<style>", "</style>");
const swap = (from, to) => { if (!css.includes(from)) throw new Error(`CSS precisa conter: ${from}`); css = css.replace(from, to); };
swap(":root{", ":scope{");
swap("html,body{width:1280px;height:720px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--body)}",
  ":scope{overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--body)}");
const html = between("<body>", "<script>").trim();
let js = between("<script>", "</script>");
const jswap = (from, to) => { if (!js.includes(from)) throw new Error(`JS precisa conter: ${from}`); js = js.replace(from, to); };
jswap("const TLd=window.TL, S={};", "const TLd=data.TL, S={};");
jswap("window.renderAt=function(t){", "function renderAt(t){");
jswap("window.READY=document.fonts.ready.then(()=>true);",
  "['800 40px Archivo','700 40px Archivo','600 20px \"Source Sans 3\"','400 20px \"Source Sans 3\"','500 16px \"JetBrains Mono\"'].forEach(f=>{try{document.fonts.load(f)}catch(e){}});");
js += `
const stage=document.getElementById('stage');
stage.style.transformOrigin='0 0';
stage.style.transform='scale('+data.scale+')';
return frame=>renderAt(frame/data.fps);
`;
let fonts = readFileSync(join(fontsDir, "fonts.css"), "utf8");
fonts = fonts.replace(/url\((f\d+\.woff2)\)/g, (_, file) =>
  `url(data:font/woff2;base64,${readFileSync(join(fontsDir, file)).toString("base64")})`);
writeFileSync(join(project, "packages", "scenes", "src", "template.generated.ts"),
  `// Gerado por tools/gen-template.mjs a partir do design.html. Não edite à mão.
export const FONT_CSS = ${JSON.stringify(fonts)};
export const HTML = ${JSON.stringify(html)};
export const CSS = ${JSON.stringify(css)};
export const SETUP = ${JSON.stringify(js)};
`);
console.log(`template: html ${html.length} b, css ${css.length} b, setup ${js.length} b, fontes ${fonts.length} b`);
