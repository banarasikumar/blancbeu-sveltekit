declare module '*?enhanced' {
	const value: import('vite-imagetools').Picture;
	export default value;
}

declare module '*&enhanced' {
	const value: import('vite-imagetools').Picture;
	export default value;
}

declare module '*?w=*:&h=*&format=webp' {
	const value: string;
	export default value;
}
