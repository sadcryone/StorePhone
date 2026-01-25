// ================= CHAT SUPPORT SYSTEM =================
// Module chat support có thể tái sử dụng trên nhiều trang

import { 
    collection,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    onSnapshot,
    limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export class ChatSupport {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        
        this.currentChatId = null;
        this.unreadCount = 0;
        this.messageListener = null;
        this.chatInitialized = false;
        this.chatOpen = false;
        
        this.elements = {};
        
        // Thêm storage key để lưu chatId
        this.storageKey = 'chat_last_session_id';
    }
    
    // Khởi tạo chat system
    async init() {
        this.initializeElements();
        
        // Chỉ tiếp tục nếu tìm thấy các elements cần thiết
        if (!this.elements.chatBubble) {
            return false;
        }
        
        this.initChatUI();
        
        // Kiểm tra chat từ session trước
        const previousChatId = await this.checkPreviousSession();
        
        // Lắng nghe thay đổi trạng thái đăng nhập
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                if (!this.chatInitialized) {
                    // Ưu tiên sử dụng chat từ session trước nếu có
                    if (previousChatId && !this.currentChatId) {
                        this.currentChatId = previousChatId;
                        
                        // Kiểm tra và mở lại chat nếu cần
                        const chatDoc = await getDoc(doc(this.db, "chats", previousChatId));
                        if (chatDoc.exists()) {
                            const data = chatDoc.data();
                            const user = this.auth.currentUser;
                            
                            // Kiểm tra xem chat này có thuộc về user hiện tại không
                            if (user && data.participants.includes(user.uid)) {
                                if (data.status === 'closed') {
                                    await updateDoc(doc(this.db, "chats", previousChatId), {
                                        status: 'open',
                                        lastUpdated: serverTimestamp()
                                    });
                                }
                                
                                await this.loadChatMessages(previousChatId);
                                this.setupMessageListener(previousChatId);
                                this.updateUnreadBadge(data);
                                this.chatInitialized = true;
                                return;
                            }
                        }
                        // Nếu chat không hợp lệ, xóa khỏi storage
                        localStorage.removeItem(this.storageKey);
                        this.currentChatId = null;
                    }
                    
                    // Nếu không có session cũ hoặc không hợp lệ
                    await this.initChatSystem(user);
                    this.chatInitialized = true;
                }
            } else {
                // User đăng xuất
                this.chatInitialized = false;
                this.currentChatId = null;
                if (this.messageListener) {
                    this.messageListener();
                    this.messageListener = null;
                }
                this.displayWelcomeMessage();
            }
        });
        
        return true;
    }
    
    // Kiểm tra session cũ từ localStorage
    async checkPreviousSession() {
        const lastChatId = localStorage.getItem(this.storageKey);
        if (lastChatId) {
            try {
                const chatDoc = await getDoc(doc(this.db, "chats", lastChatId));
                if (chatDoc.exists()) {
                    const data = chatDoc.data();
                    const user = this.auth.currentUser;
                    
                    // Kiểm tra xem chat này có thuộc về user hiện tại không
                    if (user && data.participants.includes(user.uid)) {
                        return lastChatId;
                    }
                }
            } catch (error) {
                // Lỗi kiểm tra session cũ
            }
        }
        return null;
    }
    
    // Lưu chat session
    saveChatSession(chatId) {
        if (chatId) {
            localStorage.setItem(this.storageKey, chatId);
        }
    }
    
    // Khởi tạo các DOM elements
    initializeElements() {
        this.elements = {
            chatBubble: document.getElementById('chat-bubble'),
            chatContainer: document.getElementById('chat-container'),
            chatClose: document.getElementById('chat-close'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send'),
            chatMessages: document.getElementById('chat-messages'),
            chatBadge: document.getElementById('chat-badge')
        };
    }
    
    // Khởi tạo UI và event listeners
    initChatUI() {
        const { chatBubble, chatClose, chatInput, chatSend } = this.elements;
        
        // Toggle chat window
        chatBubble.addEventListener('click', () => this.toggleChat());
        chatClose.addEventListener('click', () => this.closeChat());
        
        // Send message
        chatSend.addEventListener('click', () => this.sendMessage());
        
        // Send on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Enable/disable send button
        chatInput.addEventListener('input', () => {
            chatSend.disabled = chatInput.value.trim() === '';
        });
    }
    
    // Toggle chat window
    toggleChat() {
        const { chatContainer, chatBadge } = this.elements;
        const user = this.auth.currentUser;
        
        chatContainer.classList.toggle('open');
        this.chatOpen = chatContainer.classList.contains('open');
        
        if (this.chatOpen) {
            // Reset badge
            this.unreadCount = 0;
            chatBadge.style.display = 'none';
            
            // Nếu user đã đăng nhập, khởi tạo chat system
            if (user && !this.chatInitialized) {
                this.initChatSystem(user);
                this.chatInitialized = true;
            }
            
            // Mark messages as read if chat is open
            if (this.currentChatId) {
                this.markMessagesAsRead(this.currentChatId);
            }
            
            // Focus input
            setTimeout(() => {
                this.elements.chatInput.focus();
            }, 300);
        }
    }
    
    // Close chat window
    closeChat() {
        const { chatContainer } = this.elements;
        chatContainer.classList.remove('open');
        this.chatOpen = false;
    }
    
    // Khởi tạo chat system với user
    async initChatSystem(user) {
        await this.loadOrCreateChat(user.uid, user.email);
    }
    
    // Load existing chat or create new one - ĐÃ SỬA HOÀN TOÀN
    async loadOrCreateChat(userId, userEmail) {
        try {
            // BƯỚC 1: TÌM CHAT ĐANG MỞ TRƯỚC
            try {
                const openChatQuery = query(
                    collection(this.db, "chats"),
                    where("participants", "array-contains", userId),
                    where("status", "==", "open"),
                    orderBy("lastUpdated", "desc"),
                    limit(1)
                );
                
                const openChatSnapshot = await getDocs(openChatQuery);
                
                if (!openChatSnapshot.empty) {
                    // Tìm thấy chat đang mở
                    const chatDoc = openChatSnapshot.docs[0];
                    const data = chatDoc.data();
                    this.currentChatId = chatDoc.id;
                    
                    // Lưu session
                    this.saveChatSession(this.currentChatId);
                    
                    await this.loadChatMessages(this.currentChatId);
                    this.setupMessageListener(this.currentChatId);
                    this.updateUnreadBadge(data);
                    return;
                }
            } catch (indexError) {
                // Không có index cho query chat đang mở, tiếp tục tìm chat khác
            }
            
            // BƯỚC 2: Nếu không có chat đang mở, tìm chat gần nhất (có thể đã đóng)
            try {
                let allChatsQuery = query(
                    collection(this.db, "chats"),
                    where("participants", "array-contains", userId),
                    orderBy("lastUpdated", "desc"),
                    limit(3) // Lấy 3 chat gần nhất để kiểm tra
                );
                
                const allChatsSnapshot = await getDocs(allChatsQuery);
                
                if (!allChatsSnapshot.empty) {
                    // Tìm chat gần nhất có unread message hoặc mới nhất
                    let foundChat = null;
                    let foundChatData = null;
                    
                    for (const docSnap of allChatsSnapshot.docs) {
                        const data = docSnap.data();
                        
                        // Ưu tiên chat có unread message
                        if (data.unreadCount > 0) {
                            foundChat = docSnap;
                            foundChatData = data;
                            break;
                        }
                        
                        // Hoặc chat mới nhất
                        if (!foundChat) {
                            foundChat = docSnap;
                            foundChatData = data;
                        }
                    }
                    
                    if (foundChat) {
                        this.currentChatId = foundChat.id;
                        
                        // Lưu session
                        this.saveChatSession(this.currentChatId);
                        
                        // Tự động mở lại chat nếu đã đóng
                        if (foundChatData.status === 'closed') {
                            await updateDoc(doc(this.db, "chats", this.currentChatId), {
                                status: 'open',
                                lastUpdated: serverTimestamp()
                            });
                        }
                        
                        await this.loadChatMessages(this.currentChatId);
                        this.setupMessageListener(this.currentChatId);
                        this.updateUnreadBadge(foundChatData);
                        return;
                    }
                }
            } catch (allChatsError) {
                // Lỗi tìm chat gần nhất
            }
            
            // BƯỚC 3: Nếu không tìm thấy chat nào, tạo mới
            this.currentChatId = await this.createNewChat(userId, userEmail);
            await this.loadChatMessages(this.currentChatId);
            this.setupMessageListener(this.currentChatId);
            
        } catch (error) {
            // Hiển thị thông báo lỗi thân thiện
            this.displayWelcomeMessage();
            
            // Vẫn tạo chat mới nếu có lỗi
            try {
                this.currentChatId = await this.createNewChat(userId, userEmail);
                await this.loadChatMessages(this.currentChatId);
                this.setupMessageListener(this.currentChatId);
            } catch (createError) {
                // Lỗi tạo chat mới
            }
        }
    }
    
    // Create new chat - ĐÃ THÊM LƯU SESSION
    async createNewChat(userId, userEmail) {
        try {
            const chatData = {
                participants: [userId, "admin"],
                status: "open",
                lastMessage: "👋 Chào bạn! Tôi có thể giúp gì cho bạn?",
                lastUpdated: serverTimestamp(),
                createdAt: serverTimestamp(),
                userName: userEmail.split('@')[0] || 'Người dùng',
                userEmail: userEmail,
                unreadCount: 0
            };
            
            const chatRef = await addDoc(collection(this.db, "chats"), chatData);
            
            await addDoc(collection(this.db, "chats", chatRef.id, "messages"), {
                senderId: "system",
                text: "👋 Chào bạn! Tôi có thể giúp gì cho bạn? Hãy gửi tin nhắn và chúng tôi sẽ trả lời sớm nhất!",
                timestamp: serverTimestamp(),
                read: false
            });
            
            // Lưu chatId vào session
            this.saveChatSession(chatRef.id);
            
            return chatRef.id;
        } catch (error) {
            // Lỗi tạo chat mới
            throw error;
        }
    }
    
    // Load chat messages
    async loadChatMessages(chatId) {
        try {
            const q = query(
                collection(this.db, "chats", chatId, "messages"),
                orderBy("timestamp")
            );
            
            const querySnapshot = await getDocs(q);
            const messages = [];
            
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                messages.push({
                    id: docSnap.id,
                    ...data,
                    timestamp: data.timestamp?.toDate?.() || new Date()
                });
            });
            
            if (messages.length === 0) {
                this.displayWelcomeMessage();
                return;
            }
            
            this.renderMessages(messages);
            
            const unreadMessages = messages.filter(msg => 
                (msg.senderId === 'admin' || msg.senderId === 'system') && 
                !msg.read
            );
            
            this.updateUnreadCount(unreadMessages.length);
            
        } catch (error) {
            this.displayWelcomeMessage();
        }
    }
    
    // Setup real-time message listener
    setupMessageListener(chatId) {
        if (this.messageListener) {
            this.messageListener();
        }
        
        try {
            const q = query(
                collection(this.db, "chats", chatId, "messages"),
                orderBy("timestamp")
            );
            
            this.messageListener = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    messages.push({
                        id: docSnap.id,
                        ...data,
                        timestamp: data.timestamp?.toDate?.() || new Date()
                    });
                });
                
                messages.sort((a, b) => a.timestamp - b.timestamp);
                
                this.renderMessages(messages);
                
                const { chatContainer, chatBadge } = this.elements;
                
                const unreadAdminMessages = messages.filter(msg => 
                    (msg.senderId === 'admin' || msg.senderId === 'system') && 
                    !msg.read
                );
                
                if (!chatContainer.classList.contains('open') && unreadAdminMessages.length > 0) {
                    this.updateUnreadCount(unreadAdminMessages.length);
                } else if (chatContainer.classList.contains('open')) {
                    this.unreadCount = 0;
                    chatBadge.style.display = 'none';
                }
                
                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            });
            
        } catch (error) {
            // Lỗi setting up message listener
        }
    }
    
    // Render messages
    renderMessages(messages) {
        const { chatMessages } = this.elements;
        if (!chatMessages) return;
        
        chatMessages.innerHTML = messages.map(msg => {
            const isUser = msg.senderId !== 'admin' && msg.senderId !== 'system';
            const isSystem = msg.senderId === 'system';
            const messageTime = this.formatTime(msg.timestamp);
            
            if (isSystem) {
                return `
                    <div class="welcome-message">
                        <p>${msg.text}</p>
                    </div>
                `;
            }
            
            return `
                <div class="message ${isUser ? 'user' : 'admin'}">
                    <div class="message-text">${msg.text}</div>
                    <div class="message-time">${messageTime}</div>
                </div>
            `;
        }).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Send message
    async sendMessage() {
        const { chatInput } = this.elements;
        const user = this.auth.currentUser;
        
        if (!user) {
            alert("Vui lòng đăng nhập để sử dụng chat!");
            return;
        }
        
        const messageText = chatInput.value.trim();
        if (!messageText) return;
        
        if (!this.currentChatId) {
            try {
                this.currentChatId = await this.createNewChat(user.uid, user.email);
                this.setupMessageListener(this.currentChatId);
            } catch (error) {
                alert("Lỗi tạo chat: " + error.message);
                return;
            }
        }
        
        if (!this.currentChatId) {
            alert("Lỗi: Không thể tạo chat. Vui lòng thử lại!");
            return;
        }
        
        try {
            const messageData = {
                senderId: user.uid,
                text: messageText,
                timestamp: serverTimestamp(),
                read: false
            };
            
            await addDoc(collection(this.db, "chats", this.currentChatId, "messages"), messageData);
            
            const chatDoc = await getDoc(doc(this.db, "chats", this.currentChatId));
            const currentUnreadCount = chatDoc.data()?.unreadCount || 0;
            
            await updateDoc(doc(this.db, "chats", this.currentChatId), {
                lastMessage: messageText,
                lastUpdated: serverTimestamp(),
                unreadCount: currentUnreadCount + 1
            });
            
            chatInput.value = '';
            chatInput.focus();
            
        } catch (error) {
            alert("Lỗi gửi tin nhắn: " + error.message);
        }
    }
    
    // Mark messages as read
    async markMessagesAsRead(chatId) {
        try {
            const messagesRef = collection(this.db, "chats", chatId, "messages");
            const q = query(messagesRef, where("read", "==", false));
            
            const snapshot = await getDocs(q);
            
            const updatePromises = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.senderId === 'admin' || data.senderId === 'system') {
                    updatePromises.push(
                        updateDoc(doc(this.db, "chats", chatId, "messages", docSnap.id), {
                            read: true
                        })
                    );
                }
            });
            
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                
                const chatDoc = await getDoc(doc(this.db, "chats", chatId));
                if (chatDoc.exists()) {
                    const currentUnreadCount = chatDoc.data()?.unreadCount || 0;
                    const newUnreadCount = Math.max(0, currentUnreadCount - updatePromises.length);
                    
                    await updateDoc(doc(this.db, "chats", chatId), {
                        unreadCount: newUnreadCount
                    });
                }
            }
            
        } catch (error) {
            // Lỗi đánh dấu tin nhắn đã đọc
        }
    }
    
    // Update unread count
    updateUnreadCount(count) {
        const { chatBadge, chatContainer } = this.elements;
        if (!chatBadge || !chatContainer) return;
        
        this.unreadCount = count;
        
        if (this.unreadCount > 0 && !chatContainer.classList.contains('open')) {
            chatBadge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            chatBadge.style.display = 'flex';
        } else {
            chatBadge.style.display = 'none';
        }
    }
    
    // Update badge from chat data
    updateUnreadBadge(chat) {
        const { chatBadge, chatContainer } = this.elements;
        if (!chatBadge || !chatContainer) return;
        
        this.unreadCount = chat.unreadCount || 0;
        
        if (this.unreadCount > 0 && !chatContainer.classList.contains('open')) {
            chatBadge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            chatBadge.style.display = 'flex';
        } else {
            chatBadge.style.display = 'none';
        }
    }
    
    // Format time helper
    formatTime(date) {
        if (!date) return 'Vừa xong';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        
        return date.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // Display welcome message
    displayWelcomeMessage() {
        const { chatMessages } = this.elements;
        if (!chatMessages) return;
        
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <p>👋 Chào bạn! Tôi có thể giúp gì cho bạn? Hãy gửi tin nhắn và chúng tôi sẽ trả lời sớm nhất!</p>
            </div>
        `;
    }
    
    // Cleanup khi không còn cần thiết
    cleanup() {
        if (this.messageListener) {
            this.messageListener();
        }
    }
}

// Export hàm khởi tạo chat đơn giản
export function initChatSupport(auth, db) {
    const chat = new ChatSupport(auth, db);
    chat.init();
    return chat;
}