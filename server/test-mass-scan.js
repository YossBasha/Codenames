const http = require('http');

async function testMassScan() {
  const baseIp = '192.168.8.';
  let found = false;

  for (let i = 1; i <= 254; i++) {
    const targetIp = baseIp + i;
    const req = http.get(`http://${targetIp}:3000/api/discovery/hosting`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('hosting')) {
          console.log(`FOUND IT ON ${targetIp}:`, data);
          found = true;
        }
      });
    });
    
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
  }

  setTimeout(() => {
    if (!found) console.log('Mass scan FAILED to find the phone! Windows likely dropped the packets.');
  }, 2000);
}

testMassScan();
