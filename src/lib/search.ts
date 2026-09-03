/**
 * Web search utilities — Bing China primary, fallback chain for resilience.
 * 必应中国（cn.bing.com）对中文内容覆盖好、HTML 结构稳定可解析、无严格反爬（实测可用）。
 * 百度 HTML 搜索已降级为备选（对非浏览器请求常返回无结果的安全页，解析不稳定）。
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search the web. Priority:
 * 1. SerpAPI with Baidu engine (if SEARCH_API_KEY is configured) ← 可选付费备选
 * 2. Tavily (if TAVILY_API_KEY is configured) ← 推荐：免费 1000 次/月，中文效果好，结构化 JSON
 * 3. Bing China (free, stable HTML) ← 免费兜底（中文分词差，相关性一般）
 * 4. Baidu / DuckDuckGo (last resort)
 *
 * opts.mustInclude：核心词（院校名/专业名）。不丢弃结果，而是**按命中数评分排序**——
 * 相关结果排前、无关沉底，AI 提取时先取前面的结果，保证有内容可用且相关优先。
 */
export async function searchWeb(
  query: string,
  maxResults = 10,
  opts: { mustInclude?: string[] } = {}
): Promise<SearchResult[]> {
  // Try SerpAPI first if configured (more reliable, still Baidu-backed)
  const serpApiKey = process.env.SEARCH_API_KEY;
  if (serpApiKey) {
    try {
      return await searchSerpAPI(query, maxResults, serpApiKey);
    } catch {
      // Fall through
    }
  }

  // Tavily (recommended: free 1000 req/mo, good Chinese support)
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey && !tavilyKey.startsWith("your_")) {
    const tavilyResults = sortByKeywords(await searchTavily(query, maxResults, tavilyKey), opts.mustInclude);
    if (tavilyResults.length > 0) return tavilyResults;
  }

  // Primary free fallback: Bing China (stable HTML, mediocre Chinese relevance)
  const bingResults = sortByKeywords(await searchBing(query, maxResults), opts.mustInclude);
  if (bingResults.length > 0) return bingResults;

  // Fallback: Baidu HTML search (best Chinese coverage when it works)
  const baiduResults = sortByKeywords(await searchBaidu(query, maxResults), opts.mustInclude);
  if (baiduResults.length > 0) return baiduResults;

  // Last resort: DuckDuckGo
  return sortByKeywords(await searchDuckDuckGo(query, maxResults), opts.mustInclude);
}

// ── Tavily (recommended search API, requires TAVILY_API_KEY) ──

async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: Math.min(maxResults, 8),
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    return (data.results || [])
      .filter((r) => r.url && r.title)
      .map((r) => ({
        title: String(r.title),
        url: String(r.url),
        snippet: String(r.content || "").slice(0, 300),
      }));
  } catch {
    return [];
  }
}

/** 相关性评分排序：标题/URL 命中核心词越多越靠前（子串匹配，容忍简称差异）；不做硬过滤 */
function sortByKeywords(results: SearchResult[], keywords?: string[]): SearchResult[] {
  if (!keywords || keywords.length === 0) return results;
  const kws = keywords.map((k) => k.trim()).filter((k) => k && k.length >= 2);
  if (kws.length === 0) return results;
  return [...results].sort((a, b) => scoreOf(b, kws) - scoreOf(a, kws));
}

function scoreOf(r: SearchResult, kws: string[]): number {
  const text = `${r.title} ${r.url}`;
  return kws.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0);
}

// ── Invalid result filter ─────────────────────────────────

const BLOCKED_DOMAINS = [
  "baidu.com", "hao123.com", "iqiyi.com", "yy.com", "qianqian.com",
  "nuomi.com", "tieba.baidu.com", "zhidao.baidu.com", "wenku.baidu.com",
  "baike.baidu.com", "map.baidu.com", "image.baidu.com", "video.baidu.com",
  "pan.baidu.com", "yun.baidu.com", "jiaoyu.baidu.com", "top.baidu.com",
  "news.baidu.com", "fanyi.baidu.com", "transmart.baidu.com",
  // 非教育类聚合/导航站
  "so.com", "sogou.com", "sm.cn", "chongbuluo.com",
  // 广告/推广域名常见模式在 URL 参数里，靠下面的关键词过滤
];

const BLOCKED_TITLE_WORDS = [
  "百度", "hao123", "导航", "推广", "广告", "爱奇艺", "直播",
  "百度一下", "下一页", "上一页", "登录", "注册", "免费",
  "上网导航", "图片", "视频", "地图", "文库", "百科", "贴吧",
  "网盘", "翻译", "音乐", "游戏", "下载", "天气", "日历",
  "银行", "充值", "彩票", "股票", "基金", "保险", "房产",
  "招聘", "交友", "旅游", "购物", "优惠", "秒杀",
];

function isValidResult(url: string, title: string): boolean {
  // URL 检查
  if (!url.startsWith("http")) return false;
  if (BLOCKED_DOMAINS.some((d) => url.includes(d))) return false;

  // 标题检查
  if (title.length < 6) return false; // 太短大概率是导航链接
  if (title.length > 200) return false; // 太长不是标题
  if (BLOCKED_TITLE_WORDS.some((w) => title.includes(w))) return false;

  // 标题中必须有中文字符（排除纯英文/数字的 URL 标题）
  if (!/[一-鿿]/.test(title)) return false;

  return true;
}

// ── Bing China search (primary, stable) ─────────────────

async function searchBing(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const url = new URL("https://cn.bing.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    url.searchParams.set("setlang", "zh-CN");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return [];
    const html = await response.text();
    return parseBingResults(html, maxResults);
  } catch {
    return [];
  }
}

function parseBingResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // 必应结果块：<li class="b_algo">…<h2><a href="URL">TITLE</a></h2>…<p>SNIPPET</p>…</li>
  const algoRegex = /<li class="b_algo"[\s\S]*?<\/li>/g;
  let match: RegExpExecArray | null;
  while ((match = algoRegex.exec(html)) !== null && results.length < maxResults) {
    const block = match[0];
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const url = linkMatch[1];
    const title = cleanBingEntities(linkMatch[2].replace(/<[^>]+>/g, "").trim());
    if (!isValidResult(url, title)) continue;
    if (seen.has(url)) continue;
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snippetMatch
      ? cleanBingEntities(snippetMatch[1].replace(/<[^>]+>/g, "").trim())
      : "";
    seen.add(url);
    results.push({ title, url, snippet: snippet || title });
  }

  return results;
}

function cleanBingEntities(text: string): string {
  return text
    .replace(/&ensp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0183;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

// ── Baidu search (fallback) ──────────────────────────

async function searchBaidu(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    return parseBaiduResults(html, maxResults);
  } catch {
    return [];
  }
}

function parseBaiduResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  function add(title: string, url: string, snippet: string) {
    if (results.length >= maxResults || seen.has(url)) return;
    if (!isValidResult(url, title)) return;
    seen.add(url);
    results.push({ title, url, snippet });
  }

  // Strategy 1: Baidu organic results — <h3 class="t"> or <h3 class="c-title">
  // Surrounding HTML: <h3 class="t c-gap-top..."><a href="REAL_URL" ...>TITLE</a></h3>
  // followed by <div class="c-abstract">SNIPPET</div> or <span class="content-right_...">
  const h3Regex =
    /<h3[^>]*class="[^"]*c-title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>|<span[^>]*class="[^"]*(?:content-right|hint|newTimeFactor)[^"]*"[^>]*>([\s\S]*?)<\/span>)/gi;

  let match;
  while ((match = h3Regex.exec(html)) !== null) {
    const url = cleanBaiduRedirect(match[1]);
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    const snippetRaw = (match[3] || match[4] || "").replace(/<\/?em>/g, "");
    const snippet = snippetRaw.replace(/<[^>]+>/g, "").trim();
    add(title, url, snippet || title);
  }

  // Strategy 2: any <h3> containing an <a> with a real external URL
  if (results.length === 0) {
    const h3AnyRegex = /<h3[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi;
    while ((match = h3AnyRegex.exec(html)) !== null) {
      const url = cleanBaiduRedirect(match[1]);
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      // Find snippet in subsequent ~500 chars
      const afterIdx = match.index + match[0].length;
      const after = html.slice(afterIdx, afterIdx + 800);
      const snippetMatch = /<span[^>]*>([^<]{15,})<\/span>/i.exec(after);
      add(title, url, snippetMatch ? snippetMatch[1].trim().replace(/<\/?em>/g, "") : title);
    }
  }

  // Strategy 3 (last resort, strict): className-less links in result-like blocks
  if (results.length === 0) {
    const blockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    while ((match = blockRegex.exec(html)) !== null) {
      const block = match[1];
      const linkMatch = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]{6,})<\/a>/i.exec(block);
      if (linkMatch) {
        add(linkMatch[2].trim(), cleanBaiduRedirect(linkMatch[1]), "");
      }
    }
  }

  return results;
}

// Baidu wraps external links with a redirect: https://www.baidu.com/link?url=...
function cleanBaiduRedirect(rawUrl: string): string {
  if (rawUrl.includes("baidu.com/link?url=")) {
    try {
      const u = new URL(rawUrl);
      const target = u.searchParams.get("url");
      if (target) return decodeURIComponent(target);
    } catch {
      // cannot parse, fall through
    }
  }
  return rawUrl;
}

// ── SerpAPI (optional, requires SEARCH_API_KEY) ──────────

async function searchSerpAPI(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("engine", "baidu");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(maxResults));

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`SerpAPI ${response.status}`);

  const data = await response.json();
  const organic = data.organic_results || [];

  return organic.slice(0, maxResults).map((r: Record<string, unknown>) => ({
    title: String(r.title || ""),
    url: String(r.link || ""),
    snippet: String(r.snippet || ""),
  }));
}

// ── DuckDuckGo (last resort) ─────────────────────────────

async function searchDuckDuckGo(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);
    url.searchParams.set("kl", "cn-zh");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];
    const html = await response.text();
    return parseDDGResults(html, maxResults);
  } catch {
    return [];
  }
}

function parseDDGResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const regex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = regex.exec(html)) !== null && results.length < maxResults) {
    const url = decodeURIComponent(match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, ""));
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    const snippet = match[3].replace(/<[^>]+>/g, "").trim();
    if (title && snippet && url.startsWith("http")) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

// ── Page content fetching ────────────────────────────────

/**
 * Fetch and extract text content from a web page
 */
export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return "";

    const html = await response.text();
    return stripHtml(html).slice(0, 10000);
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/&hellip;/g, "...")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}
