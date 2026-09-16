import { resolveModelIds } from "../lib/roboflow-models.js";

/** Public config — never exposes the secret Roboflow API key. */
export default function handler(_req, res) {
  const models = resolveModelIds();
  const secretKey = Boolean(process.env.ROBOFLOW_API_KEY);
  const publishableKey = process.env.NEXT_PUBLIC_ROBOFLOW_PUBLISHABLE_KEY || "";

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({
    roboflowEnabled: secretKey || Boolean(publishableKey),
    useProxy: secretKey,
    publishableKey: secretKey ? null : publishableKey || null,
    modelId: models.detect,
    altModelId: models.alt,
    poseModelId: models.pose,
    poseEnabled: models.poseEnabled,
    maxAnalysisSeconds: 10,
  });
}
