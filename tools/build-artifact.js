// Сборка однофайловой демо-версии Palmi (без камеры) для публикации артефактом:
//   node tools/build-artifact.js  →  dist/palmi-demo.html
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  if (/<\/script/i.test(code)) throw new Error('В ' + src + ' есть </script>');
  return `<script>/* ${src} */\n${code}\n</script>`;
}).join('\n');
const out = `<title>Palmi</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap">
<style>
:root { color-scheme: light; }
html, body { height: 100%; }
${css}
</style>
<div id="viewport"><div id="stage"></div></div>
<script>window.PALMI_ARTIFACT = true;</script>
${js}
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/palmi-demo.html'), out);
console.log('dist/palmi-demo.html', (out.length / 1024).toFixed(0) + ' КБ');
