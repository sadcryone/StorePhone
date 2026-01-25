// assets/js/cart.js - GIỎ HÀNG TỐI ƯU (KHÔNG THÔNG BÁO)

class ShoppingCart {
  constructor() {
    this.cart = [];
    this.user = null;
    this.isSyncing = false;
    this.app = null;
    this.auth = null;
    this.db = null;
    this.loading = true;
    this.onCartLoadedCallbacks = [];
    
    this.init();
  }

  async init() {
    try {
      // Khởi tạo không cần log
    } catch (err) {
      this.cart = [];
      this.loading = false;
      this.triggerOnCartLoaded();
    }
  }

  setFirebase(app, auth, db) {
    this.app = app;
    this.auth = auth;
    this.db = db;
    
    if (this.auth) {
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js")
        .then(({ onAuthStateChanged }) => {
          onAuthStateChanged(this.auth, async (user) => {
            this.user = user;
            
            if (user) {
              await this.loadFromFirestore();
            } else {
              this.cart = [];
              this.loading = false;
              this.triggerOnCartLoaded();
            }
          });
        });
    }
  }

  async loadFromFirestore() {
    if (!this.user || !this.db) {
      this.cart = [];
      this.loading = false;
      this.triggerOnCartLoaded();
      return;
    }
    
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
      const cartRef = doc(this.db, "carts", this.user.uid);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const snap = await getDoc(cartRef);

      if (snap.exists() && snap.data().items) {
        this.cart = snap.data().items;
      } else {
        this.cart = [];
      }
      
      this.loading = false;
      
      setTimeout(() => {
        this.triggerOnCartLoaded();
      }, 100);
      
    } catch (err) {
      this.cart = [];
      this.loading = false;
      this.triggerOnCartLoaded();
    }
  }

  onCartLoaded(callback) {
    if (!this.loading) {
      setTimeout(callback, 100);
    } else {
      this.onCartLoadedCallbacks.push(callback);
    }
  }

  triggerOnCartLoaded() {
    this.onCartLoadedCallbacks.forEach(callback => {
      try {
        setTimeout(callback, 100);
      } catch (err) {
        // Lỗi callback sẽ được bỏ qua
      }
    });
    this.onCartLoadedCallbacks = [];
  }

  async saveCart() {
    if (!this.user || !this.db) {
      return;
    }

    if (this.isSyncing) {
      return;
    }
    
    this.isSyncing = true;

    try {
      const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
      const cartRef = doc(this.db, "carts", this.user.uid);
      await setDoc(cartRef, { 
        items: this.cart, 
        updatedAt: serverTimestamp(),
        userId: this.user.uid,
        userEmail: this.user.email
      }, { merge: true });
    } catch (err) {
      // Lỗi lưu sẽ được bỏ qua
    } finally {
      this.isSyncing = false;
    }
  }

  addItem(product, color = null, storage = null, quantity = 1) {
    if (!this.auth || !this.db) {
      return false;
    }

    if (!this.user) {
      return false;
    }

    if (!product?.firebaseId) {
      return false;
    }

    const itemId = `${product.firebaseId}_${color || 'none'}_${storage || 'none'}`;
    const index = this.cart.findIndex(item => item.itemId === itemId);

    if (index > -1) {
      const newQty = this.cart[index].quantity + quantity;
      this.cart[index].quantity = Math.min(newQty, this.cart[index].maxQuantity || 10);
    } else {
      this.cart.push({
        itemId,
        productId: product.firebaseId,
        name: product.name,
        price: Number(product.price) || 0,
        oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
        image: product.gallery?.[0] || product.image || 'https://via.placeholder.com/100x100?text=Ảnh',
        color,
        storage,
        quantity: Math.min(quantity, 10),
        maxQuantity: 10,
        addedAt: new Date().toISOString()
      });
    }

    this.saveCart();
    this.updateBadge();
    return true;
  }

  removeItem(index) {
    if (index >= 0 && index < this.cart.length) {
      this.cart.splice(index, 1);
      this.saveCart();
      this.updateBadge();
      return true;
    }
    return false;
  }

  updateQuantity(index, qty) {
    if (index >= 0 && index < this.cart.length) {
      qty = parseInt(qty);
      if (qty > 0 && qty <= this.cart[index].maxQuantity) {
        this.cart[index].quantity = qty;
        this.saveCart();
        this.updateBadge();
        return true;
      }
    }
    return false;
  }

  calculateTotal() {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  calculateTotalItems() {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  getItems() {
    return [...this.cart];
  }

  clearCart() {
    this.cart = [];
    this.saveCart();
    this.updateBadge();
  }

  updateBadge() {
    const count = this.calculateTotalItems();
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count > 99 ? '99+' : count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }
}

// Tạo instance duy nhất
const cart = new ShoppingCart();

export default cart;