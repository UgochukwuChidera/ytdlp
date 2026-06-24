import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/download' },
  { path: '/download', name: 'download', component: () => import('../tabs/HomeTab.vue') },
  { path: '/queue', name: 'queue', component: () => import('../tabs/QueueTab.vue') },
  { path: '/setup', name: 'setup', component: () => import('../tabs/SetupTab.vue') },
  { path: '/downloads', name: 'downloads', component: () => import('../tabs/DownloadsTab.vue') },
  { path: '/channels', name: 'channels', component: () => import('../tabs/ChannelsTab.vue') },
  { path: '/options', name: 'options', component: () => import('../tabs/OptionsTab.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
