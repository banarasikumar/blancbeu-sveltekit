import fs from 'fs';
import path from 'path';

const servicesFile = 'src/lib/data/services.ts';
const imagesDir = 'static/assets/service_images';

let content = fs.readFileSync(servicesFile, 'utf8');
const files = fs.readdirSync(imagesDir);

const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const fileMap = {};
files.forEach(file => {
    const baseName = file.replace(/_cleaned\.\w+$/, '').replace(/\.\w+$/, '');
    fileMap[normalizeName(baseName)] = file; // map normalized base name to actual filename
});

// also map generic keywords if possible? Let's just do exact normalized match first.

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameMatch = line.match(/name:\s*"([^"]+)"/);
    if (nameMatch) {
        const serviceName = nameMatch[1];
        const normName = normalizeName(serviceName);

        let bestMatch = fileMap[normName];

        if (bestMatch) {
            for (let j = i + 1; j < i + 8 && j < lines.length; j++) {
                if (lines[j].includes('image: getImg(')) {
                    const newImgStr = `        image: getImg("assets/service_images/${bestMatch}"),`;
                    if (lines[j].trim() !== newImgStr.trim()) {
                        console.log(`Mapping ${serviceName} -> ${bestMatch}`);
                        lines[j] = lines[j].replace(/image:\s*getImg\([^)]+\),/, `image: getImg("assets/service_images/${bestMatch}"),`);
                    }
                    break;
                }
            }
        }
    }
}

fs.writeFileSync(servicesFile, lines.join('\n'));
console.log("Done mapping second pass.");
