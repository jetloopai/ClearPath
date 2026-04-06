const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/RAPIDAPI_ZILLOW_KEY=(.*)/)[1].trim();

const options = {
  hostname: 'zillow-scraper-api.p.rapidapi.com',
  path: '/zillow/search/by-coordinates?lat=41.8781&lng=-87.6298&radius=1&page=1&home_type=house',
  method: 'GET',
  headers: {
    'x-rapidapi-key': key,
    'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA_LEN:', data.length, 'SNIPPET:', data.substring(0, 500)));
});
req.on('error', e => console.error(e));
req.end();
