// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./index.html",
    ],
    darkMode: 'class', // Keep this! It's essential for dark: to work
    theme: {
        extend: {
            colors: {
                black: '#000000',
                white: '#FFFFFF',
                agora: '#00c2ff',
                'agora-accent-blue': '#00c2ff',
            },
            // Custom grid utility (keep this)
            gridTemplateColumns: {
                'auto-fill-minmax-300': 'repeat(auto-fill, minmax(300px, 1fr))',
            },
            // Custom font family (keep this)
            fontFamily: {
                inter: ['Inter', 'sans-serif'],
                syne: ['var(--font-syne)', 'sans-serif'],
            }
        },
    },
    plugins: [],
}