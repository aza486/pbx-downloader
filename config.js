export async function loadConfig() {
  let response;
  try { response = await fetch(chrome.runtime.getURL('config.local.json')); } catch { /* Not configured yet. */ }
  if (!response?.ok) response = await fetch(chrome.runtime.getURL('config.example.json'));
  if (!response.ok) throw new Error('Konfigurationsvorlage fehlt.');
  const config = await response.json();
  if (!Array.isArray(config.allowedOrigins) || !config.allowedOrigins.length) {
    throw new Error('In config.local.json mindestens eine HTTPS-Instanz konfigurieren.');
  }
  return new Set(config.allowedOrigins.map(value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error('allowedOrigins darf nur reine HTTPS-Ursprünge enthalten.');
    return url.origin;
  }));
}
