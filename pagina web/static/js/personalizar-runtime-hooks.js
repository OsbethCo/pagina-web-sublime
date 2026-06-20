/* Hooks para integrar el editor con personalizar.html existente */

(function () {
  // Se asume que personalizar-editor.js se cargó antes.

  // Remplazar el render anterior por render WYSIWYG
  // Mantenemos la función existente updateCanvasTexture() pero en la app actual
  // está definida inline; por ahora, hacemos override parcial desde window.

  function ensureEditor() {
    if (window.PersonalizarEditor?.init) {
      window.PersonalizarEditor.init();
    }
  }

  // Crear un global para que los hooks llamen (opcional)
  window.renderCanvasTexture = function () {};

    // Señal para que personalizar.html espere a que el editor esté listo
    window.__THREE_PREVIEW_READY = true;

    // Hook: handleImages esperado desde personalizar.html (múltiples)
  window.handleImages = function (input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const tasks = files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          window.PersonalizarEditor?.addImage(img, file.name);
          resolve();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }));

    Promise.all(tasks).then(() => {
      // resumen/precio depende de app; llamamos updatePreview si existe
      if (typeof window.updatePreview === 'function') window.updatePreview();
    });
  };

  // Hook: addClipart debe crear múltiples instancias
  const originalAddClipart = window.addClipart;
  window.addClipart = function (btnEl) {
    // mantener UI existente si existe
    try {
      // original addClipart usa selectedClipart global y updateCanvasTexture()
      // pero queremos instancia por click; llamamos original para la UI
      if (typeof originalAddClipart === 'function') originalAddClipart(btnEl);
    } catch (e) {}

    const emoji = btnEl?.dataset?.emoji;
    if (emoji) window.PersonalizarEditor?.addClipart(emoji);
  };

  // Texto arrastrable: se inicializa dentro del editor y escucha el input custom_text.

  // init al cargar
  window.addEventListener('DOMContentLoaded', () => {
    // Forzar init + render con varios delays (el layout y el stage pueden cambiar cuando carga Three.js/GLB).
    const tryInitRender = (n = 0) => {
      try {
        window.PersonalizarEditor?.init?.();
        window.PersonalizarEditor?.renderNow?.();
        if (typeof window.updateCanvasTexture === 'function') window.updateCanvasTexture();
      } catch (e) {}

      if (n < 8) setTimeout(() => tryInitRender(n + 1), 140);
    };

    tryInitRender(0);
  });


})();

