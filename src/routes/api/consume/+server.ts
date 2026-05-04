import { json, type RequestHandler } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export const GET: RequestHandler = async ({ url }) => {
	return handleConsume(url, url.searchParams.get('token'));
};

export const POST: RequestHandler = async ({ request, url }) => {
	let token;
	try {
		const body = await request.json();
		token = body.token;
	} catch {
		// handle
	}
	return handleConsume(url, token);
};

async function handleConsume(url: URL, token: string | null | undefined) {
	const host = url.host;
	const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');

	const getLoginUrl = (appType?: string) => {
		if (appType === 'staff')
			return isLocalHost ? '/staff/login' : 'https://staff.blancbeu.in/login';
		if (appType === 'admin')
			return isLocalHost ? '/admin/login' : 'https://admin.blancbeu.in/login';
		return isLocalHost ? '/login' : 'https://www.blancbeu.in/login';
	};

	const renderErrorPage = (title: string, message: string, appType?: string) => {
		const loginUrl = getLoginUrl(appType);
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
        body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #09090b 0%, #18181b 100%);
            font-family: 'Inter', sans-serif;
            color: #ffffff;
        }
        .container {
            background: linear-gradient(145deg, #1f1f22, #121214);
            padding: 40px;
            border-radius: 24px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(212, 175, 55, 0.2);
            position: relative;
            overflow: hidden;
        }
        .glow {
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.15) 0%, transparent 50%);
            pointer-events: none;
        }
        .icon-wrapper {
            width: 80px;
            height: 80px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .icon {
            color: #ef4444;
            width: 40px;
            height: 40px;
        }
        h1 {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            margin: 0 0 16px;
            color: #ffffff;
            letter-spacing: -0.5px;
        }
        p {
            color: #a1a1aa;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 32px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #D4AF37, #AA7C11);
            color: #000000;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 100px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
            width: 100%;
            box-sizing: border-box;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="glow"></div>
        <div class="icon-wrapper">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${loginUrl}" class="btn">Continue to Login</a>
    </div>
</body>
</html>`;
		return new Response(html, { headers: { 'Content-Type': 'text/html' }, status: 403 });
	};

	if (!token) {
		return renderErrorPage(
			'Missing Link',
			'The sign-in link is missing a token. Please request a new link.'
		);
	}

	try {
		// 1. Find token
		const snapshot = await adminDb
			.collection('magic_links')
			.where('token', '==', token)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return renderErrorPage(
				'Invalid Link',
				'This sign-in link is invalid or has expired. Please request a new link.'
			);
		}

		const doc = snapshot.docs[0];
		const docData = doc.data();

		// 2. Validate usage and expiration
		if (docData.used) {
			return renderErrorPage(
				'Link Already Used',
				'This token has already been used. Please retry signing in.',
				docData.appType
			);
		}

		const now = admin.firestore.Timestamp.now();
		if (now.toMillis() > docData.expiresAt.toMillis()) {
			return renderErrorPage(
				'Link Expired',
				'This sign-in link has expired. Please request a new link.',
				docData.appType
			);
		}

		// 3. Mark used
		await doc.ref.update({ used: true, consumedAt: admin.firestore.FieldValue.serverTimestamp() });

		// 4. Check if user is newly created (check for profile completion)
		let isNewUser = false;
		try {
			const userDoc = await adminDb.collection('users').doc(docData.uid).get();
			if (!userDoc.exists || !userDoc.data()?.profileCompleted) {
				isNewUser = true;
			}
		} catch (e) {
			// Assume new user if check fails
			isNewUser = true;
			console.log('Could not check user profile, assuming new user');
		}

		// 5. Create Custom Auth Token for Frontend
		const customToken = await adminAuth.createCustomToken(docData.uid);

		// 6. Redirect to App with Token and new user flag
		let redirectUrl = getLoginUrl(docData.appType);

		redirectUrl = `${redirectUrl}?token=${customToken}`;
		if (isNewUser) {
			redirectUrl += '&isNewUser=true';
		}

		return new Response(null, {
			status: 302,
			headers: {
				Location: redirectUrl
			}
		});
	} catch (error) {
		console.error('Consume Error:', error);
		return renderErrorPage(
			'System Error',
			'An unexpected error occurred while processing your link. Please try again.'
		);
	}
}
