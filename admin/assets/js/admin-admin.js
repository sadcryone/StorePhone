let products = [];

async function loadProducts() {
  try {
    // Đường dẫn đúng từ folder admin
    const res = await fetch("../product.json");
    if (!res.ok) throw new Error("Không tìm thấy product.json");
    products = await res.json();
    console.log("Đã load", products.length, "sản phẩm");
    renderProductList();
  } catch (err) {
    console.error("Lỗi load sản phẩm:", err);
    document.getElementById('products-list').innerHTML = 
      `<tr><td colspan="7" style="text-align:center;color:red;padding:20px">
        Lỗi load dữ liệu: ${err.message}<br>
        Kiểm tra đường dẫn product.json có đúng không?
      </td></tr>`;
  }
}

function renderProductList() {
  const tbody = document.getElementById('products-list');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px">Chưa có sản phẩm nào</td></tr>';
    return;
  }

  products.forEach((p, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><img src="${p.gallery?.[0] || p.image || 'https://via.placeholder.com/60'}" 
               style="width:60px;height:60px;object-fit:cover;border-radius:8px;"></td>
      <td style="max-width:300px">${p.name || 'Chưa có tên'}</td>
      <td>${p.price?.toLocaleString() || 0}₫</td>
      <td>${p.colors?.length || 0}</td>
      <td>${p.storages?.length || 0}</td>
      <td>
        <button class="btn-edit" onclick="editProduct(${index})">Sửa</button>
        <button class="btn-delete" onclick="deleteProduct(${index})">Xóa</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function editProduct(index) {
  localStorage.setItem('editingProductIndex', index);
  window.location.href = 'product-form.html';
}

function deleteProduct(index) {
  if (confirm('Bạn chắc chắn muốn xóa sản phẩm này?')) {
    products.splice(index, 1);
    saveAndNotify();
    renderProductList();
  }
}

function saveAndNotify() {
  localStorage.setItem('adminProductsBackup', JSON.stringify(products, null, 2));
  console.clear();
  console.log('%c=== COPY JSON MỚI NÀY VÀ DÁN VÀO product.json ===', 'color: green; font-size: 16px; font-weight: bold');
  console.log(JSON.stringify(products, null, 2));
  alert('Đã xóa! Hãy mở Console (F12) → copy JSON mới → dán đè vào file product.json');
}

// Khởi động khi trang load
document.addEventListener('DOMContentLoaded', loadProducts);
// Thêm vào cuối admin-firebase.js hiện tại

// ========================
// BANNER FUNCTIONS
// ========================
async function loadBanners() {
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
    console.error("Lỗi load banners:", err);
    if (err.code === 'failed-precondition' || err.code === 'not-found') {
      return [];
    }
    throw err;
  }
}

async function saveBanner(bannerData) {
  try {
    const docRef = await addDoc(collection(db, "banners"), bannerData);
    console.log("Thêm banner thành công, ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("Lỗi lưu banner:", err);
    throw err;
  }
}

async function updateBanner(id, bannerData) {
  try {
    const docRef = doc(db, "banners", id);
    await updateDoc(docRef, bannerData);
    console.log("Cập nhật banner thành công");
  } catch (err) {
    console.error("Lỗi cập nhật banner:", err);
    throw err;
  }
}

async function deleteBanner(id) {
  try {
    await deleteDoc(doc(db, "banners", id));
    console.log("Xóa banner thành công");
  } catch (err) {
    console.error("Lỗi xóa banner:", err);
    throw err;
  }
}

async function reorderBanners(banners) {
  try {
    const promises = banners.map((banner, index) => {
      if (banner.id) {
        const docRef = doc(db, "banners", banner.id);
        return updateDoc(docRef, {
          order: index,
          url: banner.url,
          enabled: banner.enabled
        });
      } else {
        return addDoc(collection(db, "banners"), {
          ...banner,
          order: index
        });
      }
    });
    
    await Promise.all(promises);
    console.log("Sắp xếp banners thành công");
  } catch (err) {
    console.error("Lỗi sắp xếp banners:", err);
    throw err;
  }
}

// Export thêm banner functions
export { 
  loadProducts, 
  saveProduct, 
  deleteProduct, 
  products, 
  db, 
  auth,
  loadBanners,
  saveBanner,
  updateBanner,
  deleteBanner,
  reorderBanners
};