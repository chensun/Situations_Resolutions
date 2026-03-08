# GitHub Pages App

This folder contains the preferred static GitHub Pages rewrite.

## Contents

- [index.html](index.html): app shell
- [styles.css](styles.css): responsive styling
- [app.js](app.js): client-side app logic

This app publishes its required static assets from this folder:
- [Situations-n-Resolutions-with-sections.csv](Situations-n-Resolutions-with-sections.csv)
- [USA_Swimming_Logo.svg](USA_Swimming_Logo.svg)

## Local preview

From the repository root, run a simple static server:

```bash
python3 -m http.server 8011
```

Then open:
- http://localhost:8011/docs/

Do not open the HTML file directly from disk, because the app fetches the CSV.

## GitHub Pages setup

This version is intended for the simple GitHub Pages branch-folder setup.

One-time configuration:
1. Push the repository changes to GitHub.
2. Open the repository on GitHub.
3. Go to **Settings**.
4. Open **Pages**.
5. Under **Build and deployment**, set:
   - **Source:** `Deploy from a branch`
   - **Branch:** your publishing branch, usually `main`
   - **Folder:** `/docs`
6. Save the settings.

GitHub will then publish the static site from this folder without a custom workflow.

After saving, GitHub will queue a build and publish the site (this can take a minute).
You can check the published URL in the repository **Pages** settings (the exact site address is shown there),
or visit the default Pages URL for the repository, which is usually:

- `https://<your-github-username>.github.io/<repository-name>/`

If you used the local preview earlier in this README, you can also confirm the `/docs` site locally at `http://localhost:8011/docs/`.

## Attribution

- Original project and source material by [gduryee](https://github.com/gduryee)
- Upstream repository: [gduryee/Situations_Resolutions](https://github.com/gduryee/Situations_Resolutions)
- Original Streamlit files in the repository root remain untouched
