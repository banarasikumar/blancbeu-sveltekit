import http from 'http';

http.get('http://localhost:5173/migrate-services?t=' + Date.now(), (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (data.includes('Migration Complete')) {
            console.log('SUCCESS: ' + data.substring(data.indexOf('Migration Complete'), data.indexOf('Migration Complete') + 100));
        } else {
            console.log('FAILED to find success message');
        }
    });
}).on('error', (err) => {
    console.log('Error: ' + err.message);
});
