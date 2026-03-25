import { extractMetadata } from "@/lib/extractor";

export default async function handler(req, res) {
  const { method } = req;
  let { url, fields } = req.query;

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method !== "GET") {
    return res.status(400).json({ success: false, error: `Unhandled request method: ${method}` });
  }

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";

    const result = await extractMetadata(url, { host, protocol });

    if (result.isImage) {
      res.setHeader("Content-Type", result.contentType);
      return res.status(200).send(Buffer.from(result.buffer));
    }

    if (fields) {
      const fieldList = fields.split(",").map((f) => f.trim());
      const filteredData = {};
      fieldList.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(result, field)) {
          filteredData[field] = result[field];
        }
      });
      return res.status(200).json(filteredData);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
