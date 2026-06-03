document.addEventListener('DOMContentLoaded', () => {
    // Lógica del menú de hamburguesas
    const burgerMenu = document.getElementById('burger-menu');
    const navLinks = document.querySelector('.nav-links');

    if (burgerMenu) {
        burgerMenu.addEventListener('click', () => {
            navLinks.classList.toggle('active');
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
});
