import fs from 'fs';
import path from 'path';
import https from 'https';

const staticFontsDir = 'c:/Users/banar/Desktop/AGY/NewBlancbeu/SvelteBlancbeu/static/fonts';

const fonts = {
    'Montserrat-Regular.ttf': 'https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf',
    'Montserrat-Bold.ttf': 'https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Bold.ttf'
};

async function downloadFont(filename, url) {
    const dest = path.join(staticFontsDir, filename);
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return downloadFont(filename, res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(dest);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Downloaded ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    console.log('Downloading Montserrat fonts...');
    for (const [filename, url] of Object.entries(fonts)) {
        try {
            await downloadFont(filename, url);
        } catch (e) {
            console.error(e);
        }
    }
    console.log('Done!');
}

main();
