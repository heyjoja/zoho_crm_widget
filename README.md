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
```bash
cd web-component
npm install
npm start
```
Runs on `http://localhost:3000` with hot reload.

## Build & deploy

From the project root, run:
```bash
./build.sh
```
This will:
1. Build the React app in production mode
2. Clean `contacts/app/`
3. Copy the output into `contacts/app/`
4. Run `zet pack` to generate the Zoho-ready `.zip`

Upload the generated `.zip` to Zoho CRM under **Settings → Developer Space → Widgets**.

---

## Address editing

The address editor (`AddressEditor.jsx`) allows the user to update the physical location of a contact directly from the detail panel. It combines two external APIs to automatically fill in the address fields from a postal code, and a third API to convert map pin drags back into a readable address.

### How to edit an address

1. Open a contact's detail panel by clicking on any row in the contacts table.
2. Scroll down to the **Contact location** section — it shows the current address (street, city, province/state, country).
3. Click the **edit icon** (pencil) on the top-right of that section.
4. The form expands with the following fields:
    - **Country code** — select `US` (United States) or `CA` (Canada) from the dropdown.
    - **Postal code** — type the postal code. The lookup triggers automatically after you stop typing (debounced 600 ms). You can also press **Enter** or click the search icon to trigger it manually.
    - **Street address** — filled automatically after the postal code lookup. You can edit it freely.
    - **City**, **Province / State**, **Country** — filled automatically; editable.
5. Click **Save address** to persist the changes or **Cancel** to discard them.

Additionally, if the contact already has a location on the map, you can **drag the pin** to a new position. The form fields will update automatically via reverse geocoding.

### APIs used

#### 1. Zippopotam (`api.zippopotam.us`)

- **Purpose:** Resolves a postal code into city, state/province and country.
- **Endpoint:** `GET https://api.zippopotam.us/{countryCode}/{postalCode}`
- **Example:** `GET https://api.zippopotam.us/US/90210`
- **Response used:**
  ```json
  {
    "country": "United States",
    "places": [
      {
        "place name": "Beverly Hills",
        "state": "California",
        "latitude": "34.0901",
        "longitude": "-118.4065"
      }
    ]
  }
  ```
- **Notes:**
    - No API key required — free and public.
    - For Canadian postal codes only the first 3 characters (Forward Sortation Area) are sent.
    - Results are cached in memory by `countryCode:postalCode` key to avoid redundant requests.

#### 2. Nominatim — Search (`nominatim.openstreetmap.org/search`)

- **Purpose:** Complements Zippopotam by providing street-level suggestions and precise coordinates for the postal code area.
- **Endpoint:** `GET https://nominatim.openstreetmap.org/search?postalcode={code}&countrycodes={cc}&format=jsonv2&addressdetails=1&limit=2`
- **Example:** `GET https://nominatim.openstreetmap.org/search?postalcode=90210&countrycodes=us&format=jsonv2&addressdetails=1&limit=2`
- **Response used:**
  ```json
  [
    {
      "lat": "34.0901",
      "lon": "-118.4065",
      "display_name": "Beverly Hills, Los Angeles County, California, United States",
      "address": {
        "house_number": "...",
        "road": "Wilshire Blvd",
        "city": "Beverly Hills",
        "state": "California",
        "postcode": "90210",
        "country": "United States",
        "country_code": "us"
      }
    }
  ]
  ```
- **Notes:**
    - No API key required — free and public.
    - Requests are rate-limited to **1 request per second** using a shared `nextNominatimRequestAt` timer.
    - Results are cached in memory by `countryCode:postalCode` key.
    - The results are filtered to only include entries whose postal code and country code match the user's input.

#### 3. Nominatim — Reverse geocoding (`nominatim.openstreetmap.org/reverse`)

- **Purpose:** Converts a geographic coordinate (longitude, latitude) into a human-readable address. Used in two scenarios:
    1. After a postal code lookup, to get the street address closest to the resolved coordinates.
    2. When the user drags the map pin to a new position.
- **Endpoint:** `GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=jsonv2&addressdetails=1`
- **Example:** `GET https://nominatim.openstreetmap.org/reverse?lat=34.0901&lon=-118.4065&format=jsonv2&addressdetails=1`
- **Response used:** Same `address` structure as the search endpoint above.
- **Notes:**
    - No API key required — free and public.
    - Shares the same 1 req/s rate limiter as the search endpoint.
    - Results are cached by `lat,lng` rounded to 5 decimal places.
    - Triggered with a 600 ms debounce after each pin drag to avoid flooding the API.
