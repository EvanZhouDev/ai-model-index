import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TOP_N = 10;
const SOURCE = {
  name: "Artificial Analysis",
  url: "https://artificialanalysis.ai/",
};

const LLM_METRICS = [
  {
    modality: "llm",
    metric: "aa-intelligence",
    sourceMetric: "artificial_analysis_intelligence_index",
    outputPath: "data/llm/aa-intelligence.json",
  },
  {
    modality: "llm",
    metric: "aa-coding",
    sourceMetric: "artificial_analysis_coding_index",
    outputPath: "data/llm/aa-coding.json",
  },
  {
    modality: "llm",
    metric: "aa-math",
    sourceMetric: "artificial_analysis_math_index",
    outputPath: "data/llm/aa-math.json",
  },
  {
    modality: "llm",
    metric: "mmlu-pro",
    sourceMetric: "mmlu_pro",
    outputPath: "data/llm/mmlu-pro.json",
  },
  {
    modality: "llm",
    metric: "gpqa",
    sourceMetric: "gpqa",
    outputPath: "data/llm/gpqa.json",
  },
  {
    modality: "llm",
    metric: "hle",
    sourceMetric: "hle",
    outputPath: "data/llm/hle.json",
  },
  {
    modality: "llm",
    metric: "livecodebench",
    sourceMetric: "livecodebench",
    outputPath: "data/llm/livecodebench.json",
  },
  {
    modality: "llm",
    metric: "scicode",
    sourceMetric: "scicode",
    outputPath: "data/llm/scicode.json",
  },
  {
    modality: "llm",
    metric: "math-500",
    sourceMetric: "math_500",
    outputPath: "data/llm/math-500.json",
  },
  {
    modality: "llm",
    metric: "aime",
    sourceMetric: "aime",
    outputPath: "data/llm/aime.json",
  },
];

const MEDIA_DATASETS = [
  {
    modality: "image-editing",
    metric: "elo",
    endpoint: "data/media/image-editing",
    includeCategories: false,
    outputPath: "data/image-editing/elo.json",
  },
  {
    modality: "text-to-image",
    metric: "elo",
    endpoint: "data/media/text-to-image",
    includeCategories: true,
    outputPath: "data/text-to-image/elo.json",
  },
  {
    modality: "text-to-speech",
    metric: "elo",
    endpoint: "data/media/text-to-speech",
    includeCategories: true,
    outputPath: "data/text-to-speech/elo.json",
  },
  {
    modality: "text-to-video",
    metric: "elo",
    endpoint: "data/media/text-to-video",
    includeCategories: true,
    outputPath: "data/text-to-video/elo.json",
  },
  {
    modality: "image-to-video",
    metric: "elo",
    endpoint: "data/media/image-to-video",
    includeCategories: true,
    outputPath: "data/image-to-video/elo.json",
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function numericScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function makeBasePayload({ generatedAt, modality, metric, sourceMetric }) {
  return {
    generated_at: generatedAt,
    limit: TOP_N,
    modality,
    metric,
    ...(sourceMetric ? { source_metric: sourceMetric } : {}),
    source: SOURCE,
    models: [],
  };
}

function sortByScoreDesc(a, b) {
  return b.score - a.score;
}

function mapLlmModel(model, sourceMetric) {
  const score = numericScore(model?.evaluations?.[sourceMetric]);
  if (score === null) {
    return null;
  }

  return {
    name: model.name,
    slug: model.slug,
    creator: model?.model_creator?.name ?? null,
    score,
  };
}

function mapCategory(category) {
  const score = numericScore(category?.elo);
  if (score === null) {
    return null;
  }

  return {
    ...(category.style_category ? { style: category.style_category } : {}),
    ...(category.subject_matter_category
      ? { subject: category.subject_matter_category }
      : {}),
    ...(category.format_category ? { format: category.format_category } : {}),
    score,
    ...(category.ci95 ? { ci95: category.ci95 } : {}),
  };
}

function mapMediaModel(model) {
  const score = numericScore(model?.elo);
  if (score === null) {
    return null;
  }

  const categories = Array.isArray(model.categories)
    ? model.categories.map(mapCategory).filter(Boolean)
    : [];

  return {
    name: model.name,
    slug: model.slug,
    creator: model?.model_creator?.name ?? null,
    score,
    ...(typeof model.rank === "number" ? { rank: model.rank } : {}),
    ...(model.ci95 ? { ci95: model.ci95 } : {}),
    ...(categories.length > 0 ? { category_distribution: categories } : {}),
  };
}

function finalizeRanks(models) {
  return models.map((model, index) => ({
    rank: index + 1,
    ...model,
  }));
}

async function requestJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
    };
  }

  return {
    ok: true,
    json: await response.json(),
  };
}

async function fetchJson(relativePath, includeCategories) {
  const apiKey = process.env.AA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing AA_API_KEY");
  }

  const url = new URL(`https://artificialanalysis.ai/api/v2/${relativePath}`);
  if (includeCategories) {
    url.searchParams.set("include_categories", "true");
  }

  const result = await requestJson(url, apiKey);
  if (result.ok) {
    return result.json;
  }

  if (includeCategories && result.status >= 400 && result.status < 500) {
    const fallbackUrl = new URL(`https://artificialanalysis.ai/api/v2/${relativePath}`);
    const fallbackResult = await requestJson(fallbackUrl, apiKey);
    if (fallbackResult.ok) {
      return fallbackResult.json;
    }
  }

  throw new Error(
    `Request failed for ${url}: ${result.status ?? "unknown"} ${result.statusText ?? ""}`.trim(),
  );
}

async function writeJson(relativePath, payload) {
  const filePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildLlmPayload(data, config, generatedAt) {
  const models = (Array.isArray(data) ? data : [])
    .map((model) => mapLlmModel(model, config.sourceMetric))
    .filter(Boolean)
    .sort(sortByScoreDesc)
    .slice(0, TOP_N);

  return {
    ...makeBasePayload({
      generatedAt,
      modality: config.modality,
      metric: config.metric,
      sourceMetric: config.sourceMetric,
    }),
    models: finalizeRanks(models),
  };
}

function buildMediaPayload(data, config, generatedAt) {
  const models = (Array.isArray(data) ? data : [])
    .map(mapMediaModel)
    .filter(Boolean)
    .sort(sortByScoreDesc)
    .slice(0, TOP_N);

  return {
    ...makeBasePayload({
      generatedAt,
      modality: config.modality,
      metric: config.metric,
    }),
    models: finalizeRanks(models),
  };
}

function buildIndexPayload(generatedAt) {
  return {
    generated_at: generatedAt,
    limit: TOP_N,
    source: SOURCE,
    datasets: [
      ...LLM_METRICS.map((config) => ({
        modality: config.modality,
        metric: config.metric,
        path: config.outputPath,
      })),
      ...MEDIA_DATASETS.map((config) => ({
        modality: config.modality,
        metric: config.metric,
        path: config.outputPath,
      })),
    ],
  };
}

async function initEmptyData() {
  const generatedAt = new Date().toISOString();

  for (const config of LLM_METRICS) {
    await writeJson(
      config.outputPath,
      makeBasePayload({
        generatedAt,
        modality: config.modality,
        metric: config.metric,
        sourceMetric: config.sourceMetric,
      }),
    );
  }

  for (const config of MEDIA_DATASETS) {
    await writeJson(
      config.outputPath,
      makeBasePayload({
        generatedAt,
        modality: config.modality,
        metric: config.metric,
      }),
    );
  }

  await writeJson("data/index.json", buildIndexPayload(generatedAt));
}

async function syncData() {
  const generatedAt = new Date().toISOString();

  const llmResponse = await fetchJson("data/llms/models", false);
  const llmData = Array.isArray(llmResponse?.data) ? llmResponse.data : [];

  for (const config of LLM_METRICS) {
    await writeJson(config.outputPath, buildLlmPayload(llmData, config, generatedAt));
  }

  for (const config of MEDIA_DATASETS) {
    const response = await fetchJson(config.endpoint, config.includeCategories);
    const data = Array.isArray(response?.data) ? response.data : [];
    await writeJson(config.outputPath, buildMediaPayload(data, config, generatedAt));
  }

  await writeJson("data/index.json", buildIndexPayload(generatedAt));
}

async function main() {
  if (process.argv.includes("--init-empty")) {
    await initEmptyData();
    return;
  }

  await syncData();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
