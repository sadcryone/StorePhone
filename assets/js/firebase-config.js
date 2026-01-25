// assets/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  onSnapshot,
  setDoc,
  arrayUnion,
  arrayRemove,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0ua4VVMCYnJa2ndQ2MMgDYPNdCEfoxwY",
  authDomain: "products-a39df.firebaseapp.com",
  projectId: "products-a39df",
  storageBucket: "products-a39df.firebasestorage.app",
  messagingSenderId: "708345988066",
  appId: "1:708345988066:web:b8011a4859285450162fbb",
  measurementId: "G-ZSXZG2HPRZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Banner functions
async function loadBannersFromFirebase() {
  try {
    const q = query(collection(db, "banners"), orderBy("order"));
    const querySnapshot = await getDocs(q);
    
    const banners = [];
    querySnapshot.forEach((docSnap) => {
      banners.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    
    console.log(`Load thành công ${banners.length} banners từ Firestore`);
    return banners;
  } catch (err) {
    console.error("Lỗi load banners từ Firestore:", err);
    // Nếu collection chưa tồn tại, trả về mảng rỗng
    if (err.code === 'failed-precondition' || err.code === 'not-found') {
      console.log('Collection banners chưa tồn tại, sẽ tạo mới');
      return [];
    }
    throw err;
  }
}

async function saveBannerToFirebase(bannerData) {
  try {
    // Tự động thêm order nếu chưa có
    if (bannerData.order === undefined) {
      const snapshot = await getDocs(collection(db, "banners"));
      bannerData.order = snapshot.size; // Đặt order = số lượng hiện tại
    }

    const docRef = await addDoc(collection(db, "banners"), bannerData);
    console.log("Thêm banner thành công, ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("Lỗi lưu banner:", err);
    throw err;
  }
}

async function updateBannerInFirebase(id, bannerData) {
  try {
    const docRef = doc(db, "banners", id);
    await updateDoc(docRef, bannerData);
    console.log("Cập nhật banner thành công");
  } catch (err) {
    console.error("Lỗi cập nhật banner:", err);
    throw err;
  }
}

async function deleteBannerFromFirebase(id) {
  try {
    await deleteDoc(doc(db, "banners", id));
    console.log("Xóa banner thành công");
  } catch (err) {
    console.error("Lỗi xóa banner:", err);
    throw err;
  }
}

async function reorderBannersInFirebase(banners) {
  try {
    // Lấy tất cả banners hiện có
    const oldBanners = await getDocs(collection(db, "banners"));
    
    // Xóa từng banner cũ
    const deletePromises = [];
    oldBanners.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, "banners", docSnap.id)));
    });
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    
    // Thêm banners mới với order
    const addPromises = banners.map((banner, index) => {
      return addDoc(collection(db, "banners"), {
        url: banner.url,
        enabled: banner.enabled !== false,
        order: index
      });
    });
    
    if (addPromises.length > 0) {
      await Promise.all(addPromises);
    }
    
    console.log("Sắp xếp banners thành công");
  } catch (err) {
    console.error("Lỗi sắp xếp banners:", err);
    throw err;
  }
}

// Chat functions
async function createNewChat(userId, userEmail) {
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
    
    const chatRef = await addDoc(collection(db, "chats"), chatData);
    console.log("✅ Tạo chat mới thành công:", chatRef.id);
    
    // Add welcome message
    await addDoc(collection(db, "chats", chatRef.id, "messages"), {
      senderId: "system",
      text: "👋 Chào bạn! Tôi có thể giúp gì cho bạn? Hãy gửi tin nhắn và chúng tôi sẽ trả lời sớm nhất!",
      timestamp: serverTimestamp(),
      read: false
    });
    
    return chatRef.id;
  } catch (error) {
    console.error("❌ Lỗi tạo chat mới:", error);
    throw error;
  }
}

async function getUserChats(userId) {
  try {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
      orderBy("lastUpdated", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const chats = [];
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      chats.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        lastUpdated: data.lastUpdated?.toDate?.() || new Date()
      });
    });
    
    console.log(`✅ Load ${chats.length} chats cho user ${userId}`);
    return chats;
  } catch (error) {
    console.error("❌ Lỗi load user chats:", error);
    throw error;
  }
}

async function getOpenUserChat(userId) {
  try {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
      where("status", "==", "open"),
      orderBy("lastUpdated", "desc"),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const chatDoc = querySnapshot.docs[0];
    const data = chatDoc.data();
    
    return {
      id: chatDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      lastUpdated: data.lastUpdated?.toDate?.() || new Date()
    };
  } catch (error) {
    console.error("❌ Lỗi load open chat:", error);
    throw error;
  }
}

async function getChatMessages(chatId) {
  try {
    const q = query(
      collection(db, "chats", chatId, "messages"),
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
    
    console.log(`✅ Load ${messages.length} messages cho chat ${chatId}`);
    return messages;
  } catch (error) {
    console.error("❌ Lỗi load chat messages:", error);
    throw error;
  }
}

async function sendMessage(chatId, senderId, text) {
  try {
    const messageData = {
      senderId: senderId,
      text: text,
      timestamp: serverTimestamp(),
      read: false
    };
    
    const messageRef = await addDoc(collection(db, "chats", chatId, "messages"), messageData);
    
    // Update chat last message
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: text,
      lastUpdated: serverTimestamp(),
      unreadCount: senderId === 'admin' ? 0 : 1  // If user sends, admin has unread
    });
    
    console.log("✅ Tin nhắn đã gửi:", messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error("❌ Lỗi gửi tin nhắn:", error);
    throw error;
  }
}

async function markMessagesAsRead(chatId, userId) {
  try {
    // Get all unread messages from admin/system
    const q = query(
      collection(db, "chats", chatId, "messages"),
      where("read", "==", false)
    );
    
    const snapshot = await getDocs(q);
    const updatePromises = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Only mark messages from admin/system as read
      if (data.senderId === 'admin' || data.senderId === 'system') {
        updatePromises.push(
          updateDoc(doc(db, "chats", chatId, "messages", docSnap.id), {
            read: true
          })
        );
      }
    });
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      
      // Update unread count in chat
      await updateDoc(doc(db, "chats", chatId), {
        unreadCount: 0
      });
      
      console.log(`✅ Đã đánh dấu ${updatePromises.length} tin nhắn là đã đọc`);
    }
  } catch (error) {
    console.error("❌ Lỗi đánh dấu tin nhắn đã đọc:", error);
    throw error;
  }
}

// Admin chat functions
async function getAllChats() {
  try {
    const q = query(collection(db, "chats"), orderBy("lastUpdated", "desc"));
    const snapshot = await getDocs(q);
    
    const chats = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      chats.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        lastUpdated: data.lastUpdated?.toDate?.() || new Date()
      });
    });
    
    console.log(`✅ Admin: Load ${chats.length} chats`);
    return chats;
  } catch (error) {
    console.error("❌ Lỗi load all chats:", error);
    throw error;
  }
}

async function updateChatStatus(chatId, status) {
  try {
    await updateDoc(doc(db, "chats", chatId), {
      status: status,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`✅ Chat ${chatId} đã cập nhật status: ${status}`);
  } catch (error) {
    console.error("❌ Lỗi cập nhật chat status:", error);
    throw error;
  }
}

async function deleteChat(chatId) {
  try {
    // First delete all messages
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesRef);
    
    const deletePromises = [];
    messagesSnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, "chats", chatId, "messages", docSnap.id)));
    });
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    
    // Then delete the chat
    await deleteDoc(doc(db, "chats", chatId));
    
    console.log(`✅ Chat ${chatId} đã bị xóa`);
  } catch (error) {
    console.error("❌ Lỗi xóa chat:", error);
    throw error;
  }
}

// Export các hàm cần thiết
export {
  db,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  onSnapshot,
  setDoc,
  arrayUnion,
  arrayRemove,
  limit,
  
  // Banner functions
  loadBannersFromFirebase,
  saveBannerToFirebase,
  updateBannerInFirebase,
  deleteBannerFromFirebase,
  reorderBannersInFirebase,
  
  // Chat functions
  createNewChat,
  getUserChats,
  getOpenUserChat,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  
  // Admin chat functions
  getAllChats,
  updateChatStatus,
  deleteChat
};