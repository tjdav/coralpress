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

    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const REPO_OWNER = env.REPO_OWNER;
    const REPO_NAME = env.REPO_NAME;

    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return new Response(JSON.stringify({ error: "Missing GitHub environment variables" }), { status: 500 });
    }

    // 1. Update src/data/content.json
    const dataPath = `website/src/data/content.json`;
    const dataApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${dataPath}`;

    let dataSha = undefined;
    let contentData = {};

    const getDataRes = await fetch(dataApiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-CMS'
      }
    });

    if (getDataRes.ok) {
      const fileData = await getDataRes.json();
      dataSha = fileData.sha;
      const decodedData = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
      contentData = JSON.parse(decodedData);
    } else if (getDataRes.status !== 404) {
      const err = await getDataRes.text();
      return new Response(JSON.stringify({ error: `Failed to fetch existing data file: ${err}` }), { status: 500 });
    }

    const pagePath = `blog/${slug}.html`;
    
    if (mode === 'create' && contentData[pagePath]) {
      return new Response(JSON.stringify({ error: "Post already exists. Use edit mode to update." }), { status: 409 });
    }
    
    if (mode === 'edit' && !contentData[pagePath]) {
      return new Response(JSON.stringify({ error: "Post not found for editing." }), { status: 404 });
    }

    contentData[pagePath] = {
      metadata: {
        title: title
      },
      content: content
    };

    // Note: btoa in Cloudflare Workers doesn't support unicode perfectly, but since we are encoding ascii JSON string, it's fine.
    // To handle unicode safely, we use encodeURIComponent.
    const encodedDataContent = btoa(unescape(encodeURIComponent(JSON.stringify(contentData, null, 2))));

    const dataPayload = {
      message: `${mode === 'create' ? 'Create' : 'Update'} data for post: ${slug}`,
      content: encodedDataContent,
    };

    if (dataSha) {
      dataPayload.sha = dataSha;
    }

    const putDataRes = await fetch(dataApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages-CMS'
      },
      body: JSON.stringify(dataPayload)
    });

    if (!putDataRes.ok) {
      const errText = await putDataRes.text();
      return new Response(JSON.stringify({ error: "Failed to commit data file to GitHub", details: errText }), { status: 500 });
    }

    // Commit the HTML template to src/pages/blog/${slug}.html
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <post-content page-path="${pagePath}"></post-content>
</body>
</html>`;

    const htmlPath = `website/src/pages/blog/${slug}.html`;
    const htmlApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${htmlPath}`;

    let htmlSha = undefined;

    const getHtmlRes = await fetch(htmlApiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-CMS'
      }
    });

    if (getHtmlRes.ok) {
      const fileData = await getHtmlRes.json();
      htmlSha = fileData.sha;
    }

    const encodedHtmlContent = btoa(unescape(encodeURIComponent(htmlContent)));

    const htmlPayload = {
      message: `${mode === 'create' ? 'Create' : 'Update'} HTML template for post: ${slug}`,
      content: encodedHtmlContent,
    };

    if (htmlSha) {
      htmlPayload.sha = htmlSha;
    }

    const putHtmlRes = await fetch(htmlApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages-CMS'
      },
      body: JSON.stringify(htmlPayload)
    });

    if (!putHtmlRes.ok) {
      const errText = await putHtmlRes.text();
      return new Response(JSON.stringify({ error: "Failed to commit HTML file to GitHub", details: errText }), { status: 500 });
    }

    const result = await putDataRes.json();
    return new Response(JSON.stringify({ success: true, commit: result.commit.sha }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}
