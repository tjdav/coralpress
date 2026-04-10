export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Use a path starting without 'website/' if we assume the repo root is the current directory of the website
    // Checking how commit.js did it: path = `website/src/pages/blog/${slug}.html`;
    // So the structure might be the website is in a subfolder called "website" within the repo
    const path = `website/src/scss/_variables.scss`;

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
        return new Response(JSON.stringify({ content: "" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const err = await res.text();
      return new Response(JSON.stringify({ error: `GitHub API Error: ${err}` }), { status: res.status });
    }

    const fileData = await res.json();
    const decodedContent = atob(fileData.content);

    return new Response(JSON.stringify({ 
      content: decodedContent 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { variables } = await request.json(); // Object of { primary: '#123456', secondary: '#abcdef', ... }

    const path = `website/src/scss/_variables.scss`;

    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const REPO_OWNER = env.REPO_OWNER;
    const REPO_NAME = env.REPO_NAME;

    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return new Response(JSON.stringify({ error: "Missing GitHub environment variables" }), { status: 500 });
    }

    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    let sha = undefined;
    let currentContent = "";

    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages-CMS'
      }
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      currentContent = atob(fileData.content);
    } else if (!getRes.ok && getRes.status !== 404) {
      const err = await getRes.text();
      return new Response(JSON.stringify({ error: `Failed to fetch existing file: ${err}` }), { status: 500 });
    }

    // Now update the variables in the content
    let newContent = currentContent;

    for (const [key, value] of Object.entries(variables)) {
      if (value) {
        // Validate hex color code
        if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) {
          return new Response(JSON.stringify({ error: `Invalid color format for ${key}: ${value}` }), { status: 400 });
        }
        
        const regex = new RegExp(`^\\$${key}:\\s*[^;]+;`, 'm');
        if (regex.test(newContent)) {
          // Replace existing
          newContent = newContent.replace(regex, `$${key}: ${value};`);
        } else {
          // Append
          newContent += `\n$${key}: ${value};`;
        }
      }
    }

    // Base64 encode the new content using btoa
    const encodedContent = btoa(newContent);

    const payload = {
      message: `Update Bootstrap variables`,
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

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}
