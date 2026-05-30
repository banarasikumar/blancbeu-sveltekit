import fs from 'fs';

try {
	const logPath = 'c:\\Users\\banar\\Desktop\\AGY\\blancbeu-sveltekit\\devserver-localhost.log';
	if (fs.existsSync(logPath)) {
		const content = fs.readFileSync(logPath, 'utf16le');
		const lines = content.split('\n');
		console.log(`--- LAST 50 LINES OF LOG (Total lines: ${lines.length}) ---`);
		lines.slice(-50).forEach(l => console.log(l.trim()));
	} else {
		console.log('Log file does not exist');
	}
} catch (e) {
	console.error('Error reading log:', e);
}
