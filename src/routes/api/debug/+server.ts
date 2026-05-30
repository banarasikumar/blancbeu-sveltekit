import { json } from '@sveltejs/kit';
import fs from 'fs';

export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        const logLine = `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`;
        fs.appendFileSync('debug.log', logLine);
        return json({ success: true });
    } catch (err) {
        console.error(err);
        return json({ error: 'Failed' }, { status: 400 });
    }
};
