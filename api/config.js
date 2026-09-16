/** Public config — never exposes the Roboflow API key. */
export default function handler(_req, res) {
  const modelId =
    process.env.ROBOFLOW_MODEL_ID || "baseball-detection/baseball-tracker-vp0ko/1";

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({
    roboflowEnabled: Boolean(process.env.ROBOFLOW_API_KEY),
    modelId,
    maxAnalysisSeconds: 10,
  });
}
