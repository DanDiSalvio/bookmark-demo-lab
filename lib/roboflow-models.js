/** Shared Roboflow Universe model IDs for Baseball Swing Lab. */

export const DEFAULT_DETECT_MODEL = "mlb-sbfxd/baseball-and-baseball-bat/1";
export const ALT_DETECT_MODEL = "baseball-v1/baseball-and-bat/2";
export const POSE_MODEL = "swingapi/baseball-pose-4y9w6/4";

export function resolveModelIds() {
  return {
    detect: process.env.ROBOFLOW_MODEL_ID || DEFAULT_DETECT_MODEL,
    alt: process.env.ROBOFLOW_ALT_MODEL_ID || ALT_DETECT_MODEL,
    pose: process.env.ROBOFLOW_POSE_MODEL_ID || POSE_MODEL,
    poseEnabled: process.env.ROBOFLOW_POSE_ENABLED !== "false",
  };
}

/** Hosted detect API (legacy endpoint, still supported for Universe models). */
export function buildDetectUrl(modelId, apiKey, { confidence = 0.35 } = {}) {
  const path = modelId.split("/").filter(Boolean).join("/");
  const params = new URLSearchParams({
    api_key: apiKey,
    confidence: String(confidence),
  });
  return `https://detect.roboflow.com/${path}?${params}`;
}
