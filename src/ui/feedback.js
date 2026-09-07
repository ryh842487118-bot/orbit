const $ = id => document.getElementById(id);
let toastTimer;

export function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}

export function fail(message) {
  const loading = $('loading');
  if (loading) loading.style.display = 'none';
  $('error').hidden = false;
  $('error-message').textContent = message;
}
