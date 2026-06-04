const { fork } = require('child_process');
const p = fork('dist-electron/win-unpacked/resources/server/dist/server/src/index.js', [], { env: { ...process.env, PORT: '0' } });
p.on('message', m => console.log('GOT MSG:', m));
p.on('error', e => console.log('ERR:', e));
p.on('exit', c => console.log('EXIT:', c));
setTimeout(() => p.kill(), 5000);
