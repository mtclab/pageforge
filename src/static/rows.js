for (const repeat of document.querySelectorAll('[data-repeat]')) {
  const prefix = repeat.dataset.repeat;
  const rows = repeat.querySelector('[data-repeat-rows]');
  const template = repeat.querySelector('template');
  const add = repeat.querySelector('[data-repeat-add]');
  if (!prefix || !rows || !template || !add) continue;

  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(`^${escaped}_\\d+_`);
  const reindex = () => {
    for (const [index, row] of [...rows.querySelectorAll('[data-repeat-row]')].entries()) {
      for (const field of row.querySelectorAll('[name]')) {
        field.name = field.name.replace(namePattern, `${prefix}_${index}_`);
      }
    }
  };

  add.textContent = 'Lisää rivi';
  add.addEventListener('click', (event) => {
    event.preventDefault();
    rows.append(template.content.cloneNode(true));
    repeat.querySelector('.repeat-empty')?.setAttribute('hidden', '');
    reindex();
  });

  rows.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-repeat-remove]');
    if (!remove || !rows.contains(remove)) return;
    remove.closest('[data-repeat-row]')?.remove();
    reindex();
  });

  repeat.closest('form')?.addEventListener('submit', reindex);
}
