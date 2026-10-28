import {installDownloadManager} from './download-manager.js';
installDownloadManager(chrome);

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.tabs.create({url: chrome.runtime.getURL(`downloader.html?tab=${tab.id}`)});
  }
});
