<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useConvexQuery, useConvexMutation, useConvexClient } from 'convex-vue'
import { api } from '../../convex/_generated/api'
import { useRoute, useRouter } from 'vue-router'
import Cookies from '../../node_modules/@types/js-cookie'
import AuthPage from '../components/AuthPage.vue'
import { marked } from 'marked'

// 1. Hook and Global Setup
const route = useRoute()
const router = useRouter()
const convex = useConvexClient()

// 2. State & Constants
const currentUserId = ref(Cookies.get('chatbot_user_id'))
const conversationId = computed(() => route.params.id)

const newMessage = ref('')
const isTyping = ref(false)
const isSidebarCollapsed = ref(false)
const isUserMenuOpen = ref(false)
const isToolsMenuOpen = ref(false)
const isSearchModalOpen = ref(false)
const searchQuery = ref('')
const skipScrollAnimation = ref(false)
const activeTool = ref(null) // 'code_interpreter' or null

const messagesContainer = ref(null)
const inputField = ref(null)
const welcomeInputField = ref(null)
const mainWrapper = ref(null)

// 3. Cache-backed Reactive State
const conversations = ref([])
const messages = ref([])
const codeOutputs = ref({}) // Map<messageId, { status: 'running'|'done'|'error', output: string }>
const executedCodeBlocks = ref(new Set()) // Track executed blocks by messageId + codeHash

const activeCanvas = ref(null) // { title, content, type, id? }
const isCanvasSidebarOpen = ref(false)
const canvasSaveStatus = ref('')
const isCopied = ref(false)
const isEditingCanvas = ref(false)
const canvasWidth = ref(50) // percentage
const isResizing = ref(false)

// 4. Auth & Demo Mode State
const isAuthModalOpen = ref(false)
const authModalType = ref('login') // 'login' | 'signup'
const guestMessageLimit = 5

const selectedModel = ref('groq/compound')
const isModelPickerOpen = ref(false)
const availableModels = [
  { id: 'groq/compound', name: 'LitlAI Pro', desc: 'Powerful & Precise' },
  { id: 'groq/compound-mini', name: 'LitlAI Flash', desc: 'Fast & Efficient' }
]

// 4. Custom SVG Icons
const Icons = {
  NewChat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  Sidebar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  Search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  Send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  Attach: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  Global: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  Lightbulb: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>',
  Plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  Terminal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
  Canvas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
  Close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  Copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  Download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  Check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  ChevronDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>',
  Eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
}

// 5. Core Utility Functions
async function scrollToBottom(smooth = true) {
  await nextTick()
  if (messagesContainer.value) {
    const behavior = (smooth && !skipScrollAnimation.value) ? 'smooth' : 'auto'
    messagesContainer.value.style.scrollBehavior = behavior
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

import markedKatex from "marked-katex-extension";

// Configure marked with Katex
marked.use(markedKatex({ throwOnError: false }));

const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Replace <canvas ...>...</canvas> with an empty string but keep rest of content
  let processed = text.replace(/<canvas\s+type="[^"]+" title="[^"]+">[\s\S]*?(?:<\/canvas>|$)/gi, '');

  // Robust replacement for block math \[ ... \] -> $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`);
  
  // Robust replacement for inline math \( ... \) -> $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation}$`);
  
  return marked.parse(processed);
}

// 6. Convex Hooks
const { data: conversationsRaw } = useConvexQuery(api.conversations.list, computed(() => ({ userId: currentUserId.value })), { enabled: computed(() => !!currentUserId.value) })
const { data: messagesRaw } = useConvexQuery(api.messages.list, computed(() => ({ conversationId: conversationId.value })), { enabled: computed(() => !!conversationId.value) })
const { data: currentUser } = useConvexQuery(api.users.get, computed(() => ({ userId: currentUserId.value })), { enabled: computed(() => !!currentUserId.value) })

const createConversationMutation = useConvexMutation(api.conversations.create)
const sendMessageMutation = useConvexMutation(api.messages.send)
const removeConversationMutation = useConvexMutation(api.conversations.remove)

// 7. Computed Logic
const displayName = computed(() => {
  if (!currentUser.value?.username) return '';
  const name = currentUser.value.username;
  if (name.includes('@')) return name.split('@')[0];
  return name;
})

const filteredConversations = computed(() => {
  if (!searchQuery.value.trim()) return conversations.value || []
  const query = searchQuery.value.toLowerCase()
  return (conversations.value || []).filter(c => c.title.toLowerCase().includes(query))
})

// 8. Action Handlers
const seedFromCache = () => {
  if (!currentUserId.value) return
  
  // Seed Conversations
  const savedConvs = localStorage.getItem(`cache_convs_${currentUserId.value}`)
  if (savedConvs && !conversationsRaw.value) {
    conversations.value = JSON.parse(savedConvs)
  }

  // Seed Messages
  if (conversationId.value) {
    skipScrollAnimation.value = true
    const savedMsgs = localStorage.getItem(`cache_msgs_${currentUserId.value}_${conversationId.value}`)
    if (savedMsgs && !messagesRaw.value) {
      messages.value = JSON.parse(savedMsgs)
      scrollToBottom(false)
    } else if (!savedMsgs && !messagesRaw.value) {
      messages.value = []
    }
    
    setTimeout(() => { skipScrollAnimation.value = false }, 100)
  } else {
    messages.value = []
  }
}

const handleSend = async () => {
  const text = newMessage.value.trim()
  if (!text || isTyping.value || !currentUserId.value) return

  // Demo Mode Check (Limit 5 messages for guest)
  if (currentUser.value?.isGuest && (currentUser.value?.messageCount || 0) >= guestMessageLimit) {
    isAuthModalOpen.value = true
    authModalType.value = 'signup'
    return
  }

  if (currentUser.value?.isGuest) {
    // 1. Locally update messages list
    const userMsg = { _id: `guest-u-${Date.now()}`, body: text, author: 'user', timestamp: Date.now() };
    messages.value.push(userMsg);
    scrollToBottom();

    // 2. Prepare history for AI
    const historyForAI = messages.value.slice(0, -1).map(m => ({
      role: m.author === 'user' ? 'user' : 'assistant',
      content: m.body
    }));

    // 3. Clear typing state & UI
    newMessage.value = '';
    if (inputField.value) inputField.value.innerText = '';
    if (welcomeInputField.value) welcomeInputField.value.innerText = '';
    isTyping.value = true;

    // 4. Create local AI placeholder
    const aiId = `guest-ai-${Date.now()}`;
    const aiMsg = { _id: aiId, body: 'Thinking...', author: 'ai', timestamp: Date.now() };
    messages.value.push(aiMsg);
    scrollToBottom();

    try {
      // 5. Call AI action with isGuest: true
      const result = await convex.action(api.groq.chat, {
        message: text,
        userId: currentUserId.value,
        conversationId: '000000000000000000000000', // dummy ID
        isGuest: true,
        guestHistory: historyForAI,
        model: selectedModel.value,
        tools: activeTool.value ? [activeTool.value] : []
      });

      // 6. Update local AI message
      const index = messages.value.findIndex(m => m._id === aiId);
      if (index !== -1) {
        messages.value[index].body = result;
      }
      
      // 7. Increment guest count
      await convex.mutation(api.users.incrementMessageCount, { userId: currentUserId.value });

    } catch (err) {
      console.error("Guest chat error:", err);
      const index = messages.value.findIndex(m => m._id === aiId);
      if (index !== -1) {
        messages.value[index].body = "Error: Failed to get response.";
      }
    } finally {
      isTyping.value = false;
      scrollToBottom();
    }
    return;
  }

  // Normal User Logic
  newMessage.value = ''
  if (inputField.value) inputField.value.innerText = '';
  if (welcomeInputField.value) welcomeInputField.value.innerText = '';

  try {
    let currentId = conversationId.value;
    if (!currentId) {
      const title = "New Chat...";
      currentId = await createConversationMutation.mutate({ title, userId: currentUserId.value });
      router.push(`/c/${currentId}`);
    }

    await sendMessageMutation.mutate({ body: text, author: 'user', userId: currentUserId.value, conversationId: currentId })
    isTyping.value = true
    
    // Pass tools if active
    const tools = activeTool.value ? [activeTool.value] : []
    
    await convex.action(api.groq.chat, { 
      message: text, 
      userId: currentUserId.value, 
      conversationId: currentId,
      tools: tools,
      model: selectedModel.value // Pass selected model
    })
  } catch (err) {
    console.error("Failed to send message:", err)
  } finally {
    isTyping.value = false
  }
}

const handleLogout = async () => {
  if (currentUserId.value) localStorage.removeItem(`cache_convs_${currentUserId.value}`)
  Cookies.remove('chatbot_user_id')
  currentUserId.value = null
  isUserMenuOpen.value = false
  conversations.value = []
  messages.value = []
  
  // Initialize new guest session
  try {
    const guestId = await convex.mutation(api.users.createGuest)
    currentUserId.value = guestId
    Cookies.set('chatbot_user_id', guestId, { expires: 7 })
  } catch (e) {
    console.error("Failed to create guest session", e)
  }
  
  router.push('/');
}

const handleRemoveConversation = async (id) => {
  if (confirm('Delete this conversation?')) {
    await removeConversationMutation.mutate({ conversationId: id });
    if (conversationId.value === id) router.push('/');
  }
}

const updateInput = (e) => { newMessage.value = e.target.innerText }
const onKeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }
const onAuthSuccess = (userId) => { 
  currentUserId.value = userId;
  isAuthModalOpen.value = false;
  // Clear any query params
  router.replace({ path: route.path, query: {} });
}
const startNewChat = () => { router.push('/'); }
const toggleSidebar = () => { isSidebarCollapsed.value = !isSidebarCollapsed.value }
const toggleUserMenu = (e) => { e.stopPropagation(); isUserMenuOpen.value = !isUserMenuOpen.value }
const closeUserMenu = () => { 
  isUserMenuOpen.value = false; 
  isToolsMenuOpen.value = false; 
  isModelPickerOpen.value = false;
}
const toggleToolsMenu = (e) => { e.stopPropagation(); isToolsMenuOpen.value = !isToolsMenuOpen.value }
const toggleSearchModal = () => { isSearchModalOpen.value = !isSearchModalOpen.value; if (isSearchModalOpen.value) searchQuery.value = '' }
const navigateToChat = (id) => { router.push(`/c/${id}`); isSearchModalOpen.value = false }

const toggleTool = (toolId) => {
  if (activeTool.value === toolId) {
    activeTool.value = null
  } else {
    activeTool.value = toolId
  }
  isToolsMenuOpen.value = false
}
// Code Execution Logic
const runCode = async (code, messageId) => {
  if (!code || !messageId) return;
  
  codeOutputs.value[messageId] = { status: 'running', output: 'Executing code...' };
  
  try {
    const result = await convex.action(api.piston.execute, { source: code, language: 'python' });
    codeOutputs.value[messageId] = { 
      status: 'done', 
      output: result.run.output || '(No output)' 
    };
  } catch (err) {
    codeOutputs.value[messageId] = { 
      status: 'error', 
      output: `Error: ${err.message}` 
    };
  }
}

const startResizing = (e) => {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResizing);
  document.addEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

const handleResizing = (e) => {
  if (!isResizing.value || !mainWrapper.value) return;
  const rect = mainWrapper.value.getBoundingClientRect();
  const mouseXInWrapper = e.clientX - rect.left;
  const widthPercent = 100 - (mouseXInWrapper / rect.width) * 100;
  // Constraint: 25% min, 70% max (reduced to prevent button clipping)
  canvasWidth.value = Math.max(25, Math.min(70, widthPercent));
}

const stopResizing = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResizing);
  document.removeEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'default';
  document.body.style.userSelect = 'auto';
}

// 9. Lifecycle Hooks & Global Listeners
onMounted(async () => {
  // Demo Mode Initialization
  if (!currentUserId.value) {
    try {
      const guestId = await convex.mutation(api.users.createGuest)
      currentUserId.value = guestId
      Cookies.set('chatbot_user_id', guestId, { expires: 7 })
    } catch (e) {
      console.error("Failed to create guest session", e)
    }
  }

  // Handle Query Params for Auth Modal
  if (route.query.auth === 'login') {
    isAuthModalOpen.value = true
    authModalType.value = 'login'
  } else if (route.query.auth === 'signup') {
    isAuthModalOpen.value = true
    authModalType.value = 'signup'
  }

  const target = conversationId.value ? inputField.value : welcomeInputField.value;
  if (target) target.focus();
  window.addEventListener('click', closeUserMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closeUserMenu)
})

const lastOpenedCanvasId = ref(null)

// 10. Watchers
watch(conversationsRaw, (newVal) => {
  if (newVal && !currentUser.value?.isGuest) {
    conversations.value = newVal
    if (currentUserId.value) localStorage.setItem(`cache_convs_${currentUserId.value}`, JSON.stringify(newVal))
  }
}, { immediate: true })

watch(messagesRaw, (newVal) => {
  if (newVal && !currentUser.value?.isGuest) {
    messages.value = newVal
    if (currentUserId.value && conversationId.value) {
      localStorage.setItem(`cache_msgs_${currentUserId.value}_${conversationId.value}`, JSON.stringify(newVal))
    }
    
    // Auto-Execute Code Inspector
    if (activeTool.value === 'code_interpreter' && newVal.length > 0) {
      const lastMsg = newVal[newVal.length - 1];
      if (lastMsg.author === 'ai') {
        const pythonBlockRegex = /```python\n([\s\S]*?)```/g;
        let match;
        const blocks = [];
        
        while ((match = pythonBlockRegex.exec(lastMsg.body)) !== null) {
           blocks.push(match[1]);
        }
        
        // Only run the last block if it is complete and new
        if (blocks.length > 0) {
           const lastCode = blocks[blocks.length - 1];
           // Use total length of body as version stamp
           const blockId = `${lastMsg._id}-v${lastMsg.body.length}`;
           
           // Simple debouncing: check if we already ran code for this exact message length state
           // or closely related state.
           // Better: Check if we have an output for this messageId already? 
           // If we want to allow REFInING code, we need to be careful.
           // For now: ONE output per message max.
           
           if (!codeOutputs.value[lastMsg._id] && !executedCodeBlocks.value.has(blockId)) {
             executedCodeBlocks.value.add(blockId);
             runCode(lastCode, lastMsg._id);
           }
        }
      }
    }

    // 3. Canvas Parser
    if (newVal.length > 0) {
      const lastMsg = newVal[newVal.length - 1];
      if (lastMsg.author === 'ai') {
        const canvasRegex = /<canvas\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)(?:<\/canvas>|$)/i;
        const match = canvasRegex.exec(lastMsg.body);
        
        if (match) {
          const type = match[1];
          const title = match[2];
          const content = match[3];

          // Update active canvas state
          activeCanvas.value = { title, content, type, messageId: lastMsg._id };
          
          // Auto-open sidebar if it's a sidebar type and not already opened for THIS message
          if (type === 'sidebar' && lastOpenedCanvasId.value !== lastMsg._id) {
            isCanvasSidebarOpen.value = true;
            lastOpenedCanvasId.value = lastMsg._id;
          }
        }
      }
    }

    scrollToBottom(true)
  }
}, { immediate: true })

let saveTimeout = null;
const updateCanvasContent = async (newContent) => {
  if (!activeCanvas.value) return;
  activeCanvas.value.content = newContent;
  canvasSaveStatus.value = 'Saving...';
  
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(async () => {
    try {
      if (activeCanvas.value.id) {
          await convex.mutation(api.canvases.update, { 
              canvasId: activeCanvas.value.id, 
              content: newContent 
          });
      } else {
          const id = await convex.mutation(api.canvases.create, {
              title: activeCanvas.value.title,
              content: newContent,
              type: activeCanvas.value.type,
              conversationId: conversationId.value,
              userId: currentUserId.value
          });
          activeCanvas.value.id = id;
      }
      canvasSaveStatus.value = 'Saved';
      setTimeout(() => { 
        if (canvasSaveStatus.value === 'Saved') canvasSaveStatus.value = '' 
      }, 3000);
    } catch (err) {
      canvasSaveStatus.value = 'Error saving';
    }
  }, 1000);
}

const downloadCanvas = () => {
  if (!activeCanvas.value) return;
  const blob = new Blob([activeCanvas.value.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activeCanvas.value.title}.txt`;
  a.click();
}

const copyCanvas = () => {
  if (!activeCanvas.value) return;
  navigator.clipboard.writeText(activeCanvas.value.content);
  isCopied.value = true;
  canvasSaveStatus.value = 'Copied!';
  setTimeout(() => { 
      isCopied.value = false;
      if (canvasSaveStatus.value === 'Copied!') canvasSaveStatus.value = '' 
  }, 2000);
}

const getCanvasFromMessage = (body) => {
  if (!body) return null;
  const canvasRegex = /<canvas\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)(?:<\/canvas>|$)/i;
  const match = canvasRegex.exec(body);
  if (match) {
    return { type: match[1], title: match[2], content: match[3] };
  }
  return null;
}

watch([currentUserId, conversationId], seedFromCache, { immediate: true })

watch(conversationId, (newId) => {
  nextTick(() => {
    const target = newId ? inputField.value : welcomeInputField.value;
    if (target) target.focus();
  })
})

// Markdown options
marked.setOptions({ breaks: true, gfm: true })
</script>

<template>
  <AuthPage v-if="!currentUserId" @auth-success="onAuthSuccess" />
  
  <template v-else>
    <div class="chat-app-root">
      <!-- Sidebar -->
      <aside class="sidebar" :class="{ collapsed: isSidebarCollapsed }">
        <div class="sidebar-top">
          <button class="sidebar-icon-btn" @click="toggleSidebar" title="Toggle Sidebar">
            <span v-html="Icons.Sidebar"></span>
          </button>
          
          <button class="sidebar-item" @click="startNewChat" :class="{ 'icons-only': isSidebarCollapsed }">
            <span v-html="Icons.NewChat"></span>
            <span v-if="!isSidebarCollapsed" class="item-label">New chat</span>
          </button>

          <button v-if="!currentUser?.isGuest" class="sidebar-item" @click="toggleSearchModal" :class="{ 'icons-only': isSidebarCollapsed }">
            <span v-html="Icons.Search"></span>
            <span v-if="!isSidebarCollapsed" class="item-label">Search history</span>
          </button>
        </div>

        <div class="conversations-list" v-if="!isSidebarCollapsed && !currentUser?.isGuest">
          <div class="section-label">Your chats</div>
          <div 
            v-for="conv in conversations" 
            :key="conv._id" 
            class="conv-item"
            :class="{ active: conversationId === conv._id }"
            @click="router.push(`/c/${conv._id}`)"
          >
            <span class="conv-title">{{ conv.title }}</span>
            <button @click.stop="handleRemoveConversation(conv._id)" class="delete-conv-btn">×</button>
          </div>
        </div>

        <div class="sidebar-footer" v-if="currentUser && !currentUser.isGuest">
          <!-- User Menu Dropdown -->
          <div v-if="isUserMenuOpen" class="user-menu" @click.stop>
            <button class="menu-item">Settings</button>
            <button @click="handleLogout" class="menu-item logout">Log out</button>
          </div>

          <!-- Avatar Row -->
          <div class="avatar-trigger-row" @click="toggleUserMenu" :class="{ 'icons-only': isSidebarCollapsed }">
            <div class="avatar-placeholder">
              {{ displayName[0]?.toUpperCase() }}
            </div>
            <span v-if="!isSidebarCollapsed" class="username">{{ displayName }}</span>
          </div>
        </div>
      </aside>

      <div ref="mainWrapper" class="main-content-wrapper" :class="{ 'with-canvas': isCanvasSidebarOpen && activeCanvas, 'is-resizing': isResizing }">
        <main 
          class="chat-container"
          :style="isCanvasSidebarOpen && activeCanvas ? { flex: '1 1 0', minWidth: '250px' } : {}"
        >
          <header class="chat-header">
            <div class="model-picker-container">
              <div class="model-info" @click.stop="isModelPickerOpen = !isModelPickerOpen">
                <span class="model-name">
                  {{ availableModels.find(m => m.id === selectedModel)?.name }}
                </span>
                <span class="chevron-down" v-html="Icons.ChevronDown"></span>
              </div>

              <div v-if="isModelPickerOpen" class="model-dropdown">
                <div 
                  v-for="model in availableModels" 
                  :key="model.id" 
                  class="model-option"
                  :class="{ active: selectedModel === model.id }"
                  @click="selectedModel = model.id; isModelPickerOpen = false"
                >
                  <div class="option-header">
                    <span class="option-name">{{ model.name }}</span>
                    <span v-if="selectedModel === model.id" class="check-icon" v-html="Icons.Check"></span>
                  </div>
                  <div class="option-desc">{{ model.desc }}</div>
                </div>
              </div>
            </div>

            <!-- Demo Mode Header Actions -->
            <div v-if="currentUser?.isGuest" class="demo-header-actions">
              <button class="login-btn" @click="isAuthModalOpen = true; authModalType = 'login'">Log in</button>
              <button class="signup-btn" @click="isAuthModalOpen = true; authModalType = 'signup'">Sign up for free</button>
            </div>
          </header>

          <div class="messages-list" ref="messagesContainer">
            <div v-if="!conversationId" class="welcome-screen">
              <h1>What can LitlAI help with?</h1>
              
              <div class="input-container">
                <div class="input-box">
                  <div 
                    ref="welcomeInputField"
                    class="content-editable"
                    contenteditable="true"
                    placeholder="Ask anything"
                    @input="updateInput"
                    @keydown="onKeydown"
                  ></div>
                  
                  <div class="input-actions">
                    <div class="action-row left">
                      <div class="tools-wrapper">
                        <button class="tool-btn-plus" @click="toggleToolsMenu" :class="{ active: isToolsMenuOpen }">
                          <span v-html="Icons.Plus"></span>
                        </button>
                        
                        <!-- Active Tool Badge -->
                        <button v-if="activeTool === 'code_interpreter'" class="active-tool-badge" @click="toggleTool('code_interpreter')">
                          <span class="tool-icon-small" v-html="Icons.Terminal"></span>
                          <span>Code Interpreter</span>
                        </button>         
                        <button v-if="activeTool === 'search'" class="active-tool-badge" @click="toggleTool('search')">
                          <span class="tool-icon-small" v-html="Icons.Global"></span>
                          <span>Search</span>
                        </button>
                        <button v-if="activeTool === 'canvas'" class="active-tool-badge" @click="toggleTool('canvas')">
                          <span class="tool-icon-small" v-html="Icons.Canvas"></span>
                          <span>Canvas</span>
                        </button>

                        <!-- Tools Dropdown -->
                        <div v-if="isToolsMenuOpen" class="tools-menu" @click.stop>
                           <div class="tools-menu-header">Add capability</div>
                           <button class="tools-menu-item" @click="toggleTool('code_interpreter')">
                              <span class="tool-icon" v-html="Icons.Terminal"></span>
                              <div class="tool-info">
                                <span class="tool-name">Code Interpreter</span>
                                <span class="tool-desc">Run Python code</span>
                              </div>
                           </button>
                           <!-- Placeholder for future tools -->
                           <button class="tools-menu-item" @click="toggleTool('search')">
                              <span class="tool-icon" v-html="Icons.Global"></span>
                              <div class="tool-info">
                                <span class="tool-name">Search</span>
                                <span class="tool-desc">Search web results</span>
                              </div>
                           </button>
                           <button class="tools-menu-item" @click="toggleTool('canvas')">
                              <span class="tool-icon" v-html="Icons.Canvas"></span>
                              <div class="tool-info">
                                <span class="tool-name">Canvas</span>
                                <span class="tool-desc">Create/edit content</span>
                              </div>
                           </button>
                        </div>
                      </div>
                    </div>
                    
                    <div class="action-row right">
                       <button 
                      @click="handleSend" 
                      class="submit-btn" 
                      :disabled="!newMessage.trim() || isTyping"
                    >
                      <span v-html="Icons.Send"></span>
                    </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <template v-else>
              <div v-for="msg in messages" :key="msg._id" :class="['message', msg.author]">
                <div 
                  v-if="msg.author === 'ai'" 
                  class="message-content markdown-body"
                >
                  <div v-html="renderMarkdown(msg.body || '')"></div>
                  
                  <!-- Inline Canvas Widget (Show for all types now) -->
                  <div v-if="getCanvasFromMessage(msg.body)" class="canvas-widget" @click="isCanvasSidebarOpen = true">
                    <div class="widget-header">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="tool-icon-small" v-html="Icons.Canvas"></span>
                        <span class="widget-title">{{ getCanvasFromMessage(msg.body).title }}</span>
                        <span v-if="getCanvasFromMessage(msg.body).type === 'sidebar'" class="badge-sidebar">Sidebar</span>
                      </div>
                      <div class="widget-actions">
                        <button @click.stop="copyCanvas" class="action-btn" title="Copy" v-html="isCopied ? Icons.Check : Icons.Copy"></button>
                        <button @click.stop="downloadCanvas" class="action-btn" title="Download" v-html="Icons.Download"></button>
                        <button @click.stop="isCanvasSidebarOpen = true" class="action-btn" title="Open" v-html="Icons.Plus"></button>
                      </div>
                    </div>
                    <div class="widget-body markdown-body" v-html="renderMarkdown(getCanvasFromMessage(msg.body).content.slice(0, 200) + (getCanvasFromMessage(msg.body).content.length > 200 ? '...' : ''))">
                    </div>
                  </div>
                </div>
                
                <!-- Code Output Display -->
                <div v-if="codeOutputs[msg._id]" class="code-output-wrapper">
                  <div class="output-label" v-if="codeOutputs[msg._id].status === 'done'">Output:</div>
                  <div class="output-box" :class="{ 'running': codeOutputs[msg._id].status === 'running' }">
                    {{ codeOutputs[msg._id].status === 'running' ? 'Running code...' : codeOutputs[msg._id].output }}
                  </div>
                </div>

                <div v-if="msg.author !== 'ai'" class="message-content">{{ msg.body }}</div>
              </div>
              
              <div v-if="isTyping && (!messages?.length || messages[messages.length-1].author === 'user')" class="message ai">
                <div class="message-content">...</div>
              </div>
            </template>
          </div>

          <!-- Plan Note & Bottom Input (Conversation Mode) -->
          <div class="bottom-area">
            <div v-if="conversationId" class="input-area">
              <div class="input-container">
                <div class="input-box">
                  <div 
                    ref="inputField"
                    class="content-editable"
                    contenteditable="true"
                    placeholder="Ask anything"
                    @input="updateInput"
                    @keydown="onKeydown"
                  ></div>
                  <div class="input-actions">
                    <div class="action-row left">
                      <div class="tools-wrapper">
                        <button class="tool-btn-plus" @click="toggleToolsMenu" :class="{ active: isToolsMenuOpen }">
                          <span v-html="Icons.Plus"></span>
                        </button>
                        
                        <!-- Active Tool Badge -->
                        <button v-if="activeTool === 'code_interpreter'" class="active-tool-badge" @click="toggleTool('code_interpreter')">
                          <span class="tool-icon-small" v-html="Icons.Terminal"></span>
                          <span>Code Interpreter</span>
                        </button>         
                        <button v-if="activeTool === 'search'" class="active-tool-badge" @click="toggleTool('search')">
                          <span class="tool-icon-small" v-html="Icons.Global"></span>
                          <span>Search</span>
                        </button>
                        <button v-if="activeTool === 'canvas'" class="active-tool-badge" @click="toggleTool('canvas')">
                          <span class="tool-icon-small" v-html="Icons.Canvas"></span>
                          <span>Canvas</span>
                        </button>

                        <!-- Tools Dropdown (Reuse styles) -->
                        <div v-if="isToolsMenuOpen" class="tools-menu bottom-up" @click.stop>
                           <div class="tools-menu-header">Add capability</div>
                           <button class="tools-menu-item" @click="toggleTool('code_interpreter')">
                              <span class="tool-icon" v-html="Icons.Terminal"></span>
                              <div class="tool-info">
                                <span class="tool-name">Code Interpreter</span>
                                <span class="tool-desc">Run Python code</span>
                              </div>
                           </button>
                           <button class="tools-menu-item" @click="toggleTool('search')">
                              <span class="tool-icon" v-html="Icons.Global"></span>
                              <div class="tool-info">
                                <span class="tool-name">Search</span>
                                <span class="tool-desc">Search web results</span>
                              </div>
                           </button>
                           <button class="tools-menu-item" @click="toggleTool('canvas')">
                              <span class="tool-icon" v-html="Icons.Canvas"></span>
                              <div class="tool-info">
                                <span class="tool-name">Canvas</span>
                                <span class="tool-desc">Create/edit content</span>
                              </div>
                           </button>
                        </div>
                      </div>
                    </div>
                    
                    <div class="action-row right">
                       <button 
                        @click="handleSend" 
                        class="submit-btn" 
                        :disabled="!newMessage.trim() || isTyping"
                      >
                        <span v-html="Icons.Send"></span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="plan-note">
              <p>AI can make mistakes. Please double-check responses.</p>
            </div>
          </div>
        </main>

        <!-- Resize Handle -->
        <div 
          v-if="isCanvasSidebarOpen && activeCanvas" 
          class="resize-handle" 
          :class="{ active: isResizing }"
          @mousedown="startResizing"
        ></div>

        <!-- Canvas Split View -->
        <div 
          v-if="isCanvasSidebarOpen && activeCanvas" 
          class="canvas-split-view"
          :style="{ flex: '0 0 ' + canvasWidth + '%', minWidth: '0' }"
        >
          <div class="canvas-sidebar-header">
            <div class="canvas-sidebar-title">{{ activeCanvas.title }}</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span v-if="canvasSaveStatus" style="font-size: 12px; color: #888;">{{ canvasSaveStatus }}</span>
              <button @click="isEditingCanvas = !isEditingCanvas" class="action-btn" :title="isEditingCanvas ? 'Preview' : 'Edit Source'" :class="{ active: isEditingCanvas }" v-html="isEditingCanvas ? Icons.Eye : Icons.Canvas"></button>
              <button @click="copyCanvas" class="action-btn" title="Copy" v-html="isCopied ? Icons.Check : Icons.Copy"></button>
              <button @click="downloadCanvas" class="action-btn" title="Download" v-html="Icons.Download"></button>
              <button @click="isCanvasSidebarOpen = false" class="canvas-close-btn" v-html="Icons.Close"></button>
            </div>
          </div>
          <div class="canvas-sidebar-content">
            <textarea 
              v-if="isEditingCanvas"
              class="editable-content" 
              :value="activeCanvas.content"
              @input="e => updateCanvasContent(e.target.value)"
              placeholder="Start writing..."
            ></textarea>
            <div 
              v-else 
              class="markdown-body" 
              v-html="renderMarkdown(activeCanvas.content)"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Auth Modal Overlay -->
    <AuthPage 
      v-if="isAuthModalOpen" 
      :initialIsLogin="authModalType === 'login'"
      @close="isAuthModalOpen = false"
      @auth-success="onAuthSuccess"
    />

    <!-- Search Modal -->
    <div v-if="isSearchModalOpen" class="search-modal-overlay" @click="toggleSearchModal">
      <div class="search-modal" @click.stop>
        <div class="search-input-wrapper">
          <span v-html="Icons.Search"></span>
          <input 
            v-model="searchQuery" 
            type="text" 
            class="search-modal-input" 
            placeholder="Search your chats..."
            autofocus
          />
        </div>
        
        <div class="search-results">
          <div v-if="filteredConversations.length === 0" class="no-results">
            No chats found for "{{ searchQuery }}"
          </div>
          <button 
            v-for="conv in filteredConversations" 
            :key="conv._id" 
            class="search-result-item"
            @click="navigateToChat(conv._id)"
          >
            <div class="search-result-title">{{ conv.title }}</div>
            <div class="search-result-meta">Conversation from {{ new Date(conv._creationTime).toLocaleDateString() }}</div>
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.bottom-area {
  padding-bottom: 0.5rem;
}

.model-info {
  display: flex;
  align-items: center;
  font-size: 1.1rem;
  cursor: pointer;
}

.delete-conv-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: #ccc;
  cursor: pointer;
}
</style>
