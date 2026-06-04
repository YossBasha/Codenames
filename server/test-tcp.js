const http = require('http');

function testPort(port) {
  const req = http.get(`http://192.168.8.188:${port}/api/discovery/hosting`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(`Port ${port} Response:`, data));
  });

  req.on('error', err => console.error(`Port ${port} Error:`, err.message));
  req.setTimeout(2000, () => {
    console.log(`Port ${port} Request timed out!`);
    req.destroy();
  });
}

testPort(3000);
testPort(3001);
testPort(3002);
