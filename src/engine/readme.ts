import { SITE_DIR } from './types.js';

/**
 * The README.md that ships inside every downloaded zip. Written for someone
 * who has never put a website online. Regular hyphens only.
 *
 * It has one job beyond friendliness: the reader must come away knowing that
 * the `website` folder is what goes online and `site.json` is not, because
 * site.json holds their email address as plain text while the published page
 * only ever carries it obfuscated.
 */
export function renderReadme(name: string, hasPhoto: boolean): string {
  const files = [
    `- \`${SITE_DIR}/\` - **your website.** This whole folder is what goes online, and nothing else does.`,
    `  - \`index.html\` - the page itself.`,
    '  - `style.css` - the colors and fonts. The page needs it to look right.',
    ...(hasPhoto ? ['  - `assets/photo.jpg` - your photo.'] : []),
    '  - `assets/` - your pictures and the little icon shown in the browser tab.',
    '- `site.json` - your answers from the generator, including your email address written out in full. Keep it, it lets you load your site back into pageforge later - but do NOT upload it with your site.',
    '- `README.md` - this file. Instructions for you; it is not part of your website.',
  ].join('\n');

  return `# Your website

Hi ${name}! Your website is the \`${SITE_DIR}\` folder here. The other two files are for you, not for the web:

${files}

Want to see it right now? Open \`${SITE_DIR}\` and double-click \`index.html\` - it opens in your browser. It works even without internet, but only you can see it. To let other people see it, put the \`${SITE_DIR}\` folder on any web host.

## Putting it online

First, if this is still a zip file, unzip it (right-click > "Extract All" on Windows, double-click on Mac). Then pick any host - your site is plain HTML and CSS, so every host on the planet can serve it, nothing to install. Some free ones:

- **Netlify Drop** - drag the \`${SITE_DIR}\` folder onto https://app.netlify.com/drop and you are online. Their guide: https://docs.netlify.com/deploy/create-deploys/#drag-and-drop
- **Neocities** - made exactly for personal pages like this: https://neocities.org - guide: https://neocities.org/tutorials
- **GitHub Pages** - free and solid: https://pages.github.com
- **Cloudflare Pages** - drag-and-drop upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- **Your own web host (webhotel)** - if you already pay for hosting: upload the contents of \`${SITE_DIR}\` into the folder your domain serves (usually \`public_html\`, \`www\` or \`htdocs\`) with the host's file manager or any FTP program (for example https://filezilla-project.org). Your host's own help pages cover this.

Two things, whichever you pick:

- \`index.html\` must end up directly in the folder being served, not inside a subfolder.
- Upload only what is inside \`${SITE_DIR}\`. If \`site.json\` goes up too, anyone can open yoursite.com/site.json and read your email address straight off it - the page itself hides that address from address-harvesting robots, and uploading the file would hand it to them anyway.

## Changing your site later

Two ways:

- The easy way: go back to the generator, load your \`site.json\` file (or your saved draft), change what you want, and download a fresh zip. Then upload the new \`${SITE_DIR}\` folder the same way you did the first time.
- The direct way: open \`${SITE_DIR}/index.html\` in any text editor (Notepad works), carefully change the text you want, save, and upload again.

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
