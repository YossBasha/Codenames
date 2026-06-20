const fs = require('fs');
const content = fs.readFileSync('src/assets/specialAvatar.ts', 'utf8');
const b64 = content.split('base64,')[1].replace('";', '').trim();
fs.writeFileSync('public/yoss.png', b64, 'base64');
