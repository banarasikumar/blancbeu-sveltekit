import { json } from '@sveltejs/kit';
import { RAZORPAY_KEY_SECRET } from '$env/static/private';
import crypto from 'crypto';

export async function POST({ request }) {
	try {
		const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

		if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const body = razorpay_order_id + '|' + razorpay_payment_id;

		const expectedSignature = crypto
			.createHmac('sha256', RAZORPAY_KEY_SECRET)
			.update(body.toString())
			.digest('hex');

		if (expectedSignature === razorpay_signature) {
			return json({ success: true });
		} else {
			return json({ error: 'Invalid signature' }, { status: 400 });
		}
	} catch (error: any) {
		console.error('[Razorpay Verify Exception]', error);
		return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}
