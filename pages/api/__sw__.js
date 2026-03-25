import { getServiceWorkerContent } from "almostnode/next";

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "no-cache");
  res.send(getServiceWorkerContent());
}
