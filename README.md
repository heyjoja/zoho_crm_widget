# Contacts Widget — Zoho CRM

A React-based web component that runs inside Zoho CRM as a custom widget. It displays and manages contact information including an interactive map powered by MapLibre GL.

## What it does

- Lists CRM contacts in a paginated, searchable table
- Shows a detail panel to view and edit contact fields inline
- Resolves postal codes automatically via Zippopotam + Nominatim
- Renders a location map for each contact using OpenStreetMap

## Project structure

```
├── web-component/       # React app (source code)
│   ├── src/
│   │   ├── assets/style/   # Global CSS
│   │   ├── components/     # UI components
│   │   └── language/       # i18n context
│   └── webpack.config.js
├── contacts/            # Zoho widget package
│   ├── app/             # Built files (auto-generated, do not edit)
│   ├── server/          # Local dev server for Zoho
│   └── plugin-manifest.json
└── build.sh             # Build + pack script
```

## Development

Install dependencies and start the dev server:
```
bash
cd web-component
npm install
npm start
```
Runs on `http://localhost:3000` with hot reload.

## Build & deploy

From the project root, run:
```
bash
./build.sh
```
This will:
1. Build the React app in production mode
2. Clean `contacts/app/`
3. Copy the output into `contacts/app/`
4. Run `zet pack` to generate the Zoho-ready `.zip`

Upload the generated `.zip` to Zoho CRM under **Settings → Developer Space → Widgets**.
```
