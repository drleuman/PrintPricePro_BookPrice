/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                corporate: {
                    primary: 'var(--bg-primary)',
                    secondary: 'var(--bg-secondary)',
                    elevated: 'var(--bg-elevated)',
                    accent: 'var(--accent-primary)',
                    hover: 'var(--accent-hover)',
                    text: 'var(--text-primary)',
                    'text-secondary': 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                }
            },
            fontFamily: {
                display: ['Manrope', 'sans-serif'],
                technical: ['Space Grotesk', 'monospace'],
                sans: ['Manrope', 'sans-serif'],
            },
            letterSpacing: {
                'monolith': '0.2em',
                'technical': '0.1em',
            }
        },
    },
    plugins: [],
}

