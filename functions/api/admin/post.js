export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400 });
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: "Invalid slug format" }), { status: 400 });
    }

    const path = `website/src/pages/blog/${slug}.html`;

    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const REPO_OWNER = env.REPO_OWNER;
    const REPO_NAME = env.REPO_NAME;

    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return new Response(JSON.stringify({ error: "Missing GitHub environment variables" }), { status: 500 });
    }

    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    const res = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-CMS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
      }
      const err = await res.text();
      return new Response(JSON.stringify({ error: `GitHub API Error: ${err}` }), { status: res.status });
    }

    const fileData = await res.json();
    
    // GitHub contents API returns base64 encoded content
    const decodedContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // Return the raw content, assuming we extract title/content on the client or the file includes it
    return new Response(JSON.stringify({ 
      slug: slug,
      content: decodedContent 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}
