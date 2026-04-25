const http = require('http');

const data = JSON.stringify({
  amount: 100,
  type: "income",
  description: "Test income",
  category: "زكاة مال",
  donorName: "متبرع تجريبي",
  transactionDate: new Date().toISOString(),
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/treasury',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${responseBody}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
