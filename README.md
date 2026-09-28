# carsjson

The ready-to-publish static build of CarsJSON: a JSON API for car brands and models, WebP brand logos, and a documentation website.

This repository contains the files needed for deployment. No Node.js runtime, database, server application, or API key is required. Record counts, the data version, and the build timestamp are available in [`v1/meta.json`](v1/meta.json).

## Contents

| Path | Description |
| --- | --- |
| `index.html`, `assets/` | Documentation website |
| `v1/brands.json` | All car brands |
| `v1/brands/{brand_slug}/models.json` | Models for a specific brand |
| `v1/all.json` | Complete catalog: `{ "brands": [...], "models": [...] }` |
| `v1/meta.json` | Schema version, data hash, build timestamp, and record counts |
| `logos/` | Brand logos in WebP format |
| `openapi.json` | OpenAPI specification |
| `llms.txt` | Concise documentation for AI tools |

`brand_slug` is the brand ID in lowercase, for example `bmw`, `abarth`, or `alfa_romeo`.

## Run locally

With Python 3 installed, run the following from the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://localhost:4173>. Example request:

```js
const response = await fetch('http://localhost:4173/v1/brands/bmw/models.json');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const models = await response.json();
console.log(models);
```

You can run this example in the browser console on the local website. After deployment, replace `http://localhost:4173` with your site's URL.

## Data notes

- Brands contain `id`, `name`, `cyrillic_name`, `year_from`, `year_to`, and `logo`.
- Models contain `id`, `name`, `cyrillic_name`, `year_from`, `year_to`, `brand_id`, and `nameplates`.
- A model is identified by the pair `brand_id` + `id`.
- Missing years are represented as `null`. A year range alone does not confirm that a vehicle is currently in production.
- Logo paths start at the site root, for example `/logos/bmw.webp`.
- `generated_at` is the build time, not the date the source data was collected. `data_version` is a SHA-256 hash of the public data and logos.

## Deployment and updates

Deploy the repository contents at the root of a static website: API and asset paths are absolute, starting with `/`. No additional build step is required.

The `_headers` file contains CORS and caching settings for Cloudflare Pages. For other hosting providers, configure the equivalent HTTP headers using your host's settings.

This repository lives in the `dist/` directory of the `autoru-test` source project. To update it, run `npm run build`, then `npm run publish:dist` from the source project root. The build preserves `dist/.git`, and publishing creates a commit with the update date and pushes it to GitHub. The scripts for collecting data and building the project are not included in this repository.
