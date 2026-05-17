<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sublimes - Iniciar Sesión</title>
    <link rel="stylesheet" href="static/css/estilos.css">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 40px 20px;">

    <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        <h2 style="text-align: center; color: #333; font-size: 1.8rem;">Iniciar Sesión</h2>
        <p style="text-align: center; color: #666; font-size: 1.1rem;">Ingresa tus datos para entrar al sistema.</p>

        <form id="formLogin">
            <div style="margin-bottom: 20px;">
                <label for="usuario" style="display: block; font-size: 1.1rem; font-weight: bold; margin-bottom: 8px;">Usuario:</label>
                <input type="text" id="usuario" required style="width: 100%; padding: 12px; font-size: 1.1rem; border: 2px solid #ccc; border-radius: 4px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 20px;">
                <label for="contrasena" style="display: block; font-size: 1.1rem; font-weight: bold; margin-bottom: 8px;">Contraseña:</label>
                <input type="password" id="contrasena" required style="width: 100%; padding: 12px; font-size: 1.1rem; border: 2px solid #ccc; border-radius: 4px; box-sizing: border-box;">
            </div>

            <div id="mensajeError" style="display: none; background-color: #ffdddd; color: #d8000c; padding: 12px; border-radius: 4px; font-weight: bold; margin-bottom: 20px; text-align: center; font-size: 1rem;"></div>

            <button type="submit" style="width: 100%; background-color: #ff6600; color: white; border: none; padding: 14px; font-size: 1.2rem; font-weight: bold; border-radius: 4px; cursor: pointer;">
                Entrar a la Tienda
            </button>
        </form>
    </div>

    <script src="static/js/login.js"></script>
</body>
</html>
