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
});
