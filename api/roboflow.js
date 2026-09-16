/**
 * Serverless proxy for Roboflow Serverless Cloud API.
 * Keeps ROBOFLOW_API_KEY off the client.
 */

const DEFAULT_MODEL =
  process.env.ROBOFLOW_MODEL_ID || "baseball-detection/baseball-tracker-vp0ko/1";

function buildRoboflowUrl(modelId) {
  const parts = modelId.split("/").filter(Boolean);
  if (parts.length >= 3) {
    return `https://serverless.roboflow.com/${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  if (parts.length === 2) {
    return `https://serverless.roboflow.com/${parts[0]}/${parts[1]}`;
  }
  return `https://serverless.roboflow.com/${DEFAULT_MODEL}`;
}

function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body ?? null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Roboflow not configured",
      hint: "Set ROBOFLOW_API_KEY in Vercel environment variables.",
    });
  }

  const body = parseBody(req);
  if (!body?.image) {
    return res.status(400).json({ error: "Missing image (base64 data URL or raw base64)" });
  }

  let imageBuffer;
  let contentType = "image/jpeg";

  try {
    const raw = String(body.image);
    if (raw.startsWith("data:")) {
      const match = raw.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid data URL");
      contentType = match[1] || "image/jpeg";
      imageBuffer = Buffer.from(match[2], "base64");
    } else {
      imageBuffer = Buffer.from(raw, "base64");
    }
  } catch {
    return res.status(400).json({ error: "Could not decode image payload" });
  }

  const modelId = body.modelId || DEFAULT_MODEL;
  const confidence = body.confidence ?? 0.35;
  const url = `${buildRoboflowUrl(modelId)}?api_key=${encodeURIComponent(apiKey)}&confidence=${confidence}`;

  try {
    const form = new FormData();
    const blob = new Blob([imageBuffer], { type: contentType });
    form.append("file", blob, "frame.jpg");

    const upstream = await fetch(url, {
      method: "POST",
      body: form,
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Roboflow returned non-JSON response",
        status: upstream.status,
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.message || data?.error || "Roboflow inference failed",
        details: data,
      });
    }

    return res.status(200).json({
      modelId,
      predictions: data.predictions ?? [],
      image: data.image ?? null,
    });
  } catch (err) {
    console.error("Roboflow proxy error:", err);
    return res.status(502).json({
      error: "Failed to reach Roboflow",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
