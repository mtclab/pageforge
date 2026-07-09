/**
 * The README.md that ships inside every downloaded zip. Written for someone
 * who has never put a website online. Regular hyphens only.
 */
export function renderReadme(name: string, hasPhoto: boolean): string {
  const files = [
    '- `index.html` - the page itself. This is your website.',
    '- `style.css` - the colors and fonts. The page needs it to look right.',
    ...(hasPhoto ? ['- `assets/photo.jpg` - your photo.'] : []),
    '- `assets/favicon.svg` - the little icon shown in the browser tab.',
    '- `site.json` - your answers from the generator. Keep it: you can load it back into pageforge later to edit your site.',
    '- `README.md` - this file. Your website does not need it, it is just instructions for you.',
  ].join('\n');

  return `# Your website

Hi ${name}! This folder IS your website. Every file here has a job:

${files}

Want to see it right now? Double-click \`index.html\` and it opens in your browser. It works even without internet - but only you can see it. To let other people see it, you need to put it online. Pick one of the options below.

## Option 1: Netlify Drop - online in about 2 minutes (easiest)

1. If this is still a zip file, unzip it first: right-click the zip and choose "Extract All" (Windows) or double-click it (Mac). You should now have a normal folder with \`index.html\` inside.
2. Open this address in your browser: https://app.netlify.com/drop
3. Drag the WHOLE FOLDER (not the zip file) from your computer onto the page, where it says to drop your site folder.
4. Wait a few seconds. You should now see a link that looks like \`something-random-12345.netlify.app\`. That is your website, live on the internet. Click it to check.
5. Important: create a free account when Netlify asks (it takes a minute). Without an account your site is deleted after an hour. With an account it stays up for free, and you can rename the link to something nicer under Site configuration > Change site name.

To update your site later: sign in to Netlify, open your site, go to the Deploys tab, and drag the folder in again.

## Option 2: GitHub Pages (free, a few more steps)

1. Create a free account at https://github.com/signup if you do not have one.
2. Once signed in, click the + button in the top right corner and choose "New repository".
3. In the "Repository name" box, type exactly: \`YOURUSERNAME.github.io\` - but replace YOURUSERNAME with the username you picked when signing up. Leave everything else as it is and click the green "Create repository" button.
4. On the next page, click the small link that says "uploading an existing file".
5. Drag ALL the files from this folder (not the folder itself - open it and select everything inside) onto the page.
6. Click the green "Commit changes" button at the bottom.
7. Wait a minute or two, then visit \`https://YOURUSERNAME.github.io\` in your browser. You should see your website.

To update later: open your repository on GitHub, click "Add file" > "Upload files", and upload the changed files again.

## Option 3: Cloudflare Pages (free)

1. Create a free account at https://dash.cloudflare.com/sign-up
2. In the left menu, choose "Workers & Pages", then "Create", then pick the "Pages" tab.
3. Choose "Upload assets" (direct upload).
4. Give your project a name - this becomes part of your address, like \`yourname.pages.dev\`.
5. Drag this folder onto the upload area and click "Deploy site".
6. After a few seconds you get your link. Click it to check.

## Changing your site later

Two ways:

- The easy way: go back to the generator, load your \`site.json\` file (or your saved draft), change what you want, and download a fresh zip. Then upload it again using the same option you used above.
- The direct way: open \`index.html\` in any text editor (Notepad works), carefully change the text you want, save, and upload again.

## Your own address like www.yourname.com (optional)

You can buy a domain name (a few euros or dollars per year) and connect it to your site. All three services above support this - search their help pages for "custom domain" and follow the steps there.

---

Made with pageforge (https://pageforge.mtclab.net) - free, no account needed.
`;
}
