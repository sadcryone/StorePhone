let products = [];
let visibleCount = 20;
let currentBrand = null;
let currentSort = null;

// =======================
// HÀM TẠO SAO ĐÁNH GIÁ
// =======================
function formatRatingStars(rating) {
  const starCount = 5;
  let starsHTML = '';
  
  // Chuyển rating từ 0-5 thành số sao
  const numericRating = parseFloat(rating) || 0;
  const fullStars = Math.floor(numericRating);
  const hasHalfStar = numericRating % 1 >= 0.5;
  const emptyStars = starCount - fullStars - (hasHalfStar ? 1 : 0);
  
  // Tạo HTML cho sao đầy
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span class="material-symbols-outlined" style="color: #ffb800; font-size: 1.4rem;">star</span>';
  }
  
  // Tạo HTML cho sao nửa (nếu có)
  if (hasHalfStar) {
    starsHTML += '<span class="material-symbols-outlined" style="color: #ffb800; font-size: 1.4rem;">star_half</span>';
  }
  
  // Tạo HTML cho sao rỗng
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<span class="material-symbols-outlined" style="color: #d1d5db; font-size: 1.4rem;">star_border</span>';
  }
  
  return starsHTML;
}

// Hàm hiển thị đánh giá kết hợp sao và số
function formatRatingDisplay(rating) {
  const numericRating = parseFloat(rating) || 0;
  
  if (numericRating === 0) {
    return '<span style="color: #9ca3af; font-size: 1.2rem;">Chưa có đánh giá</span>';
  }
  
  return `
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="display: flex; gap: 1px;">
        ${formatRatingStars(rating)}
      </div>
      <span style="color: #6b7280; font-size: 1.2rem;">${numericRating.toFixed(1)}</span>
    </div>
  `;
}

// =======================
// LOAD BANNERS TỪ FIRESTORE
// =======================
async function loadBanners() {
  try {
    console.log("Bắt đầu load banners...");
    const { loadBannersFromFirebase } = await import("./firebase-config.js");
    
    const banners = await loadBannersFromFirebase();
    console.log("Đã load banners từ Firestore:", banners);

    const wrap = document.querySelector(".hero-banner-inner");
    if (!wrap) return;

    if (!banners || banners.length === 0) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:80px;background:#f8fafc;border-radius:12px;">
          <p style="color:#64748b;font-size:1.8rem;">Chưa có banner nào</p>
        </div>
      `;
      return;
    }

    // Chỉ lấy banner đang bật và sắp xếp theo order
    const activeBanners = banners
      .filter(b => b.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (activeBanners.length === 0) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:80px;background:#f8fafc;border-radius:12px;">
          <p style="color:#64748b;font-size:1.8rem;">Chưa có banner nào được bật</p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = activeBanners
      .map(b => `<img src="${b.url}" alt="Banner" style="width:600px;height:200px;">`)
      .join("");

    initCarousel(); // Khởi động carousel sau khi load xong

  } catch (error) {
    console.error("Lỗi load banners:", error);
    const wrap = document.querySelector(".hero-banner-inner");
    if (wrap) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:50px;color:red;">
          Lỗi load banner: ${error.message}
        </div>
      `;
    }
  }
}

// =======================
// LOAD SẢN PHẨM TỪ FIRESTORE
// =======================
async function loadProductsFromFirebase() {
  try {
    console.log("Bắt đầu load sản phẩm...");
    const { db, collection, getDocs, query, orderBy } = await import("./firebase-config.js");

    const q = query(collection(db, "products"), orderBy("name"));
    const querySnapshot = await getDocs(q);

    products = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({
        id: docSnap.id,
        firebaseId: docSnap.id,
        ...data,
        price: Number(data.price) || 0,
        sold: Number(data.sold) || 0,
        rating: Number(data.rating) || 0,
        ratingCount: Number(data.ratingCount) || 0 // Thêm ratingCount nếu có
      });
    });

    console.log(`Load thành công ${products.length} sản phẩm từ Firestore`);
    
    // Ẩn loading spinner
    const loadingElement = document.querySelector('.product-list-loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Cập nhật breadcrumb với số lượng sản phẩm
    updateBreadcrumb();
    
    // Render sản phẩm
    renderProducts();
  } catch (err) {
    console.error("Lỗi load sản phẩm:", err);
    const productList = document.querySelector(".product-list");
    if (productList) {
      productList.innerHTML = 
        `<p style="color:red;text-align:center;padding:50px;">Lỗi kết nối Firebase: ${err.message}</p>`;
    }
    
    // Ẩn loading spinner dù có lỗi
    const loadingElement = document.querySelector('.product-list-loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
}

// =======================
// CẬP NHẬT BREADCRUMB
// =======================
function updateBreadcrumb() {
  const productCountElement = document.getElementById('product-count');
  if (!productCountElement) return;
  
  // Tính số lượng sản phẩm theo brand nếu đang filter
  let productCount = products.length;
  
  if (currentBrand) {
    productCount = products.filter(p => p.brand === currentBrand).length;
  }
  
  productCountElement.textContent = `${productCount} Điện thoại`;
}

// =======================
// FILTER THEO HÃNG
// =======================
function setupBrandFilters() {
  const brandButtons = document.querySelectorAll(".quick-item");

  brandButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const brand = btn.dataset.brand;

      if (currentBrand === brand) {
        currentBrand = null;
        btn.classList.remove("active");
      } else {
        currentBrand = brand;
        brandButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }

      visibleCount = 20;
      // Cập nhật breadcrumb khi filter
      updateBreadcrumb();
      renderProducts();
    });
  });
}

// =======================
// RENDER SẢN PHẨM VỚI RATING BẰNG SAO
// =======================
function renderProducts() {
  const list = document.querySelector(".product-list");
  if (!list) return;

  list.innerHTML = "";

  let filtered = [...products];

  if (currentBrand) {
    filtered = filtered.filter(p => p.brand === currentBrand);
  }

  if (currentSort) {
    switch (currentSort) {
      case "price-asc":
        filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case "price-desc":
        filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case "bestseller":
        filtered.sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0));
        break;
      case "new":
        filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
        break;
      case "feature":
      default:
        // Mặc định sort theo name
        break;
    }
  }

  const slice = filtered.slice(0, visibleCount);

  if (slice.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:60px;grid-column:1/-1;">
        <p style="font-size:1.6rem;color:#6b7280;">Không tìm thấy sản phẩm nào</p>
        <p style="font-size:1.4rem;color:#9ca3af;margin-top:10px;">Hãy thử chọn hãng khác</p>
      </div>
    `;
  } else {
    slice.forEach(p => {
      const ratingDisplay = formatRatingDisplay(p.rating);
      const ratingCount = p.ratingCount || 0;
      
      list.innerHTML += `
        <div class="product-card">
          <a href="product.html?id=${p.firebaseId}" class="product-link">
            <div class="product-img">
              <img src="${p.image || p.gallery?.[0] || 'https://via.placeholder.com/300x300?text=No+Image'}" 
                   alt="${p.name || 'Sản phẩm'}"
                   onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">
            </div>
            <h3 class="product-name">${p.name || 'Chưa có tên'}</h3>
            <p class="product-screen">${p.screen || ''}</p>
            <div class="product-memory">
              ${Array.isArray(p.memory) ? p.memory.map(m => `<span>${m}</span>`).join("") : ""}
            </div>
            <div class="product-price">${formatPrice(p.price)}</div>
            ${p.oldPrice ? `<div class="product-old-price">${formatPrice(p.oldPrice)}</div>` : ""}
            <div class="product-rating">
              ${ratingDisplay}
              ${ratingCount > 0 ? `<span style="color: #9ca3af; font-size: 1.2rem; margin-left: 5px;">(${ratingCount})</span>` : ''}
              <span style="color: #6b7280; font-size: 1.2rem; margin-left: 8px;">•</span>
              <span style="color: #6b7280; font-size: 1.2rem; margin-left: 8px;">Đã bán ${p.sold || '0'}</span>
            </div>
          </a>
        </div>
      `;
    });
  }

  const loadMoreBtn = document.getElementById("load-more");
  if (loadMoreBtn) {
    loadMoreBtn.style.display = visibleCount >= filtered.length ? "none" : "block";
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price || 0);
}

// =======================
// SẮP XẾP
// =======================
function setupSorting() {
  const sortContainer = document.querySelector(".sort-options-container");
  const sortItems = document.querySelectorAll(".sort-options-container > li");
  const sortPriceItems = document.querySelectorAll(".sort-price .dropdown li");

  // Sắp xếp chính
  sortContainer?.addEventListener("click", (e) => {
    const target = e.target.closest("li");
    if (!target) return;

    if (target.closest(".sort-price")) {
      target.closest(".sort-price").classList.toggle("show");
      return;
    }

    const sortType = target.dataset.sort;
    if (!sortType) return;

    currentSort = sortType;
    sortItems.forEach(item => item.classList.remove("active"));
    target.classList.add("active");

    document.querySelector(".sort-price")?.classList.remove("show");
    renderProducts();
  });

  // Sắp xếp giá
  sortPriceItems.forEach(item => {
    item.addEventListener("click", (e) => {
      const sortType = e.target.dataset.sort;
      if (sortType) {
        currentSort = sortType;
        sortItems.forEach(item => item.classList.remove("active"));
        document.querySelector(".sort-price")?.classList.remove("show");
        renderProducts();
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".sort-price")) {
      document.querySelector(".sort-price")?.classList.remove("show");
    }
  });
}

// =======================
// LOAD MORE
// =======================
function setupLoadMore() {
  const loadMoreBtn = document.getElementById("load-more");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      visibleCount += 20;
      renderProducts();
    });
  }
}

// =======================
// CAROUSEL BANNER
// =======================
function initCarousel() {
  const bannerInner = document.querySelector('.hero-banner-inner');
  const bannerImages = bannerInner?.querySelectorAll('img');
  const prevBtn = document.querySelector('.owl-nav .left');
  const nextBtn = document.querySelector('.owl-nav .right');
  const dotsContainer = document.querySelector('.carousel-dots');

  if (!bannerImages || bannerImages.length === 0) return;

  let currentIndex = 0;
  let itemsPerView = window.innerWidth >= 768 ? 2 : 1;
  let slideWidth = window.innerWidth >= 768 ? 50 : 100;

  function createDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const totalDots = Math.ceil(bannerImages.length / itemsPerView);
    for (let i = 0; i < totalDots; i++) {
      const dot = document.createElement('button');
      dot.classList.add('carousel-dot');
      if (i === Math.floor(currentIndex / itemsPerView)) dot.classList.add('active');
      dot.addEventListener('click', () => goToSlide(i * itemsPerView));
      dotsContainer.appendChild(dot);
    }
  }

  function updateCarousel() {
    itemsPerView = window.innerWidth >= 768 ? 2 : 1;
    slideWidth = window.innerWidth >= 768 ? 50 : 100;
    bannerInner.style.transform = `translateX(-${currentIndex * slideWidth}%)`;
    bannerInner.style.transition = 'transform 0.3s ease';
    createDots();
    updateDots();
  }

  function updateDots() {
    const dots = document.querySelectorAll('.carousel-dot');
    const activeDotIndex = Math.floor(currentIndex / itemsPerView);
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeDotIndex);
    });
  }

  function goToSlide(index) {
    if (index < 0) index = bannerImages.length - itemsPerView;
    if (index >= bannerImages.length) index = 0;
    currentIndex = index;
    updateCarousel();
  }

  function nextSlide() {
    currentIndex += itemsPerView;
    if (currentIndex >= bannerImages.length) currentIndex = 0;
    updateCarousel();
  }

  function prevSlide() {
    currentIndex -= itemsPerView;
    if (currentIndex < 0) {
      currentIndex = Math.floor((bannerImages.length - 1) / itemsPerView) * itemsPerView;
      if (currentIndex < 0) currentIndex = 0;
    }
    updateCarousel();
  }

  let autoSlide = setInterval(nextSlide, 5000);

  prevBtn?.addEventListener('click', () => {
    clearInterval(autoSlide);
    prevSlide();
    autoSlide = setInterval(nextSlide, 5000);
  });

  nextBtn?.addEventListener('click', () => {
    clearInterval(autoSlide);
    nextSlide();
    autoSlide = setInterval(nextSlide, 5000);
  });

  bannerInner?.addEventListener('mouseenter', () => clearInterval(autoSlide));
  bannerInner?.addEventListener('mouseleave', () => autoSlide = setInterval(nextSlide, 5000));

  window.addEventListener('resize', updateCarousel);
  updateCarousel();

  // Ẩn/hiện nút prev/next trên mobile
  const owlNav = document.querySelector('.owl-nav');
  if (owlNav) {
    owlNav.style.display = window.innerWidth < 768 ? 'none' : 'flex';
  }
  window.addEventListener('resize', () => {
    if (owlNav) owlNav.style.display = window.innerWidth < 768 ? 'none' : 'flex';
  });
}

// =======================
// KHỞI ĐỘNG KHI LOAD TRANG
// =======================
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM đã load, bắt đầu khởi tạo...");
  
  // Setup các event listeners trước
  setupBrandFilters();
  setupSorting();
  setupLoadMore();
  
  // Load banner và sản phẩm
  loadBanners();
  loadProductsFromFirebase();
});