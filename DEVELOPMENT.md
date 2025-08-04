# Development Setup

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AltStackFast
```

2. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
AltStackFast/
├── src/
│   ├── App.jsx          # Main application component
│   ├── Main.jsx         # Application entry point
│   └── index.css        # Global styles with Tailwind
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
└── .gitignore          # Git ignore rules
```

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Firebase** - Backend services (Firestore, Auth)
- **Marked** - Markdown parsing

## Security Notes

The project currently has some moderate security vulnerabilities in development dependencies. These are primarily related to:
- Firebase SDK dependencies
- Development server (esbuild)

These vulnerabilities don't affect production builds and are being addressed by the respective package maintainers. 