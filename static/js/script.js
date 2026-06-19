document.addEventListener('DOMContentLoaded', () => {
    // Lógica del menú de hamburguesas
    const burgerMenu = document.getElementById('burger-menu');
    const navLinks = document.querySelector('.nav-links');

    if (burgerMenu) {
        burgerMenu.addEventListener('click', () => {
            if (navLinks) navLinks.classList.toggle('active');
        });
    }

    // Lógica de alternancia de temas
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Comprueba el almacenamiento local para el tema
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'light') {
        body.classList.add('light-mode');
        if (themeToggle) themeToggle.innerHTML = '<i class="fa-solid fa-sun fa-lg"></i>';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            
            let theme = 'dark';
            if (body.classList.contains('light-mode')) {
                theme = 'light';
                themeToggle.innerHTML = '<i class="fa-solid fa-sun fa-lg"></i>';
            } else {
                themeToggle.innerHTML = '<i class="fa-solid fa-moon fa-lg"></i>';
            }
            
            localStorage.setItem('theme', theme);
        });
    }

    function initHeroCarousel() {
        const slides = document.querySelectorAll('.hero-slide');
        if (!slides.length) return;

        let currentIndex = 0;
        setInterval(() => {
            slides[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % slides.length;
            slides[currentIndex].classList.add('active');
        }, 6000);
    }

    initHeroCarousel();

    // Image preview overlay for product images (touch/click to open)
    (function initImagePreview() {
        const productImages = document.querySelectorAll('.product-image img, .product-card img');
        if (!productImages.length) return;

        function getImageSrcFromElement(el) {
            if (!el) return null;
            if (el.tagName && el.tagName.toLowerCase() === 'img') {
                return el.currentSrc || el.src || null;
            }
            const candidates = [el, el.parentElement, el.closest('.product-image')];
            for (const c of candidates) {
                if (!c) continue;
                const bg = window.getComputedStyle(c).backgroundImage;
                if (bg && bg !== 'none') {
                    const m = bg.match(/url\(["']?(.*?)["']?\)/);
                    if (m && m[1]) return m[1];
                }
            }
            return null;
        }

        function closePreview(overlay) {
            if (!overlay) return;
            overlay.classList.remove('open');
            setTimeout(() => {
                overlay.remove();
            }, 250); // Matches CSS transition duration
            document.body.style.overflow = '';
        }

        function openPreviewInContainer(img) {
            if (!img) return;
            const src = getImageSrcFromElement(img);
            const alt = img.alt || img.getAttribute('data-caption') || 'Imagen de producto';
            if (!src) return;

            const existing = document.querySelector('.img-preview-modal');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.className = 'img-preview-modal';
            overlay.innerHTML = `
                <div class="img-preview-content" role="dialog" aria-modal="true" aria-label="Vista previa de imagen">
                    <button type="button" class="img-preview-close" aria-label="Cerrar vista previa">&times;</button>
                    <img src="${src}" alt="${alt}">
                    <div class="img-preview-caption">${alt}</div>
                </div>
            `;

            const closeBtn = overlay.querySelector('.img-preview-close');

            closeBtn.addEventListener('click', () => closePreview(overlay));
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    closePreview(overlay);
                }
            });
            
            const escHandler = function(e) {
                if (e.key === 'Escape') {
                    closePreview(overlay);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            document.body.appendChild(overlay);
            
            // Trigger transition animation
            requestAnimationFrame(() => {
                overlay.classList.add('open');
            });
            
            document.body.style.overflow = 'hidden';
        }

        productImages.forEach(img => {
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                openPreviewInContainer(img);
            });

            const container = img.closest('.product-image') || img.parentElement;
            if (container && !container.querySelector('.preview-btn')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'preview-btn';
                btn.setAttribute('aria-label', 'Ver imagen');
                btn.innerHTML = '<i class="fa-solid fa-eye"></i> Ver';
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    openPreviewInContainer(img);
                });
                container.appendChild(btn);
            }
        });
    })();

    // Helper: position the added-to-cart toast/modal under the cart icon
    function placeAddedModal(modal) {
        if (!modal) return;
        const cartAnchor = document.querySelector('.nav-links a[title="Carrito de Compras"]');
        // Ensure fixed positioning so coordinates are viewport-based
        modal.style.position = 'fixed';
        // Default placement: center top of viewport
        let left = Math.max(8, window.innerWidth / 2 - modal.offsetWidth / 2);
        let top = 80; // fallback
        if (cartAnchor) {
            const rect = cartAnchor.getBoundingClientRect();
            top = rect.bottom + 8;
            left = rect.left + (rect.width / 2) - (modal.offsetWidth / 2);
            // clamp within viewport
            left = Math.max(8, Math.min(left, window.innerWidth - modal.offsetWidth - 8));
        }
        // Mobile narrow screens: center above bottom
        if (window.innerWidth < 480) {
            left = Math.max(8, window.innerWidth / 2 - modal.offsetWidth / 2);
            top = Math.max(12, (window.innerHeight - modal.offsetHeight) * 0.6);
        }
        modal.style.left = `${left}px`;
        modal.style.top = `${top + window.scrollY}px`;
    }

    // Show the added modal/toast with image and automatic positioning
    window.showAddedModal = function({ title = '', text = '', image = '' } = {}) {
        const modal = document.getElementById('globalAddedModal');
        if (!modal) return;
        const modalTitle = document.getElementById('globalAddedModalTitle');
        const modalText = document.getElementById('globalAddedModalText');
        const modalImage = document.getElementById('globalAddedModalImage');
        const closeBtn = document.getElementById('globalAddedModalClose');

        if (modalTitle) modalTitle.textContent = title || modalTitle.textContent;
        if (modalText) modalText.textContent = text || modalText.textContent;

        if (modalImage) {
            if (image) {
                modalImage.src = image;
                modalImage.style.display = '';
            } else {
                modalImage.src = '';
                modalImage.style.display = 'none';
            }
        }

        modal.style.display = 'flex';
        // allow content sizing
        requestAnimationFrame(() => {
            modal.classList.add('open');
            // compute placement after open so size is known
            requestAnimationFrame(() => placeAddedModal(modal));
        });
        modal.setAttribute('aria-hidden', 'false');

        // close handlers
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('open');
                modal.setAttribute('aria-hidden', 'true');
                setTimeout(() => modal.style.display = 'none', 220);
            }, { once: true });
        }
        modal.addEventListener('click', (ev) => { if (ev.target === modal) { closeBtn && closeBtn.click(); } }, { once: true });
        // auto close
        setTimeout(() => { closeBtn && closeBtn.click(); }, 4200);
    };

    // AJAX add-to-cart handler: intercept links/buttons with .ajax-add
    (function initAjaxAddToCart(){
        document.body.addEventListener('click', async (e) => {
            const el = e.target.closest('.ajax-add');
            if (!el) return;
            e.preventDefault();
            const productId = el.getAttribute('data-product-id') || el.dataset.productId;
            if (!productId) return;

            try {
                const resp = await fetch('/api/cart/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: parseInt(productId, 10), quantity: 1 })
                });
                const data = await resp.json();
                // update cart counter in nav (first matching span)
                const cartSpan = document.querySelector('.nav-links a[title="Carrito de Compras"] span') || document.querySelector('.nav-links span');
                if (cartSpan && data.cart_count !== undefined) cartSpan.textContent = data.cart_count;

                // show global toast/modal under cart icon with image
                if (window.showAddedModal) {
                    window.showAddedModal({
                        title: data.product_name || 'Producto añadido',
                        text: data.mensaje || 'El producto se añadió correctamente a tu carrito.',
                        image: data.product_image || ''
                    });
                }

            } catch (err) {
                console.error('Error añadiendo al carrito', err);
                window.location.href = el.getAttribute('href') || '/carrito';
            }
        });
    })();
});
