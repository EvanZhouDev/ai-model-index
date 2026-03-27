# ai-model-index

A GitHub repo that automatically updates every day with derived top-10 benchmark leaderboards powered by Artificial Analysis.

## Layout

Users can fetch files directly from GitHub raw:

```
https://raw.githubusercontent.com/EvanZhouDev/ai-model-index/main/data/<type>/<category>.json
```

For example:

```
https://raw.githubusercontent.com/EvanZhouDev/ai-model-index/main/data/llm/aa-intelligence.json
```

All the model Types and index Categories are available here:

```text
data/
  index.json
  llm/
    aa-intelligence.json
    aa-coding.json
    aa-math.json
    mmlu-pro.json
    gpqa.json
    hle.json
    livecodebench.json
    scicode.json
    math-500.json
    aime.json
  image-editing/
    elo.json
  text-to-image/
    elo.json
  text-to-speech/
    elo.json
  text-to-video/
    elo.json
  image-to-video/
    elo.json
```

You can always inspect the `/data` folder to view what data you will get.

For more information on how this data and ranking is obtained, see [Artificial Analysis API Documentation](https://artificialanalysis.ai/api-reference).

## Manually updating data

For local testing:

```bash
AA_API_KEY=your_key_here npm run sync
```

To seed empty files without a key:

```bash
npm run init:data
```

`raw.githubusercontent.com` is enough for app fetches. If you want cleaner public URLs later, enable GitHub Pages and serve the same `/data` tree from there.

## Auto-Refresh

Auto-refreshes occur at 7:17 UTC to avoid pileups at :00.