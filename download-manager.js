// Track downloads outside the page so closing its tab also stops pending downloads.
export function installDownloadManager(api) {
  const prefix = 'download:';
  const keyFor = url => prefix + url;
  async function cancelOwner(owner) {
    const sourceKey = `source:${owner}`;
    const source = (await api.storage.session.get(sourceKey))[sourceKey];
    if (source) {
      await api.scripting.executeScript({target: {tabId: source.tabId},
        func: key => globalThis.__pbxRequests?.[key]?.abort(), args: [`pbx:${owner}`]}).catch(() => {});
      await api.storage.session.remove(sourceKey);
    }
    const entries = await api.storage.session.get(null);
    await Promise.all(Object.entries(entries).filter(([key, job]) => key.startsWith(prefix) && job.owner === owner)
      .map(async ([key, job]) => {
        await api.storage.session.remove(key);
        if (job.id !== undefined) await api.downloads.cancel(job.id).catch(() => {});
      }));
  }
  api.tabs.onRemoved.addListener(owner => { cancelOwner(owner).catch(console.error); });
  api.downloads.onDeterminingFilename.addListener((item, suggest) => {
    if (item.byExtensionId !== api.runtime.id) { suggest(); return; }
    api.storage.session.get(keyFor(item.url)).then(entries => {
      const job = entries[keyFor(item.url)];
      // Blob downloads otherwise may receive a generated name in Downloads.
      suggest(job ? {filename: job.filename, conflictAction: 'uniquify'} : undefined);
    }).catch(() => suggest());
    return true;
  });
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || sender.tab?.id === undefined ||
        !sender.url?.startsWith(api.runtime.getURL('downloader.html') + '?')) return;
    if (!['source', 'download', 'release', 'cancel'].includes(message?.type)) return;
    const owner = sender.tab.id;
    (async () => {
      if (message.type === 'cancel') { await cancelOwner(owner); return {}; }
      if (message.type === 'source') {
        if (!Number.isInteger(message.tabId)) throw new Error('Ungültiger Editor-Tab.');
        await api.storage.session.set({[`source:${owner}`]: {tabId: message.tabId}});
        return {requestKey: `pbx:${owner}`};
      }
      const key = keyFor(message.url);
      if (message.type === 'release') {
        const entries = await api.storage.session.get(key);
        if (entries[key]?.owner === owner) await api.storage.session.remove(key);
        return {};
      }
      if (typeof message.url !== 'string' || !message.url.startsWith(`blob:${api.runtime.getURL('')}`) ||
          !/^PrintboxDownloads\/[0-9a-f-]{36}\/[^/\\]+\.(jpg|png)$/i.test(message.filename) ||
          message.filename.includes('..')) throw new Error('Ungültiger Downloadauftrag.');
      const job = {owner, filename: message.filename};
      await api.storage.session.set({[key]: job});
      try {
        const id = await api.downloads.download({url: message.url, filename: job.filename,
          conflictAction: 'uniquify', saveAs: false});
        const entries = await api.storage.session.get(key);
        if (!entries[key]) {
          await api.downloads.cancel(id).catch(() => {});
          throw new Error('Downloader wurde geschlossen.');
        }
        await api.storage.session.set({[key]: {...job, id}});
        // Cover tab closure between the first state read and storing the download ID.
        try { await api.tabs.get(owner); }
        catch { await cancelOwner(owner); throw new Error('Downloader wurde geschlossen.'); }
        return {id};
      } catch (error) {
        await api.storage.session.remove(key);
        throw error;
      }
    })().then(respond, error => respond({error: error.message}));
    return true;
  });
}
