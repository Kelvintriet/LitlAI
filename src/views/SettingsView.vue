<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexQuery, useConvexMutation, useConvexClient } from 'convex-vue'
import { api } from '../../convex/_generated/api'
import Cookies from 'js-cookie'

const router = useRouter()
const currentUserId = ref(Cookies.get('chatbot_user_id'))

const { data: currentUser } = useConvexQuery(api.users.get, computed(() => ({ userId: currentUserId.value })), { enabled: computed(() => !!currentUserId.value) })

const updateInstructionsMutation = useConvexMutation(api.users.updateCustomInstructions)
const updateSmartAutoToolsMutation = useConvexMutation(api.users.updateSmartAutoTools)

const customInstructions = ref('')
const smartAutoEnabled = ref(false)
const isSaving = ref(false)
const saveMessage = ref('')

watch(currentUser, (user) => {
  if (user) {
    customInstructions.value = user.customInstructions || ''
    smartAutoEnabled.value = user.smartAutoTools || false
  }
}, { immediate: true })

const handleSave = async () => {
    if (!currentUserId.value) return;
    isSaving.value = true;
    saveMessage.value = '';
    
    try {
        await updateInstructionsMutation.mutate({ 
            userId: currentUserId.value, 
            instructions: customInstructions.value 
        });
        
        await updateSmartAutoToolsMutation.mutate({
            userId: currentUserId.value,
            enabled: smartAutoEnabled.value
        });
        
        saveMessage.value = 'Settings saved successfully!';
        setTimeout(() => saveMessage.value = '', 3000);
    } catch (err) {
        console.error(err);
        saveMessage.value = 'Failed to save settings.';
    } finally {
        isSaving.value = false;
    }
}

const handleBack = () => {
    router.push('/demo'); // Or '/' depending on where user came from, usually back to chat
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-container">
      <header class="settings-header">
        <button @click="handleBack" class="back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Back
        </button>
        <h1>Settings</h1>
      </header>

      <main class="settings-content">
        <section class="settings-section">
            <h2>Personalization</h2>
            <p class="section-desc">Customize how LitlAI responds to you.</p>
            
            <div class="input-group">
                <label>Custom Instructions</label>
                <textarea 
                    v-model="customInstructions" 
                    placeholder="E.g., 'I am a software engineer, prefer concise technical answers.' or 'Explain things like I'm 5.'"
                    class="instructions-input"
                ></textarea>
                <p class="help-text">These instructions will be added to the system prompt for every new chat.</p>
            </div>
        </section>

        <section class="settings-section">
            <h2>Smart Features</h2>
            
            <div class="toggle-row">
                <div class="toggle-info">
                    <label>Smart Auto Tools</label>
                    <p>Allow LitlAI to automatically select and use tools (Search, Code Interpreter, Canvas) based on your request, without you needing to manually select them.</p>
                </div>
                <label class="switch">
                    <input type="checkbox" v-model="smartAutoEnabled">
                    <span class="slider round"></span>
                </label>
            </div>
        </section>

        <div class="actions">
            <span v-if="saveMessage" class="save-msg" :class="{ error: saveMessage.includes('Failed') }">{{ saveMessage }}</span>
            <button @click="handleSave" class="save-btn" :disabled="isSaving">
                {{ isSaving ? 'Saving...' : 'Save Changes' }}
            </button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
    min-height: 100vh;
    background: var(--bg-main);
    display: flex;
    justify-content: center;
    padding: 2rem;
}

.settings-container {
    width: 100%;
    max-width: 800px;
    background: var(--bg-card);
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    height: fit-content;
}

.settings-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-light);
}

.back-btn {
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: background 0.2s;
}

.back-btn:hover {
    background: var(--hover-bg);
    color: var(--text-main);
}

h1 {
    font-size: 1.5rem;
    font-weight: 600;
}

.settings-section {
    margin-bottom: 3rem;
}

h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.section-desc {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
}

.input-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--text-main);
}

.instructions-input {
    width: 100%;
    height: 150px;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid var(--border-light);
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s;
}

.instructions-input:focus {
    border-color: #000;
}

.help-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
}

/* Toggle Switch */
.toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    background: var(--bg-sidebar);
    padding: 1.5rem;
    border-radius: 16px;
}

.toggle-info label {
    font-weight: 600;
    display: block;
    margin-bottom: 0.5rem;
}

.toggle-info p {
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.5;
}

.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  flex-shrink: 0;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: #10a37f; /* Green */
}

input:focus + .slider {
  box-shadow: 0 0 1px #10a37f;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-light);
}

.save-btn {
    background: #171717;
    color: white;
    padding: 0.75rem 2rem;
    border-radius: 12px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
}

.save-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.save-msg {
    color: #10a37f;
    font-size: 0.9rem;
    font-weight: 500;
}

.save-msg.error {
    color: #ef4444;
}
</style>
