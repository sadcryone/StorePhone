// admin/assets/js/image-manager.js
import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

class ImageManager {
  constructor() {
    this.apiKey = localStorage.getItem('imgbb_api_key') || '';
    
    // Khởi tạo Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyC0ua4VVMCYnJa2ndQ2MMgDYPNdCEfoxwY",
      authDomain: "products-a39df.firebaseapp.com",
      projectId: "products-a39df",
      storageBucket: "products-a39df.firebasestorage.app",
      messagingSenderId: "708345988066",
      appId: "1:708345988066:web:b8011a4859285450162fbb"
    };
    
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
    this.images = [];
    this.loading = false;
  }
  
  setApiKey(key) {
    this.apiKey = key;
    // Lưu vào cả localStorage và sessionStorage
    localStorage.setItem('imgbb_api_key', key);
    sessionStorage.setItem('imgbb_api_key', key);
  }
  
  // Load ảnh từ Firestore
  async loadImagesFromFirebase() {
    if (this.loading) return this.images;
    
    this.loading = true;
    try {
      console.log("Đang load ảnh từ Firestore...");
      const q = query(collection(this.db, "images"), orderBy("uploadedAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      this.images = [];
      querySnapshot.forEach((docSnap) => {
        this.images.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      
      console.log(`Đã load ${this.images.length} ảnh từ Firestore`);
      return this.images;
    } catch (error) {
      console.error("Lỗi load ảnh từ Firestore:", error);
      
      // Fallback: thử load từ localStorage (cho local development)
      const localImages = JSON.parse(localStorage.getItem('store_images') || '[]');
      this.images = localImages;
      return this.images;
    } finally {
      this.loading = false;
    }
  }
  
  // Lưu ảnh vào Firestore
  async saveImageToFirebase(imageData) {
    try {
      const docRef = await addDoc(collection(this.db, "images"), imageData);
      console.log("Đã lưu ảnh vào Firestore, ID:", docRef.id);
      
      // Thêm id vào imageData
      imageData.id = docRef.id;
      
      // Cập nhật cache local
      this.images.unshift(imageData);
      this.syncToLocalStorage();
      
      return imageData;
    } catch (error) {
      console.error("Lỗi lưu ảnh vào Firestore:", error);
      throw error;
    }
  }
  
  // Xóa ảnh từ Firestore
  async deleteImageFromFirebase(imageId) {
    try {
      await deleteDoc(doc(this.db, "images", imageId));
      console.log("Đã xóa ảnh khỏi Firestore:", imageId);
      
      // Cập nhật cache local
      const index = this.images.findIndex(img => img.id === imageId);
      if (index > -1) {
        this.images.splice(index, 1);
        this.syncToLocalStorage();
      }
      
      return true;
    } catch (error) {
      console.error("Lỗi xóa ảnh:", error);
      throw error;
    }
  }
  
  // Sync từ Firestore xuống localStorage (backup)
  syncToLocalStorage() {
    try {
      localStorage.setItem('store_images', JSON.stringify(this.images));
    } catch (error) {
      console.error("Lỗi sync localStorage:", error);
    }
  }
  
  // Upload ảnh lên ImgBB
  async uploadImage(file) {
    return new Promise((resolve, reject) => {
      if (!this.apiKey) {
        // Kiểm tra cả sessionStorage
        const sessionKey = sessionStorage.getItem('imgbb_api_key');
        if (sessionKey) {
          this.apiKey = sessionKey;
        } else {
          reject('Vui lòng cài đặt API key ImgBB trong phần cài đặt ảnh');
          return;
        }
      }
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('key', this.apiKey);
      
      // Thêm timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(async data => {
        if (data.success) {
          const imageData = {
            url: data.data.url,
            thumb: data.data.thumb?.url || data.data.url,
            medium: data.data.medium?.url || data.data.url,
            deleteUrl: data.data.delete_url,
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            source: 'imgbb'
          };
          
          // Lưu vào Firestore
          const savedImage = await this.saveImageToFirebase(imageData);
          resolve(savedImage);
        } else {
          reject(data.error?.message || 'Upload thất bại');
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error("Lỗi upload:", error);
        
        if (error.name === 'AbortError') {
          reject('Upload timeout (30 giây)');
        } else if (error.message.includes('Failed to fetch')) {
          reject('Lỗi kết nối đến ImgBB. Kiểm tra internet hoặc CORS.');
        } else {
          reject(error.message || 'Lỗi upload ảnh');
        }
      });
    });
  }
  
  // Import từ URL
  async importFromUrl(url, name = '') {
    const imageData = {
      url: url,
      thumb: url,
      medium: url,
      name: name || 'Imported Image',
      size: 0,
      uploadedAt: new Date().toISOString(),
      source: 'url'
    };
    
    // Lưu vào Firestore
    const savedImage = await this.saveImageToFirebase(imageData);
    return savedImage;
  }
  
  // Get all images (từ cache)
  getAllImages() {
    return this.images;
  }
  
  // Delete image
  async deleteImage(index) {
    if (index >= 0 && index < this.images.length) {
      const image = this.images[index];
      
      if (image.id) {
        // Xóa từ Firestore
        await this.deleteImageFromFirebase(image.id);
      } else {
        // Xóa từ localStorage (fallback)
        this.images.splice(index, 1);
        this.syncToLocalStorage();
      }
      
      return true;
    }
    return false;
  }
  
  // Refresh images từ Firestore
  async refresh() {
    return await this.loadImagesFromFirebase();
  }
}

export { ImageManager };