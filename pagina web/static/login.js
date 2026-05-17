// static/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const mensajeError = document.getElementById('mensajeError');

    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault(); // Evita que la página se recargue automáticamente

            const usuarioInput = document.getElementById('usuario').value.trim();
            const contrasenaInput = document.getElementById('contrasena').value;

            // Ocultar errores anteriores
            mensajeError.style.display = 'none';
            mensajeError.textContent = '';

            try {
                // Enviamos los datos a tu servidor (reemplaza '/api/login' por tu ruta real si la tienes)
                const respuesta = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        usuario: usuarioInput,
                        contrasena: contrasenaInput
                    })
                });

                const datos = await respuesta.json();

                if (respuesta.ok) {
                    // SI EL LOGIN ES CORRECTO:
                    // Guardamos en la memoria del navegador que el usuario ya entró
                    localStorage.setItem('sesionActiva', 'true');
                    localStorage.setItem('nombreUsuario', usuarioInput);

                    // Lo mandamos a la página principal de la tienda
                    window.location.href = 'index.html'; 
                } else {
                    // SI HAY UN ERROR:
                    // Mostramos un texto claro y fácil de entender
                    mensajeError.textContent = datos.mensaje || 'El usuario o la contraseña no son correctos. Inténtalo de nuevo.';
                    mensajeError.style.display = 'block';
                }

            } catch (error) {
                console.error('Error:', error);
                mensajeError.textContent = 'Hubo un problema de conexión. Revisa tu internet.';
                mensajeError.style.display = 'block';
            }
        });
    }
});
