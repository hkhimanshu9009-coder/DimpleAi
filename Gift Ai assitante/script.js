document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const chatHistory = document.getElementById('chat-history');
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const welcomeContainer = document.getElementById('welcome-container');
    const modelBtns = document.querySelectorAll('.model-btn');
    const bdayOverlay = document.getElementById('birthday-overlay');

    // Profile Elements
    const settingsBtn = document.getElementById('settings-btn');
    const profileModal = document.getElementById('profile-modal');
    const cancelProfile = document.getElementById('cancel-profile');
    const saveProfile = document.getElementById('save-profile');
    const nameInput = document.getElementById('name-input');
    const roleInput = document.getElementById('role-input');
    const avatarInput = document.getElementById('avatar-input');
    const profilePreview = document.getElementById('profile-preview');
    const displayName = document.getElementById('display-name');
    const userRole = document.getElementById('user-role');
    const userAvatarTop = document.getElementById('user-avatar-top');
    const badgeAvatar = document.getElementById('badge-avatar');

    // Sidebar Toggle Logic
    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar');

    function toggleSidebar() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('closed');
        }
    }

    if (menuBtn) menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });

    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => {
        // Always close/collapse based on device
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
        else sidebar.classList.add('closed');
    });

    // Close when clicking outside (Mobile Only)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            e.target !== menuBtn) {
            sidebar.classList.remove('open');
        }
    });

    // State
    let currentModel = 'groq'; // Default based on earlier config
    let isListening = false;
    let userProfile = JSON.parse(localStorage.getItem('userProfile')) || {
        name: 'Dimple',
        role: 'CEO & FOUNDER',
        avatar: null
    };
    let chatHistoryData = JSON.parse(localStorage.getItem('chatHistory')) || [];

    // --- Profile Logic ---
    const updateProfileUI = () => {
        if (displayName) displayName.textContent = userProfile.name;
        if (userRole) userRole.textContent = userProfile.role;
        if (nameInput) nameInput.value = userProfile.name;
        if (roleInput) roleInput.value = userProfile.role;

        const avatarHTML = userProfile.avatar
            ? `<img src="${userProfile.avatar}" alt="User">`
            : `<i class="fa-solid fa-user"></i>`;

        if (profilePreview) profilePreview.innerHTML = avatarHTML;
        if (userAvatarTop) userAvatarTop.innerHTML = avatarHTML;
        if (badgeAvatar) badgeAvatar.innerHTML = avatarHTML;
    };

    if (settingsBtn && profileModal) settingsBtn.addEventListener('click', () => profileModal.classList.remove('hidden'));
    if (cancelProfile && profileModal) cancelProfile.addEventListener('click', () => profileModal.classList.add('hidden'));

    if (avatarInput && profilePreview) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    userProfile.avatar = event.target.result;
                    profilePreview.innerHTML = `<img src="${userProfile.avatar}" alt="User">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (saveProfile && nameInput && roleInput && profileModal) {
        saveProfile.addEventListener('click', () => {
            userProfile.name = nameInput.value || 'Dimple';
            userProfile.role = roleInput.value || 'CEO & FOUNDER';
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            updateProfileUI();
            profileModal.classList.add('hidden');
        });
    }

    function loadChatHistory() {
        if (chatHistoryData.length > 0) {
            if (welcomeContainer) welcomeContainer.classList.add('hidden');
            chatHistoryData.forEach(item => {
                if (item.type === 'text') {
                    addMessage(item.text, item.sender, true);
                } else if (item.type === 'image') {
                    addImageMessage(item.url, item.sender, item.caption, true);
                }
            });
        }
    }

    updateProfileUI(); // Init on load
    loadChatHistory(); // Load history on load

    // --- Global Helpers ---
    window.setInput = (text) => {
        if (!userInput) return;
        userInput.value = text;
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
        sendBtn.removeAttribute('disabled');
        sendMessage();
    };

    window.closeBirthday = () => {
        if (bdayOverlay) bdayOverlay.classList.add('hidden');
    };

    // --- Birthday Logic ---
    const checkBirthday = () => {
        const today = new Date();
        // Month is 0-indexed (Feb is 1)
        if (today.getMonth() === 1 && today.getDate() === 3) {
            triggerBirthdayMode();
        }
    };

    function triggerBirthdayMode() {
        if (bdayOverlay) bdayOverlay.classList.remove('hidden');
        fireConfetti();
    }

    function fireConfetti() {
        if (typeof confetti !== 'function') return;

        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 11000 };

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } }));
        }, 250);
    }

    try { checkBirthday(); } catch (e) { console.error(e); }

    // --- Model Switcher ---
    modelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modelBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentModel = btn.dataset.model;
        });
    });

    // --- Voice Logic (Himu) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition && voiceBtn) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            voiceBtn.classList.add('listening');
            voiceBtn.style.color = 'var(--accent-primary)';
        };

        recognition.onend = () => {
            isListening = false;
            voiceBtn.classList.remove('listening');
            voiceBtn.style.color = 'var(--text-secondary)';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            userInput.style.height = 'auto'; // Force resize
            userInput.style.height = (userInput.scrollHeight) + 'px';
            sendBtn.removeAttribute('disabled');
            sendMessage(true); // Speak response ONLY for voice input
        };

        voiceBtn.addEventListener('click', () => {
            if (isListening) recognition.stop();
            else recognition.start();
        });
    }

    // --- Chat Logic ---
    if (userInput) {
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if (this.value.trim().length > 0) sendBtn.removeAttribute('disabled');
            else sendBtn.setAttribute('disabled', 'true');
        });

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            if (welcomeContainer) welcomeContainer.classList.remove('hidden');
            if (chatHistory) chatHistory.innerHTML = '';
            chatHistoryData = [];
            localStorage.removeItem('chatHistory');
            userInput.value = '';
            userInput.style.height = 'auto';
        });
    }

    async function sendMessage(shouldSpeak = false) {
        // If triggered by click event, shouldSpeak might be the Event object
        if (typeof shouldSpeak !== 'boolean') shouldSpeak = false;

        const text = userInput.value.trim();
        if (!text) return;

        if (welcomeContainer) welcomeContainer.classList.add('hidden');

        addMessage(text, 'user');

        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.setAttribute('disabled', 'true');

        // Determine request type for animation
        const isImage = text.toLowerCase().match(/(generate|create|draw|make|imagine|magine).*(image|picture|drawing|photo|art)/);
        const isVideo = text.toLowerCase().match(/(generate|create|make|imagine|magine).*(video|movie|clip)/);

        let type = 'text';
        if (isImage) type = 'image';
        if (isVideo) type = 'video';

        const loadingId = addLoading(type);

        try {
            let endpoint = '/chat';
            let body = { message: text, model: currentModel };

            if (isImage) {
                endpoint = '/generate_image';
                body = { prompt: text };
            } else if (isVideo) {
                endpoint = '/generate_video';
                body = { prompt: text };
            }

            const response = await fetch(`${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            removeMessage(loadingId);

            if (data.response && !isImage && !isVideo && shouldSpeak) {
                speakText(data.response);
            }

            if (isImage) {
                if (data.image_url) addImageMessage(data.image_url, 'assistant', data.response);
                else addMessage("Sorry, I couldn't generate the image.", 'assistant');
            } else if (isVideo) {
                if (data.video_url) {
                    addMessage(data.response + `<div style="margin-top: 10px;"><video controls autoplay loop muted src="${data.video_url}" style="width: 100%; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 15px rgba(0,0,0,0.3);"></video></div>`, 'assistant');
                } else {
                    addMessage(data.response || "Video processing started...", 'assistant');
                }
            } else {
                addMessage(data.response || "No response received.", 'assistant');
            }

        } catch (error) {
            removeMessage(loadingId);
            addMessage("I'm having trouble connecting to my brain. Is the server running? 🧠", 'assistant');
        }
    }

    function addMessage(text, sender, isInitialLoad = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        const avatarHTML = sender === 'assistant'
            ? `<div class="avatar ai-avatar"><i class="fa-solid fa-robot"></i></div>`
            : `<div class="avatar user-avatar">${userProfile.avatar
                ? `<img src="${userProfile.avatar}" alt="User">`
                : `<i class="fa-solid fa-user"></i>`}</div>`;

        msgDiv.innerHTML = `
            ${avatarHTML}
            <div class="message-content">
                ${formatText(text)}
            </div>
        `;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();

        if (!isInitialLoad) {
            chatHistoryData.push({ type: 'text', text, sender });
            localStorage.setItem('chatHistory', JSON.stringify(chatHistoryData));
        }
    }

    function addImageMessage(url, sender, caption, isInitialLoad = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message assistant-message`;
        msgDiv.innerHTML = `
            <div class="avatar ai-avatar">
                <i class="fa-solid fa-image"></i>
            </div>
            <div class="message-content">
                <p>${caption || "Here is your creation:"}</p>
                <img src="${url}" style="max-width:100%; border-radius:16px; margin-top:12px; box-shadow:0 8px 30px rgba(0,0,0,0.3);" alt="Generated">
            </div>
        `;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();

        if (!isInitialLoad) {
            chatHistoryData.push({ type: 'image', url, sender, caption });
            localStorage.setItem('chatHistory', JSON.stringify(chatHistoryData));
        }
    }

    function addLoading(type = 'text') {
        const id = 'loading-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.className = `message assistant-message`;
        msgDiv.id = id;

        let content = '';
        if (type === 'image') {
            content = `
                <div class="generating-loader">
                    <i class="fa-solid fa-palette generating-icon"></i>
                    <span>Creating your masterpiece...</span>
                </div>
            `;
        } else if (type === 'video') {
            content = `
                <div class="generating-loader">
                    <i class="fa-solid fa-video generating-icon"></i>
                    <span>Rendering video clip...</span>
                </div>
            `;
        } else {
            content = `
                 <div class="message-content">
                    <i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="avatar ai-avatar">
                <i class="fa-solid fa-robot"></i>
            </div>
            ${content}
        `;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function formatText(text) {
        // Handle Code Blocks: ```language \n code ```
        let formatted = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const id = 'code-' + Math.random().toString(36).substr(2, 9);
            const language = lang || 'code';

            // Escape HTML in code
            const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `
                <div class="code-container">
                    <div class="code-header">
                        <span class="code-lang">${language}</span>
                        <button class="copy-code-btn" onclick="copyToClipboard('${id}', this)">
                            <i class="fa-regular fa-copy"></i> Copy
                        </button>
                    </div>
                    <div class="code-content">
                        <pre id="${id}"><code>${escapedCode.trim()}</code></pre>
                    </div>
                </div>
            `;
        });

        // Inline Bold and Code
        formatted = formatted
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');

        return formatted;
    }

    window.copyToClipboard = (id, btn) => {
        const codeElement = document.getElementById(id);
        if (!codeElement) return;

        const text = codeElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            btn.style.borderColor = '#30d158';
            btn.style.color = '#30d158';

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 2000);
        });
    };

    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const himuVoice = voices.find(v => v.name.includes("Google US English")) ||
                voices.find(v => v.name.includes("David")) ||
                voices[0];
            if (himuVoice) utterance.voice = himuVoice;
            utterance.pitch = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

    // --- Sharing Logic ---
    window.shareTo = (platform) => {
        const url = window.location.href;
        const text = "Check out Dimple AI - Your Executive Assistant! 🚀";
        let shareUrl = '';

        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
                break;
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(url).then(() => {
                    const copyBtn = document.querySelector('.share-btn.copy');
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    copyBtn.style.background = '#30d158';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.background = '';
                    }, 2000);
                });
                return;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank');
        }
    };
});
