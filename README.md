# Daily Bangladesh News Archive

Daily Bangladesh is a dedicated application for fetching and displaying the latest news and archive data from daily-bangladesh.com.

## Features

- **Latest News Archive:** Fetch latest news directly from the Daily Bangladesh backoffice API.
- **Image Proxy:** Directly proxy images (PNG, JPG, SVG, etc.) with correct CORS headers.
- **Metadata Extraction:** Extract metadata from Daily Bangladesh articles.
- **No API Keys:** Use it immediately without registration or rate limits.
- **Dynamic Protocol/Host Support:** Automatically adapts to your environment (development or production).

## API Usage

### 1. Fetch News Archive

Returns a list of latest news from the Daily Bangladesh archive.

```bash
GET /get
```

### 2. Proxy an Image

Returns the image binary directly.

```bash
GET /get?url=https://example.com/image.png
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
