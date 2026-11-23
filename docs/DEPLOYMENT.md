# Deployment

The website is a buildless static bundle in `dist/`. GitHub Pages serves it from the public project repository using the [Pages workflow](../.github/workflows/pages.yml). In the repository's **Settings → Pages**, set the source to **GitHub Actions**. The workflow runs regression tests and uploads only `dist/` for publication after pushes to `main`.

## Release checklist

1. Review the public file list. Raw datasets, private research documents, and credentials belong outside this repository.
2. Run `node --test tests/model.test.mjs`.
3. Serve the static directory locally and try both examples, the result views, and all four suggested questions.
4. Push the reviewed changes to `main` and confirm the Pages deployment in GitHub Actions.
5. Open the published URL signed out and check that the chart data, prediction form and assistant load. Predictions and chat should generate zero requests after initialization.

Any static host can serve the same directory. Relative URLs keep the site portable to repository subpaths and custom domains. Configure HTTPS in the host. Runtime API keys, external fonts, databases, and server dependencies are unnecessary.
