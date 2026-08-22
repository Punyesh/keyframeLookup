# KeyFrame Lookup

A small in-browser tool for looking up animation staff on [KeyFrame Staff List](https://keyframe-staff-list.com) by name, and viewing their full credit history grouped by role (Key Animation, Animation Director, Storyboard, etc.) — expandable per role, with cover art, year, and episode info for each work. If a name matches multiple people, you're prompted to pick the right one (or skip it) instead of it silently guessing.

It runs entirely inside your own browser tab as a bookmarklet or console script — no server, no installation, no dependencies.

https://github.com/user-attachments/assets/914648ed-193e-4bf1-84e2-4ba2568f012c

## Install (30 seconds)

**[punyesh.github.io/keyframeLookup](https://punyesh.github.io/keyframeLookup/)**

Open that page and drag the amber button on it to your bookmarks bar. That's it — no extension install, no permissions prompt.

<details>
<summary>Alternative: manual copy-paste (if the link above ever goes down)</summary>

1. Copy the contents of <a href="./keyframe_panel.js">keyframe_panel.js</a>.
2. In your browser, right-click your bookmarks bar → **Add page** (Chrome) or **New Bookmark** (other browsers).
3. Give it any name, e.g. `KeyFrame Lookup`.
4. Paste `javascript:eval(decodeURIComponent(escape(window.atob("<base64 of the file>"))))` into the URL field — or just paste the raw script into your browser's DevTools Console (F12) on keyframe-staff-list.com instead, which works without making a bookmark at all.

</details>

## Use it

1. Go to [keyframe-staff-list.com](https://keyframe-staff-list.com) and let the page load normally.
2. Click your new bookmark. A small panel appears — drag it anywhere by its header.
3. Type or paste names, one per line or comma-separated.
4. Click **Run lookup**. Progress logs in the panel as it works through your list. If a name matches more than one person, the panel pauses and shows you the candidates to pick from (or a Skip button).
5. When it's done, click **View Results** for a full formatted page (grouped by role with cover art, click a role to expand it), or **Download JSON** for the raw data.

Already-looked-up names are cached in memory for the session — adding a name to your list and re-running won't re-fetch names you already have.

## Alternative: paste into console

If you'd rather not use a bookmarklet, open [keyframe_panel.js](./keyframe_panel.js), copy its contents, open DevTools (F12) → Console on keyframe-staff-list.com, paste, and press Enter. Same tool, same result — just requires opening DevTools each time instead of one click.

## Why the delay between names

KeyFrame Staff List's own [scraping policy](https://keyframe-staff-list.com/scraping) permits looking up specific individuals for personal use, but asks that request volume stay reasonable. This tool waits a few seconds between each name accordingly — please don't remove that if you modify this.

## Credit

All data comes from [KeyFrame Staff List](https://keyframe-staff-list.com), built and maintained by its contributors. If you use data pulled with this tool anywhere public, please credit them.

## Changelog

- **Grid view** — a **☰ List** / **▦ Grid** toggle on the results page. Grid view shows one poster card per anime (cover art, title, year) with all of the roles on that work as pills underneath, each showing its episode numbers — alongside the original role-first list view.
- **Studios** — studios that show up alongside people in search results are now tagged `[Studio]` in the picker instead of being filtered out or silently causing an error if picked.
- **Cover art + name disambiguation** — each work now shows its cover image; names matching multiple people prompt you to pick one instead of guessing.
- **Initial release** — bookmarklet/console tool, results grouped by role, JSON export.
