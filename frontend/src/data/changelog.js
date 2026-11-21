export const appVersion = '1.0.0'

export const changelog = [
  {
    version: 'Unreleased',
    date: '20 Nov 2026',
    items: [
      'Download composer now separates Video and Audio output modes.',
      'Video exposes resolution and container; Audio exposes quality and format.',
      'Format picker gained loading, empty and error states plus column filters and sorting.',
      'Picked formats download exactly as chosen, with a Use/+ Audio action and a persistent selected-format notice.',
      'Added tooltips to output settings and an in-app changelog.',
    ],
  },
  {
    version: '1.0.0',
    date: 'Initial release',
    items: [
      'Metadata lookup and playlist/channel scraping.',
      'Persistent download queue with live progress and pause/resume.',
      'Library, subscriptions, yt-dlp options and managed binaries.',
    ],
  },
]
