/**
 * Web search utilities — Baidu primary, fallback chain for resilience.
 * 百度搜索对中文内容（考研院校、分数线、真题等）覆盖最好，国内部署畅通。
 * 不需要任何 API Key。
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search the web. Priority:
 * 1. Baidu (free, best Chinese coverage, no key needed) ← 主力
 * 2. SerpAPI with Baidu engine (if SEARCH_API_KEY is configured) ← 更稳定的备选
 * 3. DuckDuckGo (last resort, limited Chinese support)
 */
export async function searchWeb(
  query: string,
  maxResults = 10
): Promise<SearchResult[]> {
  // Try SerpAPI first if configured (more reliable, still Baidu-backed)
  const serpApiKey = process.env.SEARCH_API_KEY;
  if (serpApiKey) {
    try {
      return await searchSerpAPI(query, maxResults, serpApiKey);
    } catch {
      // Fall through to Baidu
    }
  }

  // Primary: Baidu HTML search (best Chinese results, works on domestic servers)
  const results = await searchBaidu(query, maxResults);
  if (results.length > 0) return results;

  // Last resort: DuckDuckGo
  return searchDuckDuckGo(query, maxResults);
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

// ── Baidu search ──────────────────────────────────────────

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
  let text = html
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
