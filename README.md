# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Maintenance mode

Shows a sitewide "down for maintenance" screen (503) for every page, form post and `/api/*` call. Static assets still load; the screen itself is self-contained.

| Action | How |
|---|---|
| Turn ON (instant, no restart) | create an empty file named `MAINTENANCE_ON` in the app's working directory (the folder `npm start` runs from) |
| Turn OFF | delete that file |
| Alternative (needs restart) | set env `MAINTENANCE_MODE=true`, remove it and restart to turn off |
| Show a return time | set env `MAINTENANCE_ETA`, e.g. `6:00 PM IST` (needs restart) |

Docker: `docker exec <container> touch /app/MAINTENANCE_ON` / `docker exec <container> rm /app/MAINTENANCE_ON`. The file lives inside the container, so recreating the container turns maintenance off.
Optional: `MAINTENANCE_FLAG_FILE` changes the file path.

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
