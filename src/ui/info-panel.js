import { mobile, reducedMotion } from '../core/math.js';

export function createInfoPanel({ getData }) {
  const $ = id => document.getElementById(id);

  function update(id) {
    const data = getData(id);
    $('info-category').textContent = data.type;
    $('info-en').textContent = data.en;
    $('info-name').textContent = data.cn;
    const index = document.createElement('span');
    index.className = 'object-index';
    index.textContent = data.index;
    $('info-name').append(index);
    $('info-description').textContent = data.desc;
    $('stat-label-1').textContent = data.stat1 || '平均直径';
    $('stat-label-2').textContent = data.stat2 || '公转周期';
    $('stat-value-1').replaceChildren(document.createTextNode(data.diameter));
    const unit1 = document.createElement('small');
    unit1.textContent = ' ' + (data.unit1 || 'km');
    $('stat-value-1').append(unit1);
    $('stat-value-2').replaceChildren(document.createTextNode(data.value2));
    const unit2 = document.createElement('small');
    unit2.textContent = ' ' + data.unit2;
    $('stat-value-2').append(unit2);
    $('earth-actions').style.display = id === 'earth' || id === 'iss' ? '' : 'none';
    $('observation-text').textContent = id === 'galaxy' ? '银河旋臂 · 示意模型' : id === 'solar' ? '八大行星 · 轨道运行中' : '正在追踪' + data.cn;
    document.querySelectorAll('.planet-button').forEach(button => {
      button.classList.toggle('active', button.dataset.id === id);
      button.setAttribute('aria-pressed', String(button.dataset.id === id));
    });
    const active = document.querySelector('.planet-button.active');
    if (active && mobile()) active.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
  }

  return { update };
}
