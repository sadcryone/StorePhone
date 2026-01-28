
import { firebaseConfig } from '../../../assets/js/API.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { 
  getAuth 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let products = [];

async function loadProducts() {
  try {
    const q = query(collection(db, "products"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    
    products = [];
    querySnapshot.forEach((docSnap) => {
      products.push({
        firebaseId: docSnap.id,
        ...docSnap.data()
      });
    });

    console.log(`Load thành công ${products.length} sản phẩm từ Firestore`);
    return true;
  } catch (err) {
    console.error("Lỗi load sản phẩm từ Firestore:", err);
    alert("Lỗi kết nối Firebase: " + err.message);
    return false;
  }
}

async function saveProduct(productData, firebaseId = null) {
  console.log("Đang lưu sản phẩm:", productData, "ID:", firebaseId);
  
  try {
    // Kiểm tra đăng nhập
    const user = auth.currentUser;
    
    if (user) {
      console.log("User đã đăng nhập:", user.email);
      
      // Nếu bạn muốn kiểm tra email admin, bỏ comment dòng dưới
      /*
      if (user.email !== "your-admin-email@gmail.com") {
        alert("Bạn không có quyền admin!");
        return;
      }
      */
      
      if (firebaseId) {
        const docRef = doc(db, "products", firebaseId);
        await updateDoc(docRef, productData);
        console.log("Cập nhật thành công!");
      } else {
        const docRef = await addDoc(collection(db, "products"), productData);
        console.log("Thêm thành công! ID:", docRef.id);
      }
      
      return true;
    } else {
      console.log("Chưa đăng nhập, nhưng vẫn thử lưu...");
      // Vẫn tiếp tục lưu mà không cần đăng nhập (nếu Rules cho phép)
      
      if (firebaseId) {
        const docRef = doc(db, "products", firebaseId);
        await updateDoc(docRef, productData);
        console.log("Cập nhật thành công!");
      } else {
        const docRef = await addDoc(collection(db, "products"), productData);
        console.log("Thêm thành công! ID:", docRef.id);
      }
      
      return true;
    }
  } catch (err) {
    console.error("Lỗi chi tiết:", err);
    alert("Lỗi lưu sản phẩm: " + err.message);
    return false;
  }
}

async function deleteProduct(firebaseId) {
  if (!confirm("Bạn chắc chắn muốn xóa sản phẩm này?")) return;

  try {
    await deleteDoc(doc(db, "products", firebaseId));
    alert("Xóa sản phẩm thành công!");
    return true;
  } catch (err) {
    console.error("Lỗi xóa sản phẩm:", err);
    alert("Lỗi xóa: " + err.message);
    return false;
  }
}

export { loadProducts, saveProduct, deleteProduct, products, db, auth };