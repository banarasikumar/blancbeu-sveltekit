import { Client } from '@gradio/client';

async function check() {
	try {
		const client = await Client.connect('banz3949/BlancbeuVirtualTryOn');
		console.log('Config:', JSON.stringify(client.config, null, 2));
	} catch (e) {
		console.error(e);
	}
}

check();
