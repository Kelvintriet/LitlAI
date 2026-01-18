import { createApp } from 'vue'
import './style.css'
import 'katex/dist/katex.min.css'
import App from './App.vue'
import { convexVue } from 'convex-vue'
import router from './router'

const app = createApp(App)

app.use(router)
app.use(convexVue, {
    url: import.meta.env.VITE_CONVEX_URL,
})

app.mount('#app')
