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
        p1 = Product(name="Franela Neon Flash", category="Franela", price=25.00, image_url="placeholder.png", is_trending=True)
        p2 = Product(name="Taza Cyberpunk", category="Taza", price=15.00, image_url="placeholder.png", is_trending=True)
        p3 = Product(name="Llavero Glow", category="Llavero", price=5.00, image_url="placeholder.png", is_trending=False)
        db.session.add_all([p1, p2, p3])
        db.session.commit()

@app.route('/')
def home():
    trending = Product.query.filter_by(is_trending=True).all()
    return render_template('index.html', trending=trending)

@app.route('/catalogo')
def catalogo():
    categoria = request.args.get('categoria')
    if categoria:
        productos = Product.query.filter_by(category=categoria).all()
    else:
        productos = Product.query.all()
    return render_template('catalogo.html', productos=productos)

@app.route('/producto/<int:id>')
def producto(id):
    p = Product.query.get_or_404(id)
    return render_template('producto.html', producto=p)

@app.route('/personalizar', methods=['GET', 'POST'])
def personalizar():
    if request.method == 'POST':
        # Simulación de recibir un diseño
        flash('Diseño subido correctamente y añadido al carrito.', 'success')
        # Lógica simplificada de carrito:
        if 'cart' not in session:
            session['cart'] = []
        session['cart'].append({'name': 'Producto Personalizado', 'price': 30.00})
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
        address = request.form.get('address')
        total = sum(item['price'] for item in cart)
        
        # Crear orden
        # Nota: asumiendo usuario anonimo por simplicidad, o requerir login. 
        u = User.query.first()
        if not u:
            u = User(username='Invitado', password='na')
            db.session.add(u)
            db.session.commit()
            
        order = Order(user_id=u.id, total=total, address=address)
        db.session.add(order)
        db.session.commit()
        
        # Limpiar carrito
        session.pop('cart', None)
        
        # Ir a factura
        return redirect(url_for('factura', order_id=order.id))
        
    total = sum(item['price'] for item in cart)
    return render_template('checkout.html', total=total)

@app.route('/factura/<int:order_id>')
def factura(order_id):
    order = Order.query.get_or_404(order_id)
    return render_template('factura.html', order=order)

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/registro')
def registro():
    return render_template('registro.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
