// admin/assets/js/firestore-images-helper.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0ua4VVMCYnJa2ndQ2MMgDYPNdCEfoxwY",
  authDomain: "products-a39df.firebaseapp.com",
  projectId: "products-a39df",
  storageBucket: "products-a39df.firebasestorage.app",
  messagingSenderId: "708345988066",
  appId: "1:708345988066:web:b8011a4859285450162fbb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function migrateLocalImagesToFirestore() {
  try {
    const localImages = JSON.parse(localStorage.getItem('store_images') || '[]');
    console.log(`Đang migrate ${localImages.length} ảnh từ localStorage lên Firestore...`);
    
    let migrated = 0;
    for (const img of localImages) {
      try {
        // Kiểm tra xem đã tồn tại chưa
        const existing = await checkIfImageExists(img.url);
        if (!existing) {
          await addDoc(collection(db, "images"), {
            ...img,
            migratedAt: new Date().toISOString()
          });
          migrated++;
        }
      } catch (error) {
        console.error("Lỗi migrate ảnh:", error);
      }
    }
    
    console.log(`Đã migrate ${migrated} ảnh lên Firestore`);
    return migrated;
  } catch (error) {
    console.error("Lỗi migrate:", error);
    return 0;
  }
}

async function checkIfImageExists(url) {
  try {
    const querySnapshot = await getDocs(collection(db, "images"));
    const exists = querySnapshot.docs.some(doc => doc.data().url === url);
    return exists;
  } catch (error) {
    return false;
  }
}

// Tạo nút migrate trong UI
export function createMigrateButton() {
  const btn = document.createElement('button');
  btn.textContent = 'Migrate ảnh từ Local lên Cloud';
  btn.style.cssText = `
    background: #8b5cf6;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 6px;
    cursor: pointer;
    margin: 10px 0;
    font-size: 1.3rem;
  `;
  
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Đang migrate...';
    
    const migrated = await migrateLocalImagesToFirestore();
    
    alert(`Đã migrate ${migrated} ảnh từ localStorage lên Firestore!`);
    btn.disabled = false;
    btn.textContent = 'Migrate ảnh từ Local lên Cloud';
    
    // Reload trang
    window.location.reload();
  };
  
  return btn;
}