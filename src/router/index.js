import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: ChatView
        },
        {
            path: '/demo',
            name: 'demo',
            component: ChatView
        },
        {
            path: '/c/:id',
            name: 'chat',
            component: ChatView
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('../views/SettingsView.vue')
        },
        {
            path: '/login',
            redirect: to => {
                return { path: '/demo', query: { auth: 'login' } }
            }
        },
        {
            path: '/signup',
            redirect: to => {
                return { path: '/demo', query: { auth: 'signup' } }
            }
        }
    ]
})

export default router
