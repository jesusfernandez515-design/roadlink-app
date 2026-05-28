# Roadlink

A modern ride-sharing and carpooling platform built with Next.js 16.

## Features

- Search for available rides
- Offer rides to others
- User authentication (login/signup)
- Responsive design
- Modern UI with Tailwind CSS

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React
- **Language:** TypeScript

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
roadlink-app/
├── app/
│   ├── globals.css       # Global styles and CSS variables
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Homepage
│   ├── about/            # About page
│   ├── login/            # Login page
│   ├── offer/            # Offer a ride page
│   ├── search/           # Search rides page
│   └── signup/           # Signup page
├── components/
│   ├── cta.tsx           # Call-to-action section
│   ├── features.tsx      # Features section
│   ├── footer.tsx        # Footer component
│   ├── header.tsx        # Header with navigation
│   ├── hero.tsx          # Hero section
│   ├── how-it-works.tsx  # How it works section
│   ├── popular-routes.tsx # Popular routes section
│   ├── search-form.tsx   # Search form component
│   └── testimonials.tsx  # Testimonials section
├── lib/
│   └── utils.ts          # Utility functions
├── public/
│   └── icon.svg          # Favicon
└── vercel.json           # Vercel deployment config
```

## Deployment

This project is configured for deployment on Vercel. Simply push to your repository and Vercel will automatically deploy.

## License

MIT
