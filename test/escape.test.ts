import { describe, expect, it } from 'vitest';
import { entityEncode, esc, escAttr, safeUrl, textToHtml } from '../src/engine/escape.js';
import { detectKind } from '../src/engine/links.js';

describe('esc / escAttr', () => {
  it('escapes text nodes', () => {
    expect(esc('<b>&"</b>')).toBe('&lt;b&gt;&amp;"&lt;/b&gt;');
  });
  it('escapes quotes in attributes', () => {
    expect(escAttr('a"b<c>&')).toBe('a&quot;b&lt;c&gt;&amp;');
  });
});

describe('safeUrl', () => {
  it('keeps http/https/mailto and valid telephone links', () => {
    expect(safeUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
    expect(safeUrl('http://example.com')).toBe('http://example.com/');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeUrl('tel:+358 40 123 4567')).toBe('tel:+358 40 123 4567');
    expect(safeUrl('tel:<script>')).toBeNull();
  });
  it('upgrades scheme-less input to https', () => {
    expect(safeUrl('example.com/page')).toBe('https://example.com/page');
    expect(safeUrl('  example.com  ')).toBe('https://example.com/');
  });
  it('rejects dangerous or invalid schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,x')).toBeNull();
    expect(safeUrl('vbscript:x')).toBeNull();
    expect(safeUrl('file:///etc/passwd')).toBeNull();
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
  });
  it('percent-encodes hostile query characters', () => {
    const url = safeUrl('https://example.com/?q="><script>');
    expect(url).not.toBeNull();
    expect(url).not.toContain('<');
    expect(url).not.toContain('"');
  });
});

describe('entityEncode', () => {
  it('encodes every char as a numeric entity', () => {
    expect(entityEncode('a@b')).toBe('&#97;&#64;&#98;');
  });
});

describe('textToHtml', () => {
  it('splits paragraphs on blank lines, <br> on single newlines', () => {
    expect(textToHtml('a\nb\n\nc')).toBe('<p>a<br>b</p>\n<p>c</p>');
  });
  it('escapes before wrapping', () => {
    expect(textToHtml('<script>x</script>')).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });
  it('returns empty string for whitespace-only input', () => {
    expect(textToHtml('  \n  ')).toBe('');
  });
  it('normalizes CRLF', () => {
    expect(textToHtml('a\r\n\r\nb')).toBe('<p>a</p>\n<p>b</p>');
  });
});

describe('detectKind', () => {
  it('detects platforms from URLs', () => {
    expect(detectKind('https://github.com/annav')).toBe('github');
    expect(detectKind('www.instagram.com/annav')).toBe('instagram');
    expect(detectKind('https://www.linkedin.com/in/anna')).toBe('linkedin');
    expect(detectKind('youtu.be/xyz')).toBe('youtube');
    expect(detectKind('https://x.com/anna')).toBe('x');
    expect(detectKind('twitter.com/anna')).toBe('x');
    expect(detectKind('mailto:a@b.com')).toBe('email');
    expect(detectKind('tel:+358401234567')).toBe('phone');
    expect(detectKind('https://mygithub.company.example')).toBe('website');
    expect(detectKind('notgithub.com.evil.example')).toBe('website');
  });
});
