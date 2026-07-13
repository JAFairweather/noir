# Nave — the ecosystem hub (nave.pub)

Self-contained static landing page for the NIP-DA ecosystem: the thesis
(Identity = Freedom), the protocol case, the eight app cards with the
shared seal-icon system, and the maker links. No build step, no external
resources — one `index.html` with inline CSS and inline SVG.

## Deploy (Cloudflare Pages)

- **Project → Pages → Connect the `noir` repo.**
- **Build command:** *(none)*
- **Build output directory:** `nave`
- **Custom domain:** `nave.pub` (apex) — needs Cloudflare DNS (apex CNAME
  flattening onto Pages), i.e. move `nave.pub`'s nameservers from Hover
  to Cloudflare first.

Once live, the hub links to each app's subdomain as they roll out.
