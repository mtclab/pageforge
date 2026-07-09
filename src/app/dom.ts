/** Tiny DOM builder: user data always goes through textContent/value, never innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

export function labeled(
  labelText: string,
  input: HTMLElement,
  hint?: string,
): HTMLDivElement {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  const wrap = el('div', { class: 'field' }, el('label', { for: id, text: labelText }), input);
  if (hint) wrap.append(el('p', { class: 'hint', text: hint }));
  return wrap;
}
