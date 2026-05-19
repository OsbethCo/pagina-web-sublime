from flask import Flask, render_template, request, redirect, url_for, session, flash
from models import db, User, Product, Order

app = Flask(__name__)
app.secret_key = 'super_secret_key_for_sublime'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tienda.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

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
    trending = Product.query.filter_by(is_trending=True).all()
    return render_template('index.html', trending=trending)

@app.route('/catalogo')
def catalogo():
    categoria = request.args.get('categoria')
    search_query = request.args.get('q')
    sort_option = request.args.get('sort')
    
    query = Product.query
    
    if categoria:
        query = query.filter_by(category=categoria)
    
    if search_query:
        query = query.filter(Product.name.contains(search_query))
        
    if sort_option == 'price_asc':
        query = query.order_by(Product.price.asc())
    elif sort_option == 'price_desc':
        query = query.order_by(Product.price.desc())
    elif sort_option == 'name_asc':
        query = query.order_by(Product.name.asc())
    else:
        query = query.order_by(Product.id.desc())
        
    productos = query.all()
    return render_template('catalogo.html', productos=productos)

@app.route('/producto/<int:id>')
def producto(id):
    p = Product.query.get_or_404(id)
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
            
        flash('Diseño personalizado añadido al carrito.', 'success')
        if 'cart' not in session:
            session['cart'] = []
        session['cart'].append({
            'name': f'Personalizado: {product_type.capitalize()}', 
            'details': custom_details,
            'price': 30.00
        })
        session.modified = True
        return redirect(url_for('carrito'))
    return render_template('personalizar.html')

@app.route('/agregar_carrito/<int:id>')
def agregar_carrito(id):
    p = Product.query.get_or_404(id)
    if 'cart' not in session:
        session['cart'] = []
    session['cart'].append({'name': p.name, 'price': p.price})
    session.modified = True
    flash(f'{p.name} añadido al carrito.', 'success')
    return redirect(url_for('catalogo'))

@app.route('/carrito')
def carrito():
    cart = session.get('cart', [])
    total = sum(item['price'] for item in cart)
    return render_template('carrito.html', cart=cart, total=total)

@app.route('/checkout', methods=['GET', 'POST'])
def checkout():
    cart = session.get('cart', [])
    if not cart:
        flash('Tu carrito está vacío.', 'error')
        return redirect(url_for('catalogo'))
        
    if request.method == 'POST':
        name = request.form.get('name')
        address = request.form.get('address')
        payment_method = request.form.get('payment_method')
        reference = request.form.get('reference')
        total = sum(item['price'] for item in cart)
        
        # Guardar items como JSON
        import json
        items_json = json.dumps(cart)
        
        u = User.query.first()
        if not u:
            u = User(username='Invitado', password='na')
            db.session.add(u)
            db.session.commit()
            
        order = Order(
            user_id=u.id, 
            total=total, 
            address=f"{name} - {address}",
            payment_method=payment_method,
            reference=reference,
            items_json=items_json
        )
        db.session.add(order)
        db.session.commit()
        
        session.pop('cart', None)
        return redirect(url_for('factura', order_id=order.id))
        
    total = sum(item['price'] for item in cart)
    return render_template('checkout.html', total=total)

@app.route('/factura/<int:order_id>')
def factura(order_id):
    order = Order.query.get_or_404(order_id)
    import json
    items = json.loads(order.items_json) if order.items_json else []
    return render_template('factura.html', order=order, items=items)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter((User.username == username) | (User.email == username)).first()
        
        if user and user.password == password:
            session['user_id'] = user.id
            session['username'] = user.username
            flash(f'¡Bienvenido de nuevo, {user.username}!', 'success')
            return redirect(url_for('home'))
        else:
            flash('Usuario o contraseña incorrectos.', 'error')
            
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    flash('Has cerrado sesión exitosamente.', 'success')
    return redirect(url_for('home'))


@app.route('/registro', methods=['GET', 'POST'])
def registro():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        email = request.form.get('email')
        
        existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing_user:
            flash('El nombre de usuario o email ya está en uso.', 'error')
        else:
            new_user = User(username=username, password=password, email=email)
            db.session.add(new_user)
            db.session.commit()
            flash('Cuenta creada exitosamente. ¡Bienvenido!', 'success')
            return redirect(url_for('login'))
            
    return render_template('registro.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
