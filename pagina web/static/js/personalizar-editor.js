/* personalizar-editor.js
   Editor WYSIWYG (arrastre) para personalizar.html
   - Drag & drop (mouse/touch) para: imágenes, texto, cliparts
   - Actualiza posiciones en tiempo real sobre #editorStage
   - Renderiza todo al canvas #textureCanvas para que Three.js lo vea
   - JavaScript nativo (Pointer Events)
*/

(() => {
  const stage = () => document.getElementById('editorStage');
  const layer = () => document.getElementById('editorLayer');
  const texCanvas = () => document.getElementById('textureCanvas');
  const texCtx = () => document.getElementById('textureCanvas')?.getContext('2d');

  const state = {
    ready: false,
    rafPending: false,
    dragging: null, // { id, startX, startY, originLeft, originTop }
    elements: new Map(), // id -> { id, type, payload }
    zIndex: 10,
    // Referencias a canvas/texture (se usan en window.updateCanvasTexture si existe)
    onRenderRequested: null
  };

  function uid() {
    return 'el_' + Math.random().toString(16).slice(2) + '_' + Date.now();
  }

  function stageRect() {
    const s = stage();
    if (!s) return null;
    return s.getBoundingClientRect();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function pxToCanvasNorm(xPx) {
    // xPx relative to stage, normalized 0..1 w.r.t stage width
    const s = stage();
    const c = texCanvas();
    if (!s || !c) return 0.5;
    return xPx / s.clientWidth;
  }

  function yPxToCanvasNorm(yPx) {
    const s = stage();
    const c = texCanvas();
    if (!s || !c) return 0.5;
    return yPx / s.clientHeight;
  }

  function normToCanvasPx(nx, ny) {
    const c = texCanvas();
    const w = c?.width || 1024;
    const h = c?.height || 1024;
    return { x: nx * w, y: ny * h };
  }

  function buildItemDOM(el) {
    const wrapper = document.createElement('div');
    wrapper.className = 'design-item';
    wrapper.dataset.elid = el.id;
    wrapper.dataset.type = el.type;
    wrapper.style.left = el.payload.leftPx + 'px';
    wrapper.style.top = el.payload.topPx + 'px';
    wrapper.style.zIndex = String(el.payload.z || ++state.zIndex);

    // Interacción táctil/mouse
    wrapper.style.touchAction = 'none';

    // Botón eliminar
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'design-item-delete';
    del.innerHTML = '×';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      removeElement(el.id);
      requestRender();
    });

    wrapper.appendChild(del);

    if (el.type === 'image') {
      const img = document.createElement('img');
      img.src = el.payload.src;
      img.alt = el.payload.name || 'imagen';
      img.draggable = false;
      img.className = 'design-item-image';
      wrapper.appendChild(img);
    } else if (el.type === 'text') {
      const div = document.createElement('div');
      div.className = 'design-item-text';
      div.textContent = el.payload.text || '';
      div.style.color = el.payload.color || '#000000';
      div.style.fontFamily = el.payload.font || 'Inter, sans-serif';
      div.style.fontWeight = '700';
      div.style.fontSize = el.payload.fontSizePx + 'px';
      wrapper.appendChild(div);
    } else if (el.type === 'clipart') {
      const span = document.createElement('div');
      span.className = 'design-item-clipart';
      span.textContent = el.payload.emoji;
      span.style.fontSize = el.payload.fontSizePx + 'px';
      wrapper.appendChild(span);
    }

    // Drag
    wrapper.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return; // mouse left only
      e.preventDefault();
      e.stopPropagation();

      const rect = stageRect();
      if (!rect) return;

      bringToFront(el.id);

      const left = parseFloat(wrapper.style.left || '0');
      const top = parseFloat(wrapper.style.top || '0');

      wrapper.setPointerCapture?.(e.pointerId);

      state.dragging = {
        id: el.id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originLeft: left,
        originTop: top
      };
      wrapper.classList.add('dragging');
    });

    return wrapper;
  }

  function bringToFront(id) {
    const el = state.elements.get(id);
    if (!el) return;
    el.payload.z = ++state.zIndex;
    const dom = layer()?.querySelector(`[data-elid="${CSS.escape(id)}"]`);
    if (dom) dom.style.zIndex = String(el.payload.z);
  }

  function updateItemDOMPosition(id) {
    const el = state.elements.get(id);
    if (!el) return;
    const dom = layer()?.querySelector(`[data-elid="${CSS.escape(id)}"]`);
    if (!dom) return;
    dom.style.left = el.payload.leftPx + 'px';
    dom.style.top = el.payload.topPx + 'px';
  }

  function requestRender() {
    if (state.rafPending) return;
    state.rafPending = true;
    requestAnimationFrame(() => {
      state.rafPending = false;
      renderToCanvas();
      // Fuerza actualización de textura en el material 3D si existe.
      try {
        if (typeof window.updateCanvasTexture === 'function') {
          // updateCanvasTexture delega a renderNow en WYSIWYG, así que esto mantiene coherencia.
          window.updateCanvasTexture();
        }
      } catch (e) {}
    });
  }


  function removeElement(id) {
    const el = state.elements.get(id);
    if (!el) return;
    state.elements.delete(id);
    layer()?.querySelector(`[data-elid="${CSS.escape(id)}"]`)?.remove();

    // Si era el texto único, no lo “re-creamos”, pero mantenemos que el usuario lo pueda volver a agregar
    // (en nuestro caso, el texto se controla desde el input y se actualiza el elemento existente)
  }

  function initPointerMove() {
    const s = stage();
    if (!s) return;

    s.addEventListener('pointermove', (e) => {
      if (!state.dragging) return;
      const { id, startClientX, startClientY, originLeft, originTop } = state.dragging;
      if (e.pointerId !== state.dragging.pointerId) return;

      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;

      const el = state.elements.get(id);
      if (!el) return;

      // mover dentro del stage
      const newLeft = originLeft + dx;
      const newTop = originTop + dy;

      const maxLeft = (s.clientWidth - el.payload.widthPx);
      const maxTop = (s.clientHeight - el.payload.heightPx);

      el.payload.leftPx = clamp(newLeft, 0, Math.max(0, maxLeft));
      el.payload.topPx = clamp(newTop, 0, Math.max(0, maxTop));

      updateItemDOMPosition(id);
      requestRender();
      
      // Evita que el sistema de la página gestione el scroll durante el arrastre en móvil
      e.preventDefault?.();
    });

    s.addEventListener('pointerup', (e) => {
      if (!state.dragging) return;
      if (e.pointerId !== state.dragging.pointerId) return;
      const id = state.dragging.id;
      state.dragging = null;
      layer()?.querySelector(`[data-elid="${CSS.escape(id)}"]`)?.classList.remove('dragging');
      requestRender();
    });

    s.addEventListener('pointercancel', () => {
      state.dragging = null;
    });
  }

  function readCurrentTextStyle() {
    const fontStyle = document.getElementById('font_style')?.value || 'Inter, sans-serif';
    const color = document.getElementById('text_color_picker')?.value || '#000000';
    const slider = document.getElementById('textSizeSlider')?.value;
    const sliderVal = slider ? parseFloat(slider) : 1.5;
    // mapeo a px (depende de canvas/preview). Para el editor, usamos una escala cómoda.
    const fontSizePx = sliderVal * 32; // ajustable
    return { font: fontStyle, color, fontSizePx };
  }

  function renderToCanvas() {
    const c = texCanvas();
    const ctx = texCtx();
    if (!c || !ctx) return;

    // IMPORTANTE: si no hay elementos, al menos dibujar el fondo para que se vea.
    if (state.elements.size === 0) {
      const baseColor = document.getElementById('product_color_picker')?.value || '#ffffff';
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = 1.0;
      if (window.customTexture) window.customTexture.needsUpdate = true;
      return;
    }


    // Background (se mantiene el mismo look que antes)
    const baseColor = document.getElementById('product_color_picker')?.value || '#ffffff';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, c.width, c.height);

    const noiseAlpha = 0.06;
    ctx.fillStyle = `rgba(255,255,255,${noiseAlpha})`;
    for (let i = 0; i < 1200; i++) {
      const nx = Math.random() * c.width;
      const ny = Math.random() * c.height;
      const s = 1 + Math.random() * 2;
      ctx.globalAlpha = 0.02 + Math.random() * 0.04;
      ctx.fillRect(nx, ny, s, s);
    }
    ctx.globalAlpha = 1.0;

    // Dibujar elementos
    for (const el of state.elements.values()) {
      const domLeft = el.payload.leftPx;
      const domTop = el.payload.topPx;
      const nx = pxToCanvasNorm(domLeft);
      const ny = yPxToCanvasNorm(domTop);

      const p = normToCanvasPx(nx, ny);

      if (el.type === 'image') {
        const img = el.payload.img;
        if (!img) continue;

        // Tamaño en canvas basado en tamaño del DOM (aprox)
        const wCanvas = (el.payload.widthPx / stage().clientWidth) * c.width;
        const hCanvas = (el.payload.heightPx / stage().clientHeight) * c.height;

        ctx.drawImage(img, p.x, p.y, wCanvas, hCanvas);
      } else if (el.type === 'text') {
        const text = el.payload.text || '';
        if (!text) continue;

        // font size proporcional
        const fontPx = (el.payload.fontSizePx / stage().clientHeight) * c.height;
        ctx.fillStyle = el.payload.color || '#000000';
        ctx.font = `bold ${fontPx}px ${el.payload.font}, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, p.x, p.y);
      } else if (el.type === 'clipart') {
        const emoji = el.payload.emoji;
        if (!emoji) continue;

        const fontPx = (el.payload.fontSizePx / stage().clientHeight) * c.height;
        ctx.font = `${fontPx}px serif`;
        ctx.fillStyle = el.payload.color || '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(emoji, p.x, p.y);
      }
    }

    // detalles especiales (short)
    const productType = document.getElementById('product_type')?.value;
    if (productType === 'short') {
      const midX = c.width / 2;
      const topY = c.height * 0.12;
      const botY = c.height * 0.86;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = Math.max(3, c.width * 0.008);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(midX, topY);
      ctx.lineTo(midX, botY);
      ctx.stroke();

      ctx.lineWidth = Math.max(2, c.width * 0.006);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      const leftCx = c.width * 0.28;
      const rightCx = c.width * 0.72;
      const hemY = c.height * 0.78;
      ctx.beginPath();
      ctx.ellipse(leftCx, hemY, c.width * 0.18, c.height * 0.06, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(rightCx, hemY, c.width * 0.18, c.height * 0.06, 0, 0, Math.PI);
      ctx.stroke();
    }

    // marcar update en texture
    if (window.customTexture && typeof window.customTexture.needsUpdate !== 'undefined') {
      window.customTexture.needsUpdate = true;
    }
  }

  // API global para personalizar.html
  function initEditor() {
    const s = stage();
    const l = layer();
    if (!s || !l) return;

    // limpiar lo anterior (evita duplicados si init se llama varias veces)
    try {
      l.innerHTML = '';
    } catch (e) {}
    state.elements.clear();

    initPointerMove();

    // Asegurar tamaño correcto del stage antes de ubicar
    const textInput = document.getElementById('custom_text');
    const { font, color, fontSizePx } = readCurrentTextStyle();
    const initialText = textInput?.value || '';

    const id = uid();
    const leftPx = Math.round(s.clientWidth * 0.5);
    const topPx = Math.round(s.clientHeight * 0.48);
    const widthPx = 400;
    const heightPx = 80;


    const el = {
      id,
      type: 'text',
      payload: {
        text: initialText,
        font,
        color,
        fontSizePx,
        leftPx: leftPx,
        topPx: topPx,
        widthPx,
        heightPx,
        z: ++state.zIndex
      }
    };

    state.elements.set(id, el);
    l.appendChild(buildItemDOM(el));

    state.ready = true;

    // hook input changes
    if (textInput) {
      textInput.addEventListener('input', () => {
        const t = textInput.value || '';
        // actualizar el único texto: asumimos que el primer elemento tipo text es este
        for (const [_, item] of state.elements) {
          if (item.type === 'text') {
            item.payload.text = t;
            // actualizar DOM
            const dom = l.querySelector(`[data-elid="${CSS.escape(item.id)}"]`);
            if (dom) {
              const node = dom.querySelector('.design-item-text');
              if (node) node.textContent = t;
            }
            requestRender();
            return;
          }
        }
      });
    }

    // hook cambios estilo texto
    const styleEls = ['font_style', 'text_color_picker', 'textSizeSlider'];
    styleEls.forEach(selId => {
      const elDom = document.getElementById(selId);
      if (!elDom) return;
      elDom.addEventListener('input', () => {
        syncTextStyle();
      });
      elDom.addEventListener('change', () => {
        syncTextStyle();
      });
    });

    function syncTextStyle() {
      const { font, color, fontSizePx } = readCurrentTextStyle();
      for (const item of state.elements.values()) {
        if (item.type !== 'text') continue;
        item.payload.font = font;
        item.payload.color = color;
        item.payload.fontSizePx = fontSizePx;
        // actualizar bbox aprox
        item.payload.heightPx = Math.round(fontSizePx * 1.1);

        const dom = l.querySelector(`[data-elid="${CSS.escape(item.id)}"]`);
        if (dom) {
          const node = dom.querySelector('.design-item-text');
          if (node) {
            node.style.color = color;
            node.style.fontFamily = font;
            node.style.fontSize = fontSizePx + 'px';
          }
        }
        requestRender();
      }
    }

    // re-render al cambiar producto
    const productSelect = document.getElementById('product_type');
    productSelect?.addEventListener('change', () => requestRender());

    // re-render al cambiar color producto
    const colorPicker = document.getElementById('product_color_picker');
    colorPicker?.addEventListener('input', () => requestRender());

    window.renderCanvasTexture = () => {
      // el customTexture/needsUpdate lo maneja renderToCanvas,
      // pero mantenemos hook por si la app lo necesita.
    };
  }

  function addImageElementFromData(imgEl, fileName) {
    const s = stage();
    const l = layer();
    if (!s || !l) return;
    const id = uid();

    // tamaño inicial basado en proporción, limitando dentro del stage
    const maxW = s.clientWidth * 0.45;
    const maxH = s.clientHeight * 0.35;
    const aspect = (imgEl.naturalWidth || imgEl.width) / (imgEl.naturalHeight || imgEl.height);

    let widthPx = maxW;
    let heightPx = widthPx / aspect;
    if (heightPx > maxH) {
      heightPx = maxH;
      widthPx = heightPx * aspect;
    }

    const leftPx = Math.round((s.clientWidth - widthPx) * 0.5);
    const topPx = Math.round((s.clientHeight - heightPx) * 0.45);

    const el = {
      id,
      type: 'image',
      payload: {
        name: fileName,
        src: imgEl.src,
        img: imgEl,
        leftPx,
        topPx,
        widthPx: Math.round(widthPx),
        heightPx: Math.round(heightPx),
        z: ++state.zIndex
      }
    };

    state.elements.set(id, el);
    l.appendChild(buildItemDOM(el));

    requestRender();
  }

  function addClipartElement(emoji) {
    const s = stage();
    const l = layer();
    if (!s || !l) return;
    const id = uid();

    const fontSizePx = Math.round(s.clientHeight * 0.18);
    const widthPx = fontSizePx * 0.8;
    const heightPx = fontSizePx * 1.05;

    const leftPx = Math.round((s.clientWidth - widthPx) * 0.5);
    const topPx = Math.round((s.clientHeight - heightPx) * 0.35);

    const el = {
      id,
      type: 'clipart',
      payload: {
        emoji,
        color: '#000000',
        fontSizePx,
        leftPx,
        topPx,
        widthPx: Math.round(widthPx),
        heightPx: Math.round(heightPx),
        z: ++state.zIndex
      }
    };

    state.elements.set(id, el);
    l.appendChild(buildItemDOM(el));
    requestRender();
  }

  // Exponer al window
  window.PersonalizarEditor = {
    init: initEditor,
    addImage: (imgEl, fileName) => addImageElementFromData(imgEl, fileName),
    addClipart: (emoji) => addClipartElement(emoji),
    removeAllImages: () => {
      for (const [id, el] of state.elements.entries()) {
        if (el.type === 'image') removeElement(id);
      }
      requestRender();
    },
    // API para que personalizar.html no sobrescriba el canvas
    renderNow: () => {
      renderToCanvas();
      if (window.customTexture && window.customTexture.needsUpdate !== undefined) {
        window.customTexture.needsUpdate = true;
      }
    },
    requestRender
  };
})();

