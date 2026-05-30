const http = require('http');

const data = JSON.stringify({
  message: 'Can you do a dance for me?',
  context: { salonPhone: '', emotion: 'Neutral' }
});

const req = http.request({
  hostname: 'localhost',
  port: 5173,
  path: '/api/companion',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    process.stdout.write(chunk.toString());
  });
  
  res.on('end', () => {
    console.log('\nNo more data in response.');
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
