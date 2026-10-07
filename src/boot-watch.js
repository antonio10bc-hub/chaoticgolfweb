// Red de seguridad de la pantalla de carga. Script clásico (no módulo): funciona aunque el juego no
// haya podido cargar (sin red y sin copia guardada). Si a los 10 s sigue cargando, aparece "Reintentar"
// (recargar conserva el enlace …#nivel=CÓDIGO, que el juego solo quita cuando ya ha arrancado).
setTimeout(() => {
  const ld = document.getElementById('loadScreen');
  if (!ld || !document.body.classList.contains('loading')) return;
  let lang = '';
  try { lang = localStorage.getItem('chaoticgolf_lang') || ''; } catch (e) { /* sin storage */ }
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn-light ldRetry';
  b.textContent = (lang || navigator.language || '').startsWith('es') ? 'Reintentar' : 'Retry';
  b.addEventListener('click', () => location.reload());
  ld.removeAttribute('aria-hidden');
  ld.append(b);
}, 10000);
