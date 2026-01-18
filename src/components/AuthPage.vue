<script setup>
import { ref } from 'vue'
import { useConvexMutation } from 'convex-vue'
import { api } from '../../convex/_generated/api'
import Cookies from '../../node_modules/@types/js-cookie'

const emit = defineEmits(['auth-success', 'close'])

const props = defineProps({
  initialIsLogin: {
    type: Boolean,
    default: true
  }
})

const isLogin = ref(props.initialIsLogin)
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const signupMutation = useConvexMutation(api.users.signup)
const loginMutation = useConvexMutation(api.users.login)

const handleSubmit = async () => {
  if (!username.value || password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }
  
  error.value = ''
  loading.value = true
  
  try {
    let userId;
    if (isLogin.value) {
      userId = await loginMutation.mutate({ username: username.value, password: password.value })
    } else {
      userId = await signupMutation.mutate({ username: username.value, password: password.value })
    }
    
    Cookies.set('chatbot_user_id', userId, { expires: 7 })
    // If we had a guest user, we might want to clear it, but for now just move on
    Cookies.remove('guest_user_id') 
    emit('auth-success', userId)
  } catch (err) {
    error.value = err.message.replace('Uncaught Error: ', '')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-overlay" @click.self="emit('close')">
    <div class="auth-card">
      <button class="close-modal-btn" @click="emit('close')">×</button>
      <div class="auth-header">
        <h1>LitlAI</h1>
        <p>{{ isLogin ? 'Sign in to your account' : 'Create your account' }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <input v-model="username" type="text" placeholder="Username" required />
        <input v-model="password" type="password" placeholder="Password" required />

        <div v-if="error" class="error-msg">
          {{ error }}
        </div>

        <button type="submit" class="auth-btn" :disabled="loading">
          {{ loading ? '...' : (isLogin ? 'Continue' : 'Sign Up') }}
        </button>
      </form>

      <div class="auth-footer">
        <span>{{ isLogin ? "Don't have an account?" : "Already have an account?" }}</span>
        <button @click="isLogin = !isLogin" class="toggle-btn">
          {{ isLogin ? 'Sign up' : 'Log in' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 3000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: white;
  padding: 3rem 2.5rem 2.5rem;
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  text-align: center;
  position: relative;
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.close-modal-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: #f5f5f5;
  border: none;
  font-size: 24px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.close-modal-btn:hover {
  background: #eeeeee;
  color: #000;
}

.auth-card {
  width: 100%;
  max-width: 360px;
  background: white;
  padding: 2.5rem;
  border-radius: 24px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  text-align: center;
}

.auth-header h1 {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.auth-header p {
  color: #676767;
  font-size: 0.95rem;
  margin-bottom: 2rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

input {
  width: 100%;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus {
  border-color: #000;
}

.auth-btn {
  padding: 0.8rem;
  background: #171717;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

.auth-btn:hover {
  opacity: 0.9;
}

.error-msg {
  color: #ef4444;
  font-size: 0.85rem;
  text-align: left;
}

.auth-footer {
  margin-top: 2rem;
  font-size: 0.9rem;
  color: #676767;
}

.toggle-btn {
  background: none;
  border: none;
  color: #000;
  font-weight: 600;
  cursor: pointer;
  margin-left: 0.4rem;
}
</style>
