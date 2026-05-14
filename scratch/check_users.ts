import { allUsers } from './src/lib/stores/adminData';
import { get } from 'svelte/store';

// This is a scratch script to debug user statuses
const users = get(allUsers);
console.log('Total Users:', users.length);

const statuses = [...new Set(users.map((u) => u.accountStatus))];
console.log('Unique Account Statuses:', statuses);

const types = [...new Set(users.map((u) => u.accountType))];
console.log('Unique Account Types:', types);

const mergedUsers = users.filter((u) => u.accountStatus === 'merged' || u.mergedIntoUid);
console.log('Detected Merged Users:', mergedUsers.length);
if (mergedUsers.length > 0) {
	console.log('Sample Merged User:', JSON.stringify(mergedUsers[0], null, 2));
}
