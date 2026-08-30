export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;
    const ORIGIN = "https://auto-forge-7dq.pages.dev";

    // today.af.uft1.com → redirect to newest done project (from status.json)
    if (host === "today.af.uft1.com") {
      try {
        const s = await fetch(ORIGIN + "/status.json");
        if (s.ok) {
          const j = await s.json();
          const latest = [...j.projects].reverse().find(p=>p.status==="done") || j.projects[j.projects.length-1];
          if (latest) {
            return Response.redirect(`https://${latest.slug}.af.uft1.com/`, 302);
          }
        }
      } catch {}
      return fetch(ORIGIN + "/", request);
    }

    // af.uft1.com → gallery
    if (host === "af.uft1.com") {
      return fetch(ORIGIN + url.pathname + url.search, request);
    }

    // *.af.uft1.com → /p/<slug>/
    if (host.endsWith(".af.uft1.com")) {
      let slug = host.replace(".af.uft1.com", "");
      if (slug === "today") {
        // handled above, but fallback
        return Response.redirect(`https://today.af.uft1.com/`, 302);
      }
      if (slug.endsWith("-af")) slug = slug.slice(0, -3);
      if (slug === "www" || slug === "") slug = "";
      if (!slug) return fetch(ORIGIN + "/", request);

      let targetPath = url.pathname;
      if (targetPath === "/" || targetPath === "") targetPath = `/p/${slug}/`;
      else if (!targetPath.startsWith(`/p/${slug}`) && !targetPath.startsWith("/p/")) {
        targetPath = `/p/${slug}${targetPath}`;
      }
      const target = ORIGIN + targetPath + url.search;
      let res = await fetch(target, request);
      if (res.status === 404 && targetPath.startsWith("/p/")) {
        // check if needs-iteration badge should be shown instead of 404
        res = new Response(
          `Project "${slug}" not found or still building. Check https://af.uft1.com for gallery.\nTried: ${targetPath}\nTry: https://today.af.uft1.com for latest.`,
          { status: 404, headers: { "content-type": "text/plain" } }
        );
      }
      // inject toolbar into HTML responses (browseable feed)
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        let html = await res.text();
        // inject prev/next/back toolbar if not already present
        if (!html.includes("af-toolbar")) {
          const toolbar = `<style>#af-toolbar{position:fixed;top:0;left:0;right:0;background:#111119ee;border-bottom:1px solid #222;display:flex;gap:8px;align-items:center;padding:8px 12px;font:12px system-ui;z-index:9999;backdrop-filter:blur(8px)}#af-toolbar a{color:#8ab4ff;text-decoration:none;border:1px solid #222;border-radius:999px;padding:4px 10px;background:#1a1a2a}#af-toolbar a:hover{border-color:#8ab4ff}body{padding-top:42px!important}</style><div id="af-toolbar"><a href="https://af.uft1.com">← gallery</a><a href="https://today.af.uft1.com">today</a><span style="margin-left:auto;opacity:.6">${slug}</span><a href="https://af.uft1.com/status.json" target="_blank">status</a></div>`;
          html = html.replace(/<body[^>]*>/i, (m)=> m + toolbar);
          return new Response(html, { status: res.status, headers: { ...Object.fromEntries(res.headers), "content-type": "text/html; charset=utf-8" } });
        }
      }
      return res;
    }

    return fetch(ORIGIN + url.pathname + url.search, request);
  }
};
