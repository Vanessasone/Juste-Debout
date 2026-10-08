const fs = require('node:fs');
const path = require('node:path');
const output = process.argv[2] || 'dist';
const file = path.join(output, 'index.html');
let html = fs.readFileSync(file, 'utf8');
if (!html.includes('</head>')) throw new Error('Exported HTML head missing');
const metadata = [
  '<meta name="description" content="La communauté Juste Debout : événements, billetterie et billets sur ton téléphone.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="Juste Debout">',
  '<meta property="og:title" content="Juste Debout">',
  '<meta property="og:description" content="Événements, billetterie et billets sur ton téléphone.">',
  '<meta property="og:url" content="https://justedeboutapp.com/">',
  '<meta property="og:image" content="https://justedeboutapp.com/app-icon.png?v=20261008">',
  '<meta property="og:image:secure_url" content="https://justedeboutapp.com/app-icon.png?v=20261008">',
  '<meta property="og:image:type" content="image/png">',
  '<meta property="og:image:width" content="512">',
  '<meta property="og:image:height" content="512">',
  '<meta property="og:image:alt" content="Wavetruv Juste Debout">',
  '<meta name="twitter:card" content="summary">',
  '<meta name="twitter:title" content="Juste Debout">',
  '<meta name="twitter:description" content="Événements, billetterie et billets sur ton téléphone.">',
  '<meta name="twitter:image" content="https://justedeboutapp.com/app-icon.png?v=20261008">'
].join('\n');
html = html.replace('</head>', metadata + '\n</head>');
fs.writeFileSync(file, html);
console.log('Static share metadata added.');
