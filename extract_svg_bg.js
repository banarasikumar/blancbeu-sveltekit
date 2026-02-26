import fs from 'fs';

const svgPath = 'c:/Users/banar/Desktop/AGY/NewBlancbeu/SvelteBlancbeu/my aseestes/invoice/6675525.svg';
const lines = fs.readFileSync(svgPath, 'utf8').split('\n');

// Line-based removal (1-indexed in the SVG file):
// Lines 247-250: Pink table-row rects and grid overlay rect inside OBJECTS
// Lines 503-563: The entire <g id="TEXTS"> group with all placeholder text, ring logo etc.

const filtered = lines.filter((_, i) => {
    const lineNum = i + 1;
    // Remove table background rects
    if (lineNum >= 247 && lineNum <= 250) return false;
    // Remove entire TEXTS group
    if (lineNum >= 503 && lineNum <= 563) return false;
    return true;
});

let result = filtered.join('\n');

// Crop viewBox to the actual content area (removes white padding/margins)
// Original: viewBox="0 0 768.5 1004.43" → content rect starts at (81.22, 72.65) size (612.28, 858.9)
result = result.replace('viewBox="0 0 768.5 1004.43"', 'viewBox="81.22 72.65 612.28 858.9"');

fs.writeFileSync('c:/Users/banar/Desktop/AGY/NewBlancbeu/SvelteBlancbeu/static/invoice-bg-vector.svg', result);
console.log('✅ Clean SVG written (cropped viewBox, removed TEXTS + table rects)');
console.log(`   Original lines: ${lines.length}, Output lines: ${filtered.length}`);
