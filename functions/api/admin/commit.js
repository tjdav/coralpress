export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { title, slug, content, mode } = await request.json();

    if (!slug) {
      return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400 });
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: "Invalid slug format" }), { status: 400 });
    }

    // Base64 encode the content safely using Node's Buffer API
    const encodedContent = Buffer.from(content, 'utf-8').toString('base64');
    const path = `website/src/pages/blog/${slug}.html`;

    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const REPO_OWNER = env.REPO_OWNER;
    const REPO_NAME = env.REPO_NAME;

    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return new Response(JSON.stringify({ error: "Missing GitHub environment variables" }), { status: 500 });
    }

    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    // If it's an edit mode or we need to update, we must provide the file's current SHA.
    // To keep it simple, we'll try to fetch the existing file's SHA first.
    let sha = undefined;
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-CMS'
      }
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      if (mode === 'create') {
        return new Response(JSON.stringify({ error: "File already exists. Use edit mode to update." }), { status: 409 });
      }
    } else if (getRes.status === 404 && mode === 'edit') {
      return new Response(JSON.stringify({ error: "File not found for editing." }), { status: 404 });
    } else if (!getRes.ok && getRes.status !== 404) {
      const err = await getRes.text();
      return new Response(JSON.stringify({ error: `Failed to fetch existing file: ${err}` }), { status: 500 });
    }

    const payload = {
      message: `${mode === 'create' ? 'Create' : 'Update'} blog post: ${slug}`,
      content: encodedContent,
    };

    if (sha) {
      payload.sha = sha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages-CMS'
      },
      body: JSON.stringify(payload)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return new Response(JSON.stringify({ error: "Failed to commit to GitHub", details: errText }), { status: 500 });
    }

    const result = await putRes.json();
    return new Response(JSON.stringify({ success: true, commit: result.commit.sha }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}
