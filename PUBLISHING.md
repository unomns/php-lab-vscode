# Publishing PHP Lab

The extension is published to two registries:

- the **VS Code Marketplace** (used by VS Code), with [`vsce`](https://github.com/microsoft/vscode-vsce)
- **Open VSX** (used by VSCodium, Cursor, Gitpod, Eclipse Theia, …), with [`ovsx`](https://github.com/eclipse/openvsx)

Both tools are dev dependencies, so `npx vsce` / `npx ovsx` use the pinned versions.

## Before the first release

1. **Check the metadata in `package.json`.**
   `publisher`, `author` and the GitHub URLs (`repository`, `bugs`, `homepage`) are set to `unomns`.
   Change them if your Marketplace publisher ID or GitHub account is different.
   Update the links in `CHANGELOG.md` too.
2. **Replace the placeholders:**
   - `images/icon.png`: the Marketplace icon (PNG, at least 128×128; SVG is not allowed).
   - `images/demo.gif`: a short screen recording for the README (e.g. made with [Kap](https://getkap.co) on macOS).
3. **Push the repository to GitHub.** `vsce` rewrites the README's relative image links
   (like `images/demo.gif`) to `https://github.com/unomns/php-lab-vscode/raw/HEAD/...`,
   so the images must exist there.

## Create the accounts (one time)

### VS Code Marketplace

1. Sign in to [Azure DevOps](https://dev.azure.com) with a Microsoft account and create an organization (any name).
2. Create a **Personal Access Token**: User settings → Personal access tokens → New token.
   - Organization: **All accessible organizations**
   - Scopes: **Custom defined** → **Marketplace → Manage**
3. Create the publisher at <https://marketplace.visualstudio.com/manage/createpublisher>.
   The **ID** must match `"publisher"` in `package.json`.
4. Log in: `npx vsce login unomns` and paste the token.

### Open VSX

1. Sign in at <https://open-vsx.org> with GitHub, and sign the Publisher Agreement in your profile settings.
2. Create an access token: profile → **Access Tokens**.
3. Create the namespace (same name as the publisher, one time):
   `npx ovsx create-namespace unomns -p <token>`

## Release checklist

```bash
npm ci
npm run lint
npm test
npm run test:integration     # optional, needs PHP and downloads VS Code

# 1. Bump the version and move the "Unreleased" notes in CHANGELOG.md under it
npm version patch            # or minor / major; also creates a git tag

# 2. Build the package
npx vsce package             # → php-lab-vscode-<version>.vsix

# 3. Try it locally
code --install-extension php-lab-vscode-<version>.vsix

# 4. Publish the same file to both registries
npx vsce publish --packagePath php-lab-vscode-<version>.vsix
npx ovsx publish php-lab-vscode-<version>.vsix -p <open-vsx-token>

git push --follow-tags
```

`npx vsce ls` shows which files go into the package (configured in `.vscodeignore`).

## Automating (optional)

Store the tokens as GitHub secrets (`VSCE_PAT`, `OVSX_PAT`) and run on tag pushes:

```bash
npx vsce publish --packagePath "$VSIX" -p "$VSCE_PAT"
npx ovsx publish "$VSIX" -p "$OVSX_PAT"
```
