# NEWSOrigin CORS Proxy

NEWSOrigin is a free, open-source CORS proxy optimized for news sites and general web content. It extracts rich metadata and proxies images, making it easy to consume content from any domain without CORS issues.

## Features

- **Image Proxy:** Directly proxy images (PNG, JPG, SVG, etc.) with correct CORS headers.
- **Metadata Extraction:** Extract Open Graph and Twitter Card metadata (title, description, image, favicon, etc.) from any web page.
- **No API Keys:** Use it immediately without registration or rate limits.
- **Dynamic Protocol/Host Support:** Automatically adapts to your environment (development or production).

## API Usage

### 1. Proxy an Image

Returns the image binary directly.

```bash
GET /get?url=https://example.com/image.png
```

### 2. Extract Metadata

Returns a JSON object with the page's metadata.

```bash
GET /get?url=https://news.ycombinator.com
```

### 3. Field Filtering

Ask for specific data fields by providing a `fields` parameter (comma-separated).

```bash
GET /get?url=https://news.ycombinator.com&fields=title,favicon
```

**Response Format:**

```json
{
  "title": "Hacker News",
  "description": "...",
  "siteName": "...",
  "image": "https://your-host.com/get?url=...",
  "favicon": "https://your-host.com/get?url=...",
  "url": "https://news.ycombinator.com"
}
```

## Getting Started

First, install the dependencies:

```bash
npm install
```

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

The service is hosted on Vercel and is automatically deployed when changes are pushed to the `main` branch.
