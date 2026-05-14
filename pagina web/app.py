import os
import sqlite3
from flask import Flask, render_template, request, redirect, url_for, session, flash
from models import db, User, Product, Order

app = Flask(__name__)
app.secret_key = 'super_secret_key_for_sublime'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tienda.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHARED_DB_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'Sublime', 'BD', 'database.db'))
SHARED_SQL_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'Sublime', 'BD', 'database.sql'))

db.init_app(app)


def ensure_shared_db():
    if not os.path.exists(SHARED_DB_PATH):
        if not os.path.exists(SHARED_SQL_PATH):
            raise RuntimeError('No se encontró BD/database.sql para crear la base de datos compartida.')
        conn = sqlite3.connect(SHARED_DB_PATH)
        conn.execute('PRAGMA foreign_keys = ON')
        with open(SHARED_SQL_PATH, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())
        conn.commit()
        conn.close()


def get_shared_db():
    ensure_shared_db()
    conn = sqlite3.connect(SHARED_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def map_product_row(row):
    return {
        'id': row['id_producto'],
        'name': row['nombre'],
        'category': row['categoria'] or 'General',
        'price': float(row['precio_venta']),
        'image_url': row['ruta_imagen'] or 'default-product.png',
        'description': row['descripcion'] or ''
    }


def fetch_products(categoria=None, search_query=None, sort_option='newest', limit=None):
    conn = get_shared_db()
    sql = (
        'SELECT p.id_producto, p.nombre, p.descripcion, p.precio_venta, '
        'c.nombre AS categoria, '
        'COALESCE((SELECT ruta_imagen FROM imagenes_productos ip WHERE ip.id_producto = p.id_producto ORDER BY ip.id_imagen LIMIT 1), ?) AS ruta_imagen '
        'FROM productos p '
        'LEFT JOIN categorias c ON p.id_categoria = c.id_categoria '
        'WHERE p.activo = 1 '
    )
    params = ['default-product.png']

    if categoria:
        sql += ' AND c.nombre = ? '
        params.append(categoria)

    if search_query:
        sql += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?) '
        term = f'%{search_query}%'
        params.extend([term, term])

    if sort_option == 'price_asc':
        sql += ' ORDER BY p.precio_venta ASC '
    elif sort_option == 'price_desc':
        sql += ' ORDER BY p.precio_venta DESC '
    elif sort_option == 'name_asc':
        sql += ' ORDER BY p.nombre ASC '
    else:
        sql += ' ORDER BY p.id_producto DESC '

    if limit:
        sql += ' LIMIT ? '
        params.append(limit)

    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [map_product_row(row) for row in rows]


def fetch_product_by_id(product_id):
    conn = get_shared_db()
    row = conn.execute(
        'SELECT p.id_producto, p.nombre, p.descripcion, p.precio_venta, c.nombre AS categoria, '
        'COALESCE((SELECT ruta_imagen FROM imagenes_productos ip WHERE ip.id_producto = p.id_producto ORDER BY ip.id_imagen LIMIT 1), ?) AS ruta_imagen '
        'FROM productos p '
        'LEFT JOIN categorias c ON p.id_categoria = c.id_categoria '
        'WHERE p.activo = 1 AND p.id_producto = ? ',
        ['default-product.png', product_id]
    ).fetchone()
    conn.close()
    return map_product_row(row) if row else None


def get_or_create_client(conn, email, nombre, direccion):
    if email:
        cliente = conn.execute('SELECT id_cliente FROM clientes WHERE correo = ? LIMIT 1', (email,)).fetchone()
        if cliente:
            return cliente['id_cliente']

    cliente = conn.execute('SELECT id_cliente FROM clientes WHERE nombre = ? AND direccion = ? LIMIT 1', (nombre, direccion)).fetchone()
    if cliente:
        return cliente['id_cliente']

    cursor = conn.execute(
        'INSERT INTO clientes (nombre, correo, contraseña, direccion) VALUES (?, ?, ?, ?)',
        (nombre, email, '', direccion)
    )
    conn.commit()
    return cursor.lastrowid


def ensure_order_statuses(conn):
    count = conn.execute('SELECT COUNT(*) AS total FROM estados_pedido').fetchone()['total']
    if count == 0:
        conn.executemany('INSERT INTO estados_pedido (nombre) VALUES (?)', [('Pendiente',), ('Procesando',), ('Enviado',), ('Entregado',)])
        conn.commit()


def get_or_create_cart(conn, cliente_id):
    carrito = conn.execute('SELECT id_carrito FROM carrito WHERE id_cliente = ? AND fecha_creacion >= datetime("now", "-1 day") ORDER BY fecha_creacion DESC LIMIT 1', (cliente_id,)).fetchone()
    if carrito:
        return carrito['id_carrito']
    
    cursor = conn.execute('INSERT INTO carrito (id_cliente) VALUES (?)', (cliente_id,))
    conn.commit()
    return cursor.lastrowid


def load_cart_from_db():
    if 'user_id' not in session:
        return []
    
    conn = get_shared_db()
    cliente_id = session['user_id']
    carrito_id = get_or_create_cart(conn, cliente_id)
    
    items = conn.execute(
        'SELECT dc.id_detalle, dc.id_producto, dc.cantidad, dc.precio_unitario, p.nombre AS name, p.descripcion '
        'FROM detalle_carrito dc '
        'LEFT JOIN productos p ON dc.id_producto = p.id_producto '
        'WHERE dc.id_carrito = ?',
        (carrito_id,)
    ).fetchall()
    conn.close()
    
    return [
        {
            'id': item['id_producto'],
            'name': item['name'] or 'Producto personalizado',
            'price': float(item['precio_unitario']),
            'quantity': item['cantidad'],
            'details': item['descripcion'] or ''
        }
        for item in items
    ]


def save_cart_to_db(cart_items):
    if 'user_id' not in session:
        return
    
    conn = get_shared_db()
    cliente_id = session['user_id']
    carrito_id = get_or_create_cart(conn, cliente_id)
    
    # Limpiar carrito anterior
    conn.execute('DELETE FROM detalle_carrito WHERE id_carrito = ?', (carrito_id,))
    
    # Insertar nuevos items
    for item in cart_items:
        conn.execute(
            'INSERT INTO detalle_carrito (id_carrito, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
            (carrito_id, item.get('id'), item.get('quantity', 1), item['price'])
        )
    
    conn.commit()
    conn.close()


# Crear la base de datos y algunos datos iniciales (semillas)
with app.app_context():
    db.create_all()
    # Si no hay productos, crear algunos
    if Product.query.count() == 0:
        products = [
            Product(name="Taza Baki", category="Taza", price=15.00, image_url="taza baki.jpeg", is_trending=True),
            Product(name="Taza con Flores", category="Taza", price=12.00, image_url="taza con flores.jpeg", is_trending=False),
            Product(name="Taza Hollow Knight", category="Taza", price=15.00, image_url="taza hollow knight.jpeg", is_trending=True),
            Product(name="Taza Mensaje Motivador", category="Taza", price=10.00, image_url="taza mensaje 1.jpeg", is_trending=False),
            Product(name="Taza Poo Emoji", category="Taza", price=12.00, image_url="taza poo.jpeg", is_trending=False),
            Product(name="Taza Sabra Pepe", category="Taza", price=15.00, image_url="taza sabra pepe.jpeg", is_trending=True),
            Product(name="Taza Spiderman", category="Taza", price=15.00, image_url="taza spiderman.jpeg", is_trending=True),
            Product(name="Taza Trofeo #1 Mamá", category="Taza", price=18.00, image_url="taza trofeo #1 mama.jpeg", is_trending=True)
        ]
        db.session.add_all(products)
        db.session.commit()

@app.route('/')
def home():
    trending = fetch_products(sort_option='newest', limit=8)
    cart_count = len(load_cart_from_db()) if 'user_id' in session else len(session.get('cart', []))
    return render_template('index.html', trending=trending, cart_count=cart_count)

@app.route('/catalogo')
def catalogo():
    categoria = request.args.get('categoria')
    search_query = request.args.get('q')
    sort_option = request.args.get('sort')
    productos = fetch_products(categoria=categoria, search_query=search_query, sort_option=sort_option)
    
    # Obtener categorías para el filtro
    conn = get_shared_db()
    categorias = conn.execute('SELECT nombre FROM categorias ORDER BY nombre').fetchall()
    conn.close()
    categorias_list = [row['nombre'] for row in categorias]
    
    cart_count = len(load_cart_from_db()) if 'user_id' in session else len(session.get('cart', []))
    return render_template('catalogo.html', productos=productos, categorias=categorias_list, cart_count=cart_count)

@app.route('/producto/<int:id>')
def producto(id):
    p = fetch_product_by_id(id)
    if not p:
        return render_template('404.html'), 404 if '404.html' in os.listdir(os.path.join(BASE_DIR, 'templates')) else ('Producto no encontrado', 404)
    return render_template('producto.html', producto=p)

@app.route('/personalizar', methods=['GET', 'POST'])
def personalizar():
    if request.method == 'POST':
        # Capturar todos los detalles de personalización
        product_type = request.form.get('product_type')
        size = request.form.get('size')
        color = request.form.get('product_color')
        material = request.form.get('material')
        text = request.form.get('custom_text')
        font = request.form.get('font_style')
        placement = request.form.get('placement')
        
        custom_details = f"({product_type.capitalize()}, {size}, {color}, {material})"
        if text:
            custom_details += f" con texto: '{text}' ({font}) en {placement}"
            
        # Crear producto personalizado en DB
        conn = get_shared_db()
        product_id = get_or_create_custom_product(conn)
        conn.close()
        
        flash('Diseño personalizado añadido al carrito.', 'success')
        cart = load_cart_from_db() if 'user_id' in session else session.get('cart', [])
        if not isinstance(cart, list):
            cart = []
        
        cart.append({
            'id': product_id,
            'name': f'Personalizado: {product_type.capitalize()}', 
            'details': custom_details,
            'price': 30.00,
            'quantity': 1
        })
        
        if 'user_id' in session:
            save_cart_to_db(cart)
        else:
            session['cart'] = cart
            session.modified = True
        
        return redirect(url_for('carrito'))
    cart_count = len(load_cart_from_db()) if 'user_id' in session else len(session.get('cart', []))
    return render_template('personalizar.html', cart_count=cart_count)

@app.route('/agregar_carrito/<int:id>')
def agregar_carrito(id):
    p = fetch_product_by_id(id)
    if not p:
        flash('Producto no encontrado.', 'error')
        return redirect(url_for('catalogo'))

    cart = load_cart_from_db() if 'user_id' in session else session.get('cart', [])
    if not isinstance(cart, list):
        cart = []
    
    # Verificar si ya está en carrito
    existing = next((item for item in cart if item.get('id') == id), None)
    if existing:
        existing['quantity'] += 1
    else:
        cart.append({'id': p['id'], 'name': p['name'], 'price': p['price'], 'quantity': 1})
    
    if 'user_id' in session:
        save_cart_to_db(cart)
    else:
        session['cart'] = cart
        session.modified = True
    
    flash(f"{p['name']} añadido al carrito.", 'success')
    return redirect(url_for('catalogo'))

@app.route('/carrito')
def carrito():
    if 'user_id' in session:
        cart = load_cart_from_db()
    else:
        cart = session.get('cart', [])
    
    total = sum(item['price'] * item.get('quantity', 1) for item in cart)
    return render_template('carrito.html', cart=cart, total=total, cart_count=len(cart))

@app.route('/checkout', methods=['GET', 'POST'])
def checkout():
    if 'user_id' in session:
        cart = load_cart_from_db()
    else:
        cart = session.get('cart', [])
    
    if not cart:
        flash('Tu carrito está vacío.', 'error')
        return redirect(url_for('catalogo'))

    total = sum(item['price'] * item.get('quantity', 1) for item in cart)
    if request.method == 'POST':
        name = request.form.get('name')
        address = request.form.get('address')
        payment_method = request.form.get('payment_method')
        reference = request.form.get('reference')

        conn = get_shared_db()
        ensure_order_statuses(conn)
        cliente_id = get_or_create_client(conn, session.get('user_email'), session.get('username') or name, address)
        status = conn.execute('SELECT id_estado FROM estados_pedido WHERE nombre = ? LIMIT 1', ('Pendiente',)).fetchone()
        status_id = status['id_estado'] if status else 1

        pedido_cursor = conn.execute(
            'INSERT INTO pedidos (id_cliente, id_estado, total) VALUES (?, ?, ?)',
            (cliente_id, status_id, total)
        )
        pedido_id = pedido_cursor.lastrowid

        for item in cart:
            product_id = item.get('id')
            if not product_id:
                product_id = get_or_create_custom_product(conn)
            cantidad = item.get('quantity', 1)
            conn.execute(
                'INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                (pedido_id, product_id, cantidad, item['price'])
            )

        conn.execute(
            'INSERT INTO envios (id_pedido, direccion_envio, empresa_envio, numero_guia, estado_envio, fecha_envio) VALUES (?, ?, ?, ?, ?, datetime("now"))',
            (pedido_id, address, payment_method or 'Pendiente', reference or '', 'Pendiente',)
        )
        conn.commit()
        conn.close()

        # Limpiar carrito
        if 'user_id' in session:
            save_cart_to_db([])
        else:
            session.pop('cart', None)
        
        return redirect(url_for('factura', order_id=pedido_id))

    cart_count = len(cart)
    return render_template('checkout.html', total=total, cart_count=cart_count)

@app.route('/factura/<int:order_id>')
def factura(order_id):
    conn = get_shared_db()
    order_row = conn.execute(
        'SELECT p.id_pedido AS id, p.total, p.fecha, e.nombre AS estado, c.nombre AS cliente, c.correo, env.direccion_envio AS address, env.empresa_envio AS payment_method, env.numero_guia AS reference '
        'FROM pedidos p '
        'LEFT JOIN estados_pedido e ON p.id_estado = e.id_estado '
        'LEFT JOIN clientes c ON p.id_cliente = c.id_cliente '
        'LEFT JOIN envios env ON env.id_pedido = p.id_pedido '
        'WHERE p.id_pedido = ? LIMIT 1',
        (order_id,)
    ).fetchone()

    if not order_row:
        conn.close()
        return render_template('404.html'), 404 if '404.html' in os.listdir(os.path.join(BASE_DIR, 'templates')) else ('Pedido no encontrado', 404)

    items = conn.execute(
        'SELECT dp.cantidad, dp.precio_unitario, pr.nombre AS name '
        'FROM detalle_pedidos dp '
        'LEFT JOIN productos pr ON dp.id_producto = pr.id_producto '
        'WHERE dp.id_pedido = ?',
        (order_id,)
    ).fetchall()
    conn.close()

    items_list = [
        {
            'name': item['name'] or 'Producto personalizado',
            'price': item['precio_unitario'] * item['cantidad'],
            'details': f'Cantidad: {item["cantidad"]}' if item['cantidad'] and item['cantidad'] > 1 else ''
        }
        for item in items
    ]

    order = {
        'id': order_row['id'],
        'total': float(order_row['total']),
        'address': order_row['address'] or '',
        'payment_method': order_row['payment_method'] or '',
        'reference': order_row['reference'] or '',
    }
    return render_template('factura.html', order=order, items=items_list)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        conn = get_shared_db()
        user = conn.execute(
            'SELECT id_usuario, nombre, correo, contraseña FROM usuarios WHERE correo = ? OR nombre = ? LIMIT 1',
            (username, username)
        ).fetchone()
        conn.close()

        if user and user['contraseña'] == password:
            session['user_id'] = user['id_usuario']
            session['username'] = user['nombre']
            session['user_email'] = user['correo']
            flash(f'¡Bienvenido de nuevo, {user["nombre"]}!', 'success')
            return redirect(url_for('home'))
        else:
            flash('Usuario o contraseña incorrectos.', 'error')

    return render_template('login.html')


@app.route('/registro', methods=['GET', 'POST'])
def registro():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        email = request.form.get('email')

        conn = get_shared_db()
        existing_user = conn.execute(
            'SELECT id_usuario FROM usuarios WHERE nombre = ? OR correo = ? LIMIT 1',
            (username, email)
        ).fetchone()

        if existing_user:
            flash('El nombre de usuario o email ya está en uso.', 'error')
        else:
            # Asignar rol Trabajador (2) si existe, o Administrador por defecto
            role = conn.execute('SELECT id_rol FROM roles WHERE nombre = ? LIMIT 1', ('Trabajador',)).fetchone()
            role_id = role['id_rol'] if role else 2
            conn.execute(
                'INSERT INTO usuarios (nombre, correo, contraseña, id_rol) VALUES (?, ?, ?, ?)',
                (username, email, password, role_id)
            )
            conn.commit()
            flash('Cuenta creada exitosamente. ¡Bienvenido!', 'success')
            conn.close()
            return redirect(url_for('login'))

        conn.close()

    return render_template('registro.html')


@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('user_email', None)
    flash('Has cerrado sesión.', 'success')
    return redirect(url_for('home'))


if __name__ == '__main__':
    app.run(debug=True, port=5000)
