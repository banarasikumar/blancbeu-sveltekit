export interface Service {
	id: number;
	name: string;
	category: string;
	price: number;
	originalPrice?: number;
	image: string;
	description: string;
	duration: string;
	rating: number;
	reviews: number;
	isActive?: boolean;
}

// Helper to get image path (assuming images are in static/assets/service_images/)
// Legacy paths were like: "assets/service_images/filename.webp"
// New paths will be: "/assets/service_images/filename.webp"
const getImg = (legacyPath: string) => {
	// Remove "assets/" prefix if present, as static/assets becomes /assets
	// Actually legacy path is "assets/service_images/..."
	// We moved them to "static/assets/service_images/..."
	// So web path is "/assets/service_images/..."
	// The legacy path "assets/service_images/..." matches nicely if we just prepend "/"

	// Wait, let's just use the filename from the legacy path to be safe
	const filename = legacyPath.split('/').pop();
	return `/assets/service_images/${filename}`;
};

export const services: Service[] = [
	// --- Hair (Hair cutting, Hairs & Treatment, Hair colour) ---
	// Group: Hair cutting
	{
		id: 101,
		name: 'Plain Haircut',
		category: 'Hair',
		price: 99,
		originalPrice: 100,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'), // No direct match yet
		description: 'Classic plain haircut for a neat look.',
		duration: '30 min',
		rating: 4.8,
		reviews: 45
	},
	{
		id: 102,
		name: 'U-Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 150,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'U-shaped cut for volume and style.',
		duration: '30 min',
		rating: 4.7,
		reviews: 32
	},
	{
		id: 103,
		name: 'V-Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 150,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Sharp V-shape cut for a trendy look.',
		duration: '45 min',
		rating: 4.8,
		reviews: 28
	},
	{
		id: 104,
		name: 'Deep U-Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 200,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Deep styling for U-cut lovers.',
		duration: '45 min',
		rating: 4.9,
		reviews: 50
	},
	{
		id: 105,
		name: 'Deep V-Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 200,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Bold Deep V-cut style.',
		duration: '45 min',
		rating: 4.8,
		reviews: 42
	},
	{
		id: 106,
		name: 'Step Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 300,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Layered step cut for bounce and volume.',
		duration: '45 min',
		rating: 4.7,
		reviews: 35
	},
	{
		id: 107,
		name: 'Layer Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 500,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Multi-layer cut for texture and movement.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 80
	},
	{
		id: 108,
		name: 'Butterfly Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 500,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Trending butterfly layers for face framing.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 65
	},
	{
		id: 109,
		name: 'Bob Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 400,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Chic and timeless bob style.',
		duration: '45 min',
		rating: 4.8,
		reviews: 55
	},
	{
		id: 110,
		name: 'Baby Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 200,
		image: getImg('assets/service_images/Kids Haircut.png'),
		description: 'Cute and manageable cut for kids.',
		duration: '30 min',
		rating: 5.0,
		reviews: 20
	},
	{
		id: 111,
		name: 'Advance Haircut',
		category: 'Hair',
		price: 99,
		originalPrice: 600,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Professional styling for modern looks.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 40
	},
	{
		id: 112,
		name: 'Feather Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 450,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Soft feather layers for elegance.',
		duration: '45 min',
		rating: 4.8,
		reviews: 60
	},
	{
		id: 113,
		name: 'Pixie Cut',
		category: 'Hair',
		price: 99,
		originalPrice: 500,
		image: getImg('assets/service_images/professional_hair_st_3fab25e9.webp'),
		description: 'Bold shorts pixie style.',
		duration: '45 min',
		rating: 4.7,
		reviews: 25
	},

	// Group: Hairs & Treatment
	{
		id: 201,
		name: 'Keratin Treatment',
		category: 'Hair',
		price: 1499,
		originalPrice: 2500,
		image: getImg('assets/service_images/Keratin Treatment.png'),
		description: 'Smooth, frizz-free hair with keratin protein.',
		duration: '3 hrs',
		rating: 4.9,
		reviews: 120
	},
	{
		id: 202,
		name: 'Straightening/Smoothening',
		category: 'Hair',
		price: 1999,
		originalPrice: 3000,
		image: getImg('assets/service_images/Hair Straightening.png'),
		description: 'Permanent straightening for sleek hair.',
		duration: '4 hrs',
		rating: 4.8,
		reviews: 95
	},
	{
		id: 203,
		name: 'Botox Treatment',
		category: 'Hair',
		price: 2499,
		originalPrice: 3500,
		image: getImg('assets/service_images/Hair Botox Treatment.png'),
		description: 'Deep conditioning for damaged hair repair.',
		duration: '2 hrs',
		rating: 4.9,
		reviews: 60
	},
	{
		id: 204,
		name: 'Rebounding',
		category: 'Hair',
		price: 2400,
		originalPrice: 3500,
		image: getImg('assets/service_images/Hair Rebonding.png'),
		description: 'Chemical straightening service.',
		duration: '3 hrs',
		rating: 4.7,
		reviews: 40
	},
	{
		id: 205,
		name: 'Nanoplastia',
		category: 'Hair',
		price: 2999,
		originalPrice: 7000,
		image: getImg('assets/service_images/hair_coloring_treatm_b175b405.webp'),
		description: 'Organic hair straightening and restoration.',
		duration: '4 hrs',
		rating: 5.0,
		reviews: 30
	},
	{
		id: 206,
		name: 'Hair Spa',
		category: 'Hair',
		price: 799,
		originalPrice: 1500,
		image: getImg('assets/service_images/Hair Spa.png'),
		description: 'Relaxing spa for hair nourishment.',
		duration: '1 hr',
		rating: 4.8,
		reviews: 150
	},
	{
		id: 207,
		name: 'Protein Treatment',
		category: 'Hair',
		price: 1199,
		originalPrice: 2000,
		image: getImg('assets/service_images/hair_coloring_treatm_b175b405.webp'),
		description: 'Protein infusion for stronger hair.',
		duration: '1.5 hrs',
		rating: 4.8,
		reviews: 45
	},
	{
		id: 208,
		name: 'Anti-Dandruff Treatment',
		category: 'Hair',
		price: 999,
		originalPrice: 1800,
		image: getImg('assets/service_images/Dandruff Treatment.png'),
		description: 'Effective treatment for dandruff control.',
		duration: '1 hr',
		rating: 4.7,
		reviews: 55
	},

	// Group: Hair colour
	{
		id: 301,
		name: 'Global Hair Colour',
		category: 'Hair',
		price: 1199,
		originalPrice: 1500, // Estimated
		image: getImg('assets/service_images/hair_colour_vibrant_pink.webp'),
		description: 'Full head single tone color.',
		duration: '2 hrs',
		rating: 4.8,
		reviews: 70
	},
	{
		id: 302,
		name: 'Global Highlight',
		category: 'Hair',
		price: 1299,
		originalPrice: 1600, // Estimated
		image: getImg('assets/service_images/hair_colour_vibrant_pink.webp'),
		description: 'Highlights all over for dimension.',
		duration: '2.5 hrs',
		rating: 4.8,
		reviews: 65
	},
	{
		id: 303,
		name: 'Highlight Per Streak',
		category: 'Hair',
		price: 149,
		originalPrice: 200, // Estimated
		image: getImg('assets/service_images/hair_colour_vibrant_pink.webp'),
		description: 'Add a pop of color with single streaks.',
		duration: '30 min',
		rating: 4.7,
		reviews: 40
	},
	{
		id: 304,
		name: 'Balayage',
		category: 'Hair',
		price: 1999,
		originalPrice: 2500,
		image: getImg('assets/service_images/hair_colour_vibrant_pink.webp'),
		description: 'Hand-painted highlights for natural look.',
		duration: '3 hrs',
		rating: 4.9,
		reviews: 50
	},
	{
		id: 305,
		name: 'Ombre',
		category: 'Hair',
		price: 1799,
		originalPrice: 2200,
		image: getImg('assets/service_images/hair_colour_vibrant_pink.webp'),
		description: 'Gradient color effect from dark to light.',
		duration: '3 hrs',
		rating: 4.8,
		reviews: 45
	},
	{
		id: 306,
		name: 'Root Touch-Up',
		category: 'Hair',
		price: 399,
		originalPrice: 599,
		image: getImg('assets/service_images/hair_colour_vibrant_pink.webp'),
		description: 'Cover grey roots efficiently.',
		duration: '1 hr',
		rating: 4.8,
		reviews: 90
	},

	// --- Skin (Clean up, Facial) ---
	// Group: Clean up
	{
		id: 401,
		name: 'Fruit Cleanup',
		category: 'Skin',
		price: 250,
		originalPrice: 500,
		image: getImg('assets/service_images/Fruit Facial.png'), // Reusing Fruit Facial image for Fruit Cleanup? Or keep old? Plan said maybe reuse. Let's reuse for now as it's better than generic.
		description: 'Fresh fruit extracts for glowing skin.',
		duration: '30 min',
		rating: 4.7,
		reviews: 30
	},
	{
		id: 402,
		name: 'Diamond Cleanup',
		category: 'Skin',
		price: 499,
		originalPrice: 800,
		image: getImg('assets/service_images/beautiful_woman_gett_9dc7243a.webp'),
		description: 'Diamond dust for instant brightness.',
		duration: '45 min',
		rating: 4.8,
		reviews: 25
	},
	{
		id: 403,
		name: 'Gold Cleanup',
		category: 'Skin',
		price: 599,
		originalPrice: 1000,
		image: getImg('assets/service_images/beautiful_woman_gett_9dc7243a.webp'),
		description: 'Gold particles for radiance.',
		duration: '45 min',
		rating: 4.9,
		reviews: 35
	},
	{
		id: 404,
		name: 'Charcoal Cleanup',
		category: 'Skin',
		price: 399,
		originalPrice: 700,
		image: getImg('assets/service_images/beautiful_woman_gett_9dc7243a.webp'),
		description: 'Deep cleansing with activated charcoal.',
		duration: '45 min',
		rating: 4.8,
		reviews: 28
	},

	// Group: Facial
	{
		id: 501,
		name: 'Lotus Professional Facial',
		category: 'Skin',
		price: 699,
		originalPrice: 1500,
		image: getImg('assets/service_images/facial_new.webp'),
		description: 'Professional facial for deep hydration.',
		duration: '1 hr',
		rating: 4.8,
		reviews: 60
	},
	{
		id: 502,
		name: '03+ Facial',
		category: 'Skin',
		price: 699,
		originalPrice: 1500,
		image: getImg('assets/service_images/facial_new.webp'),
		description: 'Premium whitening and brightening facial.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 85
	},
	{
		id: 503,
		name: 'Fruit Facial',
		category: 'Skin',
		price: 599,
		originalPrice: 1200,
		image: getImg('assets/service_images/Fruit Facial.png'),
		description: 'Natural fruit enzyme facial.',
		duration: '45 min',
		rating: 4.7,
		reviews: 40
	},
	{
		id: 504,
		name: 'Gold Facial',
		category: 'Skin',
		price: 999,
		originalPrice: 2000,
		image: getImg('assets/service_images/facial_new.webp'),
		description: 'Luxury gold facial for special occasions.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 75
	},
	{
		id: 505,
		name: 'Diamond Facial',
		category: 'Skin',
		price: 1299,
		originalPrice: 2500,
		image: getImg('assets/service_images/facial_new.webp'),
		description: 'Exquisite diamond facial for polishing.',
		duration: '1.2 hrs',
		rating: 5.0,
		reviews: 50
	},
	{
		id: 506,
		name: 'Anti-Aging Facial',
		category: 'Skin',
		price: 1199,
		originalPrice: 2200,
		image: getImg('assets/service_images/Anti-Aging Facial.png'),
		description: 'Firming treatment for youthful skin.',
		duration: '1 hr',
		rating: 4.8,
		reviews: 30
	},

	// --- Makeup (Makeup & Styling) ---
	{
		id: 601,
		name: 'Party Makeup',
		category: 'Makeup',
		price: 1499,
		originalPrice: 2000,
		image: getImg('assets/service_images/Party Makeup.png'),
		description: 'glamorous makeup for parties.',
		duration: '1 hr',
		rating: 4.8,
		reviews: 90
	},
	{
		id: 602,
		name: 'Bridal Makeup',
		category: 'Makeup',
		price: 5999,
		originalPrice: 8000,
		image: getImg('assets/service_images/Bridal Makeup.png'),
		description: 'Complete bridal makeover.',
		duration: '3 hrs',
		rating: 5.0,
		reviews: 150
	},
	{
		id: 603,
		name: 'HD Makeup',
		category: 'Makeup',
		price: 2499,
		originalPrice: 3500,
		image: getImg('assets/service_images/HD Makeup.png'),
		description: 'High definition makeup for photos.',
		duration: '2 hrs',
		rating: 4.9,
		reviews: 80
	},
	{
		id: 604,
		name: 'Airbrush Makeup',
		category: 'Makeup',
		price: 2999,
		originalPrice: 4000,
		image: getImg('assets/service_images/makeup_styling_new.webp'),
		description: 'Flawless airbrush finish.',
		duration: '2 hrs',
		rating: 4.9,
		reviews: 65
	},
	{
		id: 605,
		name: 'Pre-Bridal Package',
		category: 'Makeup',
		price: 9999,
		originalPrice: 15000,
		image: getImg('assets/service_images/makeup_styling_new.webp'),
		description: 'Comprehensive package before the big day.',
		duration: 'Multiple Sessions',
		rating: 5.0,
		reviews: 40
	},

	// --- Nails (Nails & Beauty) ---
	{
		id: 701,
		name: 'Manicure',
		category: 'Nails',
		price: 299,
		originalPrice: 500,
		image: getImg('assets/service_images/nails_beauty_vibrant.webp'),
		description: 'Classic hand care and polishing.',
		duration: '45 min',
		rating: 4.7,
		reviews: 60
	},
	{
		id: 702,
		name: 'Pedicure',
		category: 'Nails',
		price: 349,
		originalPrice: 600,
		image: getImg('assets/service_images/Pedicure.webp'),
		description: 'Relaxing foot care service.',
		duration: '45 min',
		rating: 4.8,
		reviews: 70
	},
	{
		id: 703,
		name: 'Gel Nails',
		category: 'Nails',
		price: 999,
		originalPrice: 1500,
		image: getImg('assets/service_images/nails_beauty_vibrant.webp'),
		description: 'Long-lasting gel nail polish.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 55
	},
	{
		id: 704,
		name: 'Nail Art',
		category: 'Nails',
		price: 499,
		originalPrice: 800,
		image: getImg('assets/service_images/nails_beauty_vibrant.webp'),
		description: 'Creative designs for your nails.',
		duration: '30-60 min',
		rating: 4.8,
		reviews: 45
	},
	{
		id: 705,
		name: 'Threading',
		category: 'Nails', // Grouped here as Beauty
		price: 50,
		originalPrice: 100,
		image: getImg('assets/service_images/Eyebrow Threading.png'),
		description: 'Precise eyebrow threading.',
		duration: '15 min',
		rating: 4.8,
		reviews: 200
	},
	{
		id: 706,
		name: 'Waxing Full Arms',
		category: 'Nails', // Beauty
		price: 299,
		originalPrice: 400,
		image: getImg('assets/service_images/nails_beauty_vibrant.webp'),
		description: 'Smooth waxing for arms.',
		duration: '30 min',
		rating: 4.7,
		reviews: 80
	},
	{
		id: 707,
		name: 'Waxing Full Legs',
		category: 'Nails', // Beauty
		price: 399,
		originalPrice: 600,
		image: getImg('assets/service_images/nails_beauty_vibrant.webp'),
		description: 'Smooth waxing for legs.',
		duration: '45 min',
		rating: 4.7,
		reviews: 75
	},

	// --- Spa (Premium services) ---
	{
		id: 801,
		name: 'Head Massage',
		category: 'Spa',
		price: 199,
		originalPrice: 250,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Relaxing head massage with oil.',
		duration: '30 min',
		rating: 4.8,
		reviews: 100
	},
	{
		id: 802,
		name: 'Deep Nourish HairSpa',
		category: 'Spa', // Can be Hair but fits Premium Spa text
		price: 799,
		originalPrice: 1500,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Intense hydration for hair.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 60
	},
	{
		id: 803,
		name: 'Full Body Massage',
		category: 'Spa',
		price: 999,
		originalPrice: 5000,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Complete relaxation for body and mind.',
		duration: '1 hr',
		rating: 5.0,
		reviews: 45
	},
	{
		id: 804,
		name: 'Blow Dry',
		category: 'Spa', // Or Hair. Putting in Spa as part of Premium
		price: 199,
		originalPrice: 500,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Professional blow dry styling.',
		duration: '30 min',
		rating: 4.8,
		reviews: 50
	},
	{
		id: 805,
		name: 'Aroma Therapy',
		category: 'Spa',
		price: 1499,
		originalPrice: 3000,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Therapeutic massage with essential oils.',
		duration: '1 hr',
		rating: 4.9,
		reviews: 30
	},
	{
		id: 806,
		name: 'Hot Stone Massage',
		category: 'Spa',
		price: 1799,
		originalPrice: 3500,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Warm stone therapy for muscle relief.',
		duration: '1.5 hrs',
		rating: 4.9,
		reviews: 25
	},
	{
		id: 807,
		name: 'Thai Massage',
		category: 'Spa',
		price: 1999,
		originalPrice: 4000,
		image: getImg('assets/service_images/premium_hair_spa_nourish.webp'),
		description: 'Traditional Thai massage stretching.',
		duration: '1.5 hrs',
		rating: 5.0,
		reviews: 20
	}
];

export const featuredServices = services.filter((s) => [101, 201, 501, 602].includes(s.id));
