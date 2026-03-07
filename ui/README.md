# React + Vite Skeleton Structure Reference

This folder (`ui_ref/`) contains a **skeleton structure** of the UI project stack used in this repository. You can use it as foundational knowledge or as a boilerplate template when generating new UIs for other projects.

## Tech Stack Overview
1. **Frontend Framework**: React 19 (`react`, `react-dom`)
2. **Build Tool & Dev Server**: Vite (`vite`, `@vitejs/plugin-react`)
3. **Language**: TypeScript (`typescript`, `@types/react`)
4. **Routing**: React Router DOM (`react-router-dom`) - specifically using `HashRouter` to prevent server-side path mismatches for Single Page Applications.
5. **Styling/CSS**: Tailwind CSS is included via a CDN link in `index.html` (with a specific script to define a custom configuration like `darkMode: 'class'` and custom themes). Global CSS including fonts and scrollbar styling is inline in `index.html`.
6. **Icons**: Lucide React (`lucide-react`)
7. **HTTP Client**: Axios (`axios`) with an abstraction layer for making API calls.

## Directory Structure
- `index.html`: The main entry point file. It includes the Google Fonts import, CDN script for Tailwind CSS, inline global styles, and embeds `src/main.tsx`.
- `vite.config.ts`: Configuration file for Vite. Sets up the React plugin, configures an `@` alias for the `src` folder, and sets up an API proxy (e.g., routing `/api` to `http://localhost:8000`) to avoid CORS during development.
- `tsconfig.json`: Standard TypeScript configuration for Vite React setups.
- `package.json`: Holds project metadata and dependencies.
- `src/`: Contains the actual source code.
  - `main.tsx`: Mounts the React application (`App.tsx`) to the `root` DOM node.
  - `App.tsx`: Sets up the router (`HashRouter`) and defines all routes (`Route`). Also implements high-level state (like authentication validation) and wrapper components (like `ProtectedRoute`).
  - `api.ts`: A centralized API client utilizing `axios`. Good for adding interceptors, defining auth tokens, handling specific errors globally.
  - `types.ts`: TypeScript interfaces/types used globally across the app (data models, API responses).
  - `components/`: Pure, reusable presentation components.
    - `Layout.tsx`: The main application shell (e.g., Sidebar, Header, Content Area) that wraps standard page components.
    - `common/`: Small, highly reusable generic components like Custom Buttons, Badges, Inputs.
    - `modals/`: Dialog components separated from page layouts.
  - `pages/`: Container components representing entire "screens" or "routes". These typically fetch data via `api.ts` and compose components from `components/` to present the data.

## Step-by-Step UI Generation Knowledge
When scaffolding new projects, follow this logical flow:

1. **Setup Project**: Use Vite's React TS template: `npm create vite@latest new-project -- --template react-ts`.
2. **Dependencies**: Install core ecosystem packages: `npm install react-router-dom axios lucide-react`. (Use CDN Tailwind or `npm i tailwindcss postcss autoprefixer`).
3. **Global Styling (`index.html`)**: Define `index.html`. Inject Tailwind. Configure theme colors (e.g. `success`, `danger`, `primary`). Add any global scrolling/animations custom classes.
4. **API and Types (`api.ts`, `types.ts`)**: Define the data structure interfaces and simple API wrappers to query your backend.
5. **Routing (`App.tsx`, `main.tsx`)**: Establish your routes. Wrap protected routes logically.
6. **Layout & Reusables (`Layout.tsx`)**: Build the header, sidebar, footer. Form the skeleton layout wrapper for the page.
7. **Pages**: Build views for specific URLs by aggregating components and managing side-effects using Hooks.

This `ui_ref/` acts as the explicit boilerplate capturing all these standards.
