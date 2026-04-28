import { json } from '@sveltejs/kit';
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from '$env/static/private';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { amount, receipt } = body;

		if (!amount) {
			return json({ error: 'Amount is required' }, { status: 400 });
		}

		// Amount in subunit (paise). Example: 50.00 INR = 5000 paise.
		// So we multiply the amount by 100.
		const amountInPaise = Math.round(amount * 100);

		const authBuffer = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

		const response = await fetch('https://api.razorpay.com/v1/orders', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${authBuffer}`
			},
			body: JSON.stringify({
				amount: amountInPaise,
				currency: 'INR',
				receipt: receipt || `rcpt_${Date.now()}`,
				payment_capture: 1 // Auto capture
			})
		});

		const data = await response.json();

		if (!response.ok) {
			console.error('[Razorpay Order Error]', data);
			return json({ error: data.error?.description || 'Failed to create order' }, { status: response.status });
		}

		return json({
			orderId: data.id,
			amount: data.amount,
			currency: data.currency
		});
	} catch (error: any) {
		console.error('[Razorpay Exception]', error);
		return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}
