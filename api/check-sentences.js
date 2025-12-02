// api/check-sentences.js

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { sentences } = req.body || {};

  // sentences is expected to be an object like:
  // { s1: "text...", s2: "text...", s3: "text..." }

  if (!sentences) {
    res.status(400).json({ error: "No sentences provided" });
    return;
  }

  // configuration for each sentence task
  const configs = {
    s1: { minWords: 8, requiredWords: ["because"], requireConditional: false },
    s2: { minWords: 8, requiredWords: ["although"], requireConditional: false },
    s3: { minWords: 10, requiredWords: [], requireConditional: true }
  };

  function cleanText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreOne(id, text) {
    const cfg = configs[id];
    if (!cfg) {
      return {
        score: 0,
        messages: ["No configuration found for this sentence."]
      };
    }

    const cleaned = cleanText(text);
    if (!cleaned) {
      return {
        score: 0,
        messages: ["❗ Please write a sentence."]
      };
    }

    const words = cleaned.split(" ").filter(Boolean);
    let score = 0;
    const messages = [];

    // 1) word count
    if (words.length >= cfg.minWords) {
      score += 2;
      messages.push(`✅ Good length (${words.length} words).`);
    } else if (words.length >= Math.floor(cfg.minWords / 2)) {
      score += 1;
      messages.push(
        `⚠️ A bit short (${words.length} words). Try to add more detail.`
      );
    } else {
      messages.push(
        `❌ Too short (${words.length} words). Try to write a longer sentence.`
      );
    }

    // 2) required words (because / although / etc.)
    if (cfg.requiredWords && cfg.requiredWords.length > 0) {
      let hasRequired = false;
      for (const w of cfg.requiredWords) {
        if (cleaned.includes(w)) {
          hasRequired = true;
          break;
        }
      }
      if (hasRequired) {
        score += 2;
        messages.push("✅ You used the target word/structure.");
      } else {
        messages.push(
          "❌ You didn’t use the target word. Try to include: " +
            cfg.requiredWords.join(", ")
        );
      }
    }

    // 3) second conditional (if + would)
    if (cfg.requireConditional) {
      if (cleaned.includes("if") && cleaned.includes("would")) {
        score += 1;
        messages.push("✅ It looks like a second conditional sentence.");
      } else {
        messages.push(
          "❌ Use 'if' + past and 'would' + verb for the second conditional."
        );
      }
    }

    // 4) punctuation (check raw text, not cleaned)
    const raw = String(text || "").trim();
    if (raw && /[.?!]$/.test(raw)) {
      score += 1;
      messages.push("✅ Good punctuation at the end.");
    } else {
      messages.push("⚠️ Add a full stop or question mark at the end.");
    }

    if (score > 5) score = 5;

    // choose an overall label
    let level = "error";
    if (score >= 4) level = "ok";
    else if (score >= 2) level = "warn";

    return { score, messages, level };
  }

  const result = {};
  let total = 0;
  let maxTotal = 0;

  for (const key of Object.keys(configs)) {
    const r = scoreOne(key, sentences[key] || "");
    result[key] = r;
    total += r.score;
    maxTotal += 5;
  }

  const percent = maxTotal ? Math.round((total / maxTotal) * 100) : 0;

  res.status(200).json({
    scores: result,
    total,
    maxTotal,
    percent
  });
}
