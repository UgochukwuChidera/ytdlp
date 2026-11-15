import { createRouter, createWebHistory } from 'vue-router'
import HomeTab from '../tabs/HomeTab.vue'
import LibraryTab from '../tabs/LibraryTab.vue'
import SettingsTab from '../tabs/SettingsTab.vue'
import ChannelsTab from '../tabs/ChannelsTab.vue'

const routes = [
  { path: '/', redirect: '/download' },
  { path: '/download', name: 'download', component: HomeTab },
  { path: '/library', name: 'library', component: LibraryTab },
  { path: '/subscriptions', name: 'subscriptions', component: ChannelsTab },
  { path: '/settings', name: 'settings', component: SettingsTab },
  // Old routes kept as redirects so stale bookmarks still land somewhere useful
  { path: '/queue', redirect: '/library' },
  { path: '/downloads', redirect: '/library' },
  { path: '/channels', redirect: '/subscriptions' },
  { path: '/setup', redirect: '/settings' },
  { path: '/options', redirect: '/settings' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
