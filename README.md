# Animabing

A modern anime download platform with a responsive design and admin dashboard.

## Features

- Browse anime with Hindi Dub and Sub
- Search functionality
- Admin panel to manage anime and episodes
- Responsive design

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Run in development: `npm run dev:full`
5. Build for production: `npm run build`
6. Start production server: `npm start`

## Environment Variables

- `MONGO_URI`: MongoDB connection string
- `ADMIN_USER`: Admin username
- `ADMIN_PASS`: Admin password
- `JWT_SECRET`: JWT secret key
- `VITE_API_BASE`: Frontend API base URL

## Deployment

The project can be deployed on any Node.js hosting platform. Make sure to set the environment variables in production.