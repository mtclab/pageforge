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

Want to see it right now? Double-click \`index.html\` and it opens in your browser. It works even without internet - but only you can see it. To let other people see it, put the files on any web host.

## Putting it online

First, if this is still a zip file, unzip it (right-click > "Extract All" on Windows, double-click on Mac). Then pick any host - your site is plain HTML and CSS, so every host on the planet can serve it, nothing to install. Some free ones:

- **Netlify Drop** - drag the folder onto https://app.netlify.com/drop and you are online. Their guide: https://docs.netlify.com/deploy/create-deploys/#drag-and-drop
- **Neocities** - made exactly for personal pages like this: https://neocities.org - guide: https://neocities.org/tutorials
- **GitHub Pages** - free and solid: https://pages.github.com
- **Cloudflare Pages** - drag-and-drop upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- **Your own web host (webhotel)** - if you already pay for hosting: upload the files into the folder your domain serves (usually \`public_html\`, \`www\` or \`htdocs\`) with the host's file manager or any FTP program (for example https://filezilla-project.org). Your host's own help pages cover this.

Whichever you pick: \`index.html\` must end up directly in the folder being served, not inside a subfolder.

## Changing your site later

Two ways:

- The easy way: go back to the generator, load your \`site.json\` file (or your saved draft), change what you want, and download a fresh zip. Then upload it again using the same option you used above.
- The direct way: open \`index.html\` in any text editor (Notepad works), carefully change the text you want, save, and upload again.

## Want to know how many people visit? (optional)

Your site has no tracking of any kind. If you would like a simple, privacy-friendly visitor counter, these work by adding one line to \`index.html\` and their sites explain where:

- GoatCounter - free for personal sites: https://www.goatcounter.com
- Plausible - paid, very simple: https://plausible.io
- Your host may also show basic visit numbers on its own dashboard.

## Your own address like www.yourname.com (optional)

You can buy a domain name (a few euros or dollars per year) and connect it to your site. All three services above support this - search their help pages for "custom domain" and follow the steps there.

---

Made with pageforge (https://pageforge.mtclab.net) - free, no account needed.
`;
}
