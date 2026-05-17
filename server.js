const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { getDb } = require('./src/db');
const https = require('https');

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const XLSX = require('xlsx');
const axios = require('axios');
const puppeteer = require('puppeteer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5583988061752';
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-essa-chave-em-producao';

const uploadsDir = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// ================= UPLOAD =================

// ================= UPLOAD CLOUDINARY =================

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const ok = allowed.includes(file.mimetype);

    cb(ok ? null : new Error('Formato inválido'), ok);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'delicias-da-aninha/produtos',
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}


async function uploadImageFromUrl(imageUrl) {

  return new Promise((resolve, reject) => {

    https.get(imageUrl, response => {

      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'pitstop-manaira/produtos',
          resource_type: 'image'
        },
        (error, result) => {

          if (error) {
            return reject(error);
          }

          resolve(result.secure_url);
        }
      );

      response.pipe(stream);

    }).on('error', reject);
  });
}


async function searchGoogleImage(query, ean = '') {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1366,
      height: 768
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    );

    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;

    console.log('URL Bing:', url);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const result = await page.evaluate((ean) => {
      const anchors = Array.from(document.querySelectorAll('.iusc'));
      const urls = [];

      for (const a of anchors) {
        try {
          const meta = JSON.parse(a.getAttribute('m') || '{}');

          if (
            meta.murl &&
            meta.murl.startsWith('http') &&
            !meta.murl.includes('mm.bing.net')
          ) {
            urls.push(meta.murl);
          }
        } catch {}
      }

      const primeiros = urls.slice(0, 5);

      const bons = [
        'vtex',
        'vtexassets',
        'vteximg',
        'tcdn',
        'mlstatic',
        'mercadolivre',
        'redemix',
        'covabra',
        'carrefour',
        'supermercadosbh',
        'muffatosupermercados',
        'angeloni',
        'atacadao',
        'paodeacucar',
        'amazonaws',
        'agilecdn',
        'bluesoft',
        'rappi',
        'ifood',
        'isoplast',
        'shopify'
      ];

      const ruins = [
        'pinimg',
        'pinterest',
        'tumblr',
        'xhamster',
        'xhcdn',
        'porn',
        'xxx',
        'tenor',
        'geocities',
        'wallpaper',
        'wallpapercave',
        'alphacoders',
        'freepik',
        'template',
        'wikimedia',
        'reddit',
        'instagram',
        'facebook',
        'lookaside',
        'blogspot',
        'blogger',
        'youtube',
        'ytimg',
        'istockphoto',
        'shutterstock',
        'dreamstime',
        'ftcdn',
        'news',
        'scribd',
        'goodfon',
        'onlygirls',
        'anime',
        'serebii',
        'medical',
        'carwallpapers',
        'stablediffusion',
        'deviantart',
        'wallpapers',
        'clipart',
        'calendar',
        'worthpoint',
        'worldatlas',
        'udocz',
        'calendar',
        'prezi',
        'scribd',
        'poultry',
        'blog',
        'wordpress',
        'glbimg',
        'wixstatic',
        'linkedin',
        'coloring',
        'vexels',
        'collegepill',
        'erome',
        'wallpapers',
        'deviantart',
        'istock',
        'smartsheet',
        'madebyteachers'
      ];

      const scoreUrl = (link) => {
        const u = String(link || '').toLowerCase();

        if (!u || u.includes('mm.bing.net')) return -999;

        let score = 0;

        // Se a URL contiver códigos numéricos e nenhum deles
        // for igual ao EAN do produto atual, penaliza fortemente.
        if (ean && /\d{8,14}/.test(u)) {
          const numerosNaUrl = u.match(/\d{8,14}/g) || [];

          const temOutroCodigo =
            numerosNaUrl.length > 0 &&
            !numerosNaUrl.includes(String(ean));

          if (temOutroCodigo) {
            score -= 150;
          }
        }

        if (bons.some(d => u.includes(d))) score += 100;
        if (ruins.some(d => u.includes(d))) score -= 100;

        if (u.includes('/produto') || u.includes('/produtos')) score += 20;
        if (u.includes('/product') || u.includes('/products')) score += 20;
        if (u.includes('/arquivos/ids/')) score += 20;
        if (u.includes('/uploads/')) score += 10;
        if (u.includes('/media/catalog/product/')) score += 25;
        if (u.includes('/image/cache/catalog/')) score += 25;

        if (u.includes('1000') || u.includes('1200') || u.includes('1500')) score += 10;

        if (u.endsWith('.jpg') || u.includes('.jpg?')) score += 5;
        if (u.endsWith('.jpeg') || u.includes('.jpeg?')) score += 5;
        if (u.endsWith('.png') || u.includes('.png?')) score += 5;
        if (u.endsWith('.webp') || u.includes('.webp?')) score += 5;

        return score;
      };

      const ordenadas = primeiros
        .map(url => ({
          url,
          score: scoreUrl(url)
        }))
        .sort((a, b) => b.score - a.score);

      const melhor = ordenadas[0];

      return {
        totalImgs: urls.length,
        urls: primeiros,
        scores: ordenadas,
        first: melhor && melhor.score >= 80 ? melhor.url : ''
      };
    }, ean);

    console.log('Total imgs Bing:', result.totalImgs);
    console.log('Primeiras URLs:', result.urls);
    console.log('Pontuação:', result.scores);
    console.log('Imagem escolhida:', result.first || 'Nenhuma imagem confiável');

    if (result.totalImgs <= 1) {
      console.log('⚠️ Poucos resultados. Ignorando essa busca.');
      return '';
    }

    return result.first || '';

  } catch (err) {
    console.log('Erro Bing Puppeteer:', err.message);
    return '';
  } finally {
    await browser.close();
  }
}


// ================= AUTH =================

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Não autorizado' });
}

function requireCustomerAuth(req, res, next) {
  if (req.session && req.session.customerId) return next();
  return res.status(401).json({ error: 'Cliente não autenticado' });
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0]
    .trim();
}

async function logAudit(req, action, details = {}) {
  try {
    const db = await getDb();

    const user = req.session?.userId
      ? await db.get(`SELECT username FROM admin_user WHERE id = $1`, [req.session.userId])
      : null;

    await db.run(`
      INSERT INTO audit_logs (action, details)
      VALUES ($1, $2)
    `, [
      action,
      JSON.stringify({
        ...details,
        user: user ? user.username : 'sistema',
        ip: clientIp(req)
      })
    ]);
  } catch (err) {
    console.error('Erro auditoria:', err.message);
  }
}

async function logAccess(req, page = 'loja') {
  try {
    const db = await getDb();

    const ip = clientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const recent = await db.get(`
      SELECT id
      FROM access_logs
      WHERE ip = $1
        AND user_agent = $2
        AND route = $3
        AND created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY id DESC
      LIMIT 1
    `, [ip, userAgent, page]);

    if (recent) return;

    await db.run(`
      INSERT INTO access_logs (ip, user_agent, route)
      VALUES ($1, $2, $3)
    `, [ip, userAgent, page]);

  } catch (err) {
    console.error('Erro access log:', err.message);
  }
}

// ================= ROTAS PUBLICAS =================

app.get('/', async (req, res) => {
  await logAccess(req, 'loja');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', async (req, res) => {
  const db = await getDb();

  const settings = await db.get(`
    SELECT *
    FROM settings
    WHERE id = 1
  `);

  res.json({
    storeName: settings?.store_name || 'Delícias da Aninha',
    whatsappNumber: settings?.whatsapp_number || WHATSAPP_NUMBER,
    logoUrl: settings?.logo_url || '',
    primaryColor: settings?.primary_color || '#8b1e3f',
    secondaryColor: settings?.secondary_color || '#145f7a',
    deliveryEnabled: Number(settings?.delivery_enabled ?? 1),
    pickupEnabled: Number(settings?.pickup_enabled ?? 1),
    isOpen: Number(settings?.is_open ?? 1)
  });
});

// ================= CLIENTES AUTH =================

app.post('/api/customer/register', async (req, res) => {
  try {
    const db = await getDb();

    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || name.length < 3) {
      return res.status(400).json({
        error: 'Informe seu nome completo.'
      });
    }

    if (!phone || phone.length < 10) {
      return res.status(400).json({
        error: 'Informe um telefone válido.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'A senha deve ter pelo menos 6 caracteres.'
      });
    }

    const exists = await db.get(`
      SELECT id
      FROM customers
      WHERE phone = $1
         OR LOWER(email) = LOWER($2)
    `, [
      phone,
      email || null
    ]);

    if (exists) {
      return res.status(400).json({
        error: 'Já existe uma conta com este telefone ou e-mail.'
      });
    }

    const customer = await db.get(`
      INSERT INTO customers (
        name,
        phone,
        email,
        password_hash,
        is_active
      )
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, name, phone, email
    `, [
      name,
      phone,
      email || null,
      bcrypt.hashSync(password, 10)
    ]);

    req.session.customerId = customer.id;

    res.json({
      ok: true,
      customer
    });

  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);

    res.status(500).json({
      error: 'Erro ao cadastrar cliente.'
    });
  }
});

app.post('/api/customer/login', async (req, res) => {
  try {
    const db = await getDb();

    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!login || !password) {
      return res.status(400).json({
        error: 'Informe login e senha.'
      });
    }

    const cleanPhone = login.replace(/\D/g, '');

    const customer = await db.get(`
      SELECT *
      FROM customers
      WHERE LOWER(email) = LOWER($1)
         OR phone = $2
      LIMIT 1
    `, [
      login,
      cleanPhone
    ]);

    if (!customer) {
      return res.status(401).json({
        error: 'Login ou senha inválidos.'
      });
    }

    const passwordOk = bcrypt.compareSync(
      password,
      customer.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Login ou senha inválidos.'
      });
    }

    if (!customer.is_active) {
      return res.status(403).json({
        error: 'Conta desativada.'
      });
    }

    req.session.customerId = customer.id;

    res.json({
      ok: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email
      }
    });

  } catch (error) {
    console.error('Erro login cliente:', error);

    res.status(500).json({
      error: 'Erro ao fazer login.'
    });
  }
});

app.post('/api/customer/logout', requireCustomerAuth, async (req, res) => {
  req.session.customerId = null;

  res.json({
    ok: true
  });
});

app.get('/api/customer/me', requireCustomerAuth, async (req, res) => {
  try {
    const db = await getDb();

    const customer = await db.get(`
      SELECT
        id,
        name,
        phone,
        email,
        is_active,
        created_at
      FROM customers
      WHERE id = $1
    `, [req.session.customerId]);

    if (!customer) {
      req.session.customerId = null;

      return res.status(401).json({
        error: 'Cliente não encontrado.'
      });
    }

    res.json({
      ok: true,
      customer
    });

  } catch (error) {
    console.error('Erro customer/me:', error);

    res.status(500).json({
      error: 'Erro ao carregar cliente.'
    });
  }
});




app.get('/api/customer/orders', requireCustomerAuth, async (req, res) => {
  try {
    const db = await getDb();

    const orders = await db.all(`
      SELECT
        id,
        customer_name,
        customer_phone,
        address,
        payment,
        note,
        total,
        status,
        created_at
      FROM orders
      WHERE customer_id = $1
      ORDER BY id DESC
    `, [req.session.customerId]);

    for (const order of orders) {
      order.items = await db.all(`
        SELECT
          id,
          product_name,
          quantity,
          price
        FROM order_items
        WHERE order_id = $1
        ORDER BY id ASC
      `, [order.id]);
    }

    res.json({
      ok: true,
      orders
    });

  } catch (error) {
    console.error('Erro ao carregar pedidos do cliente:', error);

    res.status(500).json({
      error: 'Erro ao carregar seus pedidos.'
    });
  }
});




// ================= CATEGORIAS =================

app.get('/api/categories', async (req, res) => {
  const db = await getDb();

  const rows = await db.all(`
    SELECT * FROM categories
    WHERE active = 1
    ORDER BY sort_order ASC, name ASC
  `);

  res.json(rows);
});

// ================= PRODUTOS =================

app.get('/api/products', async (req, res) => {
  const db = await getDb();

  const rows = await db.all(`
    SELECT 
      p.id,
      p.codigo_barras,
      p.nome_descricao AS name,
      '' AS description,
      p.preco AS price,
      p.image_url,
      p.image_url AS image,
      p.active,
      p.category_id,
      c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1
    ORDER BY c.name ASC, p.nome_descricao ASC
  `);

  res.json(rows);
});

// ================= LOGIN =================

app.post('/api/login', async (req, res) => {
  const db = await getDb();

  const { username, password } = req.body;

  const user = await db.get(`
    SELECT * FROM admin_user WHERE username = $1
  `, [username]);

  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    await logAudit(req, 'tentativa de login falhou', { username });
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  req.session.userId = user.id;
  await logAudit(req, 'login realizado', { username: user.username });

  res.json({ ok: true });
});

app.post('/api/logout', async (req, res) => {
  await logAudit(req, 'logout realizado');
  req.session.destroy(() => res.json({ ok: true }));
});

// ================= ADMIN =================

app.get('/api/admin/me', requireAuth, async (req, res) => {
  const db = await getDb();

  const user = await db.get(`
    SELECT username FROM admin_user WHERE id = $1
  `, [req.session.userId]);

  res.json({ ok: true, username: user ? user.username : 'admin' });
});

app.put('/api/admin/account', requireAuth, async (req, res) => {
  const db = await getDb();

  const currentPassword = String(req.body.currentPassword || '');
  const newUsername = String(req.body.username || '').trim();
  const newPassword = String(req.body.newPassword || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  const user = await db.get(`
    SELECT * FROM admin_user WHERE id = 1
  `);

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }

  if (!newUsername || newUsername.length < 3) {
    return res.status(400).json({ error: 'O usuário deve ter pelo menos 3 caracteres.' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'A confirmação da senha não confere.' });
  }

  await db.run(`
    UPDATE admin_user
    SET username = $1, password_hash = $2
    WHERE id = 1
  `, [newUsername, bcrypt.hashSync(newPassword, 10)]);
  await logAudit(req, 'alterou usuário/senha do admin', { novo_usuario: newUsername });

  req.session.destroy(() => res.json({ ok: true }));
});

// ================= PRODUTOS ADMIN =================

app.get('/api/admin/products', requireAuth, async (req, res) => {
  const db = await getDb();

  const rows = await db.all(`
    SELECT 
      p.id,
      p.codigo_barras,
      p.nome_descricao AS name,
      '' AS description,
      p.preco AS price,
      p.image_url,
      p.image_url AS image,
      p.active,
      0 AS featured,
      p.category_id,
      c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY c.name ASC, p.nome_descricao ASC
  `);

  res.json(rows);
});




app.post('/api/admin/products', requireAuth, upload.single('image'), async (req, res) => {
  const db = await getDb();

  const codigo_barras = String(req.body.codigo_barras || '').trim();
  const nome_descricao = String(req.body.nome_descricao || '').trim();
  const preco = Number(req.body.preco || 0);
  const category_id = Number(req.body.category_id || 0) || null;
  const active = req.body.active === '0' ? 0 : 1;

  let image = '';

  if (req.file) {
    image = await uploadToCloudinary(req.file.buffer);
  }

  if (!nome_descricao) {
    return res.status(400).json({ error: 'Nome obrigatório' });
  }

  if (!preco || preco <= 0) {
    return res.status(400).json({ error: 'Preço inválido' });
  }

  const result = await db.get(`
    INSERT INTO products (
      codigo_barras,
      nome_descricao,
      category_id,
      preco,
      image_url,
      active
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [
    codigo_barras,
    nome_descricao,
    category_id,
    preco,
    image,
    active
  ]);

  await logAudit(req, 'criou produto', {
    id: result.id,
    nome: nome_descricao,
    preco
  });

  res.json({ ok: true, id: result.id });
});






app.put('/api/admin/products/:id', requireAuth, upload.single('image'), async (req, res) => {
  const db = await getDb();

  const id = Number(req.params.id);

  const current = await db.get(`
    SELECT * FROM products WHERE id = $1
  `, [id]);

  if (!current) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const codigo_barras = String(req.body.codigo_barras || '').trim();
  const nome_descricao = String(req.body.nome_descricao || '').trim();
  const preco = Number(req.body.preco || 0);
  const category_id = Number(req.body.category_id || 0) || null;
  const active = req.body.active === '1' ? 1 : 0;

  let image = current.image_url;

  if (req.file) {
    image = await uploadToCloudinary(req.file.buffer);
  }

  if (!nome_descricao) {
    return res.status(400).json({ error: 'Nome obrigatório' });
  }

  if (!preco || preco <= 0) {
    return res.status(400).json({ error: 'Preço inválido' });
  }

  await db.run(`
    UPDATE products
    SET
      codigo_barras = $1,
      nome_descricao = $2,
      category_id = $3,
      preco = $4,
      image_url = $5,
      active = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
  `, [
    codigo_barras,
    nome_descricao,
    category_id,
    preco,
    image,
    active,
    id
  ]);

  await logAudit(req, 'editou produto', {
    id,
    nome: nome_descricao,
    preco,
    disponivel: active
  });

  res.json({ ok: true });
});




app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  const db = await getDb();

  const id = Number(req.params.id);
  const product = await db.get(`
    SELECT nome_descricao
    FROM products
    WHERE id = $1
  `, [id]);

  await db.run(`DELETE FROM products WHERE id = $1`, [id]);

  await logAudit(req, 'excluiu produto', {
    id,
    nome: product ? product.nome_descricao : 'produto não encontrado'
  });

  res.json({ ok: true });
});

// ================= CATEGORIAS ADMIN =================

app.post('/api/admin/categories', requireAuth, async (req, res) => {
  const db = await getDb();

  const name = String(req.body.name || '').trim();

  if (!name) return res.status(400).json({ error: 'Informe o nome da categoria.' });

  const exists = await db.get(`
    SELECT id FROM categories WHERE LOWER(name) = LOWER($1)
  `, [name]);

  if (exists) return res.status(400).json({ error: 'Essa categoria já existe.' });

  const result = await db.get(`
    INSERT INTO categories (name, active, sort_order)
    VALUES ($1, 1, 99)
    RETURNING id
  `, [name]);

  await logAudit(req, 'criou categoria', {
    id: result.id,
    categoria: name
  });

  res.json({ id: result.id, name, active: 1, sort_order: 99 });
});

// ================= PEDIDOS =================


// ================= PEDIDOS =================

app.post('/api/orders', async (req, res) => {
  const db = await getDb();

  const {
    items,
    customer_name,
    customer_phone,
    address,
    payment,
    note
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({
      error: 'Pedido vazio'
    });
  }

  let total = 0;

  for (const item of items) {
    total += Number(item.price || 0) * Number(item.quantity || 0);
  }

  let customerId = req.session?.customerId || null;
  let finalCustomerName = customer_name || '';
  let finalCustomerPhone = customer_phone || '';

  if (customerId) {
    const customer = await db.get(`
      SELECT id, name, phone
      FROM customers
      WHERE id = $1
        AND is_active = TRUE
    `, [customerId]);

    if (customer) {
      finalCustomerName = customer.name || finalCustomerName;
      finalCustomerPhone = customer.phone || finalCustomerPhone;
    } else {
      customerId = null;
    }
  }

  const result = await db.get(`
    INSERT INTO orders (
      customer_id,
      customer_name,
      customer_phone,
      address,
      payment,
      note,
      total
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    customerId,
    finalCustomerName,
    finalCustomerPhone,
    address || '',
    payment || '',
    note || '',
    total
  ]);

  const orderId = result.id;

  for (const item of items) {
    await db.run(`
      INSERT INTO order_items (
        order_id,
        product_name,
        quantity,
        price
      )
      VALUES ($1, $2, $3, $4)
    `, [
      orderId,
      item.name || item.nome_descricao || '',
      Number(item.quantity || 0),
      Number(item.price || item.preco || 0)
    ]);
  }

  res.json({
    ok: true,
    orderId,
    customerId
  });
});






// ================= PEDIDOS ADMIN =================

app.get('/api/admin/orders', requireAuth, async (req, res) => {
  const db = await getDb();

  const orders = await db.all(`
    SELECT *
    FROM orders
    ORDER BY 
      CASE status
        WHEN 'novo' THEN 1
        WHEN 'producao' THEN 2
        WHEN 'finalizado' THEN 3
        WHEN 'cancelado' THEN 4
        ELSE 5
      END,
      id DESC
  `);

  for (const order of orders) {
    order.items = await db.all(`
      SELECT *
      FROM order_items
      WHERE order_id = $1
    `, [order.id]);
  }

  res.json(orders);
});

app.put('/api/admin/orders/:id/status', requireAuth, async (req, res) => {
  const db = await getDb();

  const id = Number(req.params.id);
  const status = String(req.body.status || '').trim();

  const allowed = ['novo', 'producao', 'finalizado', 'cancelado'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  await db.run(`
    UPDATE orders
    SET status = $1
    WHERE id = $2
  `, [status, id]);

  await logAudit(req, 'alterou status do pedido', {
    pedido: id,
    status
  });

  res.json({ ok: true });
});



// ================= RELATÓRIOS ADMIN =================

app.get('/api/admin/reports/sales', requireAuth, async (req, res) => {
  try {
    const db = await getDb();

    const { start, end } = req.query;

    let params = [];
    let where = 'WHERE 1=1';

    if (start) {
      params.push(`${start} 00:00:00`);
      where += ` AND created_at >= $${params.length}`;
    }

    if (end) {
      params.push(`${end} 23:59:59`);
      where += ` AND created_at <= $${params.length}`;
    }

    const resumo = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END), 0) AS total_vendido,
        COUNT(*) AS total_pedidos,
        COUNT(DISTINCT NULLIF(customer_phone, '')) AS clientes_unicos,
        COALESCE(
          AVG(CASE WHEN status != 'cancelado' THEN total END),
          0
        ) AS ticket_medio
      FROM orders
      ${where}
    `, params);

    const modalidadesRows = await db.all(`
      SELECT
        CASE
          WHEN address IS NULL OR TRIM(address) = '' THEN 'retirada'
          ELSE 'delivery'
        END AS modalidade,
        COUNT(*) AS total
      FROM orders
      ${where}
      GROUP BY modalidade
    `, params);

    const statusRows = await db.all(`
      SELECT status, COUNT(*) AS total
      FROM orders
      ${where}
      GROUP BY status
    `, params);

    const produtosMaisVendidos = await db.all(`
      SELECT
        oi.product_name AS nome,
        COALESCE(SUM(oi.quantity), 0) AS quantidade,
        COALESCE(SUM(oi.quantity * oi.price), 0) AS total
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      ${where.replaceAll('created_at', 'o.created_at')}
        AND o.status != 'cancelado'
      GROUP BY oi.product_name
      ORDER BY quantidade DESC
      LIMIT 15
    `, params);

    const modalidades = {
      delivery: 0,
      retirada: 0
    };

    modalidadesRows.forEach(row => {
      modalidades[row.modalidade] = Number(row.total || 0);
    });

    const status = {
      pendentes: 0,
      concluidos: 0,
      cancelados: 0
    };

    statusRows.forEach(row => {
      if (row.status === 'novo' || row.status === 'producao') {
        status.pendentes += Number(row.total || 0);
      }

      if (row.status === 'finalizado') {
        status.concluidos += Number(row.total || 0);
      }

      if (row.status === 'cancelado') {
        status.cancelados += Number(row.total || 0);
      }
    });



    const vendasPorDia = await db.all(`
      SELECT
        DATE(created_at) AS dia,
        COALESCE(SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END), 0) AS total
      FROM orders
      ${where}
      GROUP BY DATE(created_at)
      ORDER BY dia ASC
    `, params);

    const vendasPorMes = await db.all(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS mes,
        COALESCE(SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END), 0) AS total
      FROM orders
      ${where}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY mes ASC
    `, params);

    res.json({
      resumo: {
        totalVendido: Number(resumo.total_vendido || 0),
        totalPedidos: Number(resumo.total_pedidos || 0),
        ticketMedio: Number(resumo.ticket_medio || 0),
        clientesUnicos: Number(resumo.clientes_unicos || 0)
      },

      modalidades,

      status,

      produtosMaisVendidos: produtosMaisVendidos.map(item => ({
        nome: item.nome,
        quantidade: Number(item.quantidade || 0),
        total: Number(item.total || 0)
      })),

      vendasPorDia: vendasPorDia.map(item => ({
        dia: item.dia,
        total: Number(item.total || 0)
      })),

      vendasPorMes: vendasPorMes.map(item => ({
        mes: item.mes,
        total: Number(item.total || 0)
      }))
    });











  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({
      error: 'Erro ao gerar relatório de vendas.'
    });
  }
});




// ================= AUDITORIA =================

app.get('/api/admin/audit', requireAuth, async (req, res) => {
  const db = await getDb();

  const logs = await db.all(`
    SELECT *
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 200
  `);

  const formatted = logs.map(log => {
    let details = {};

    try {
      details = log.details ? JSON.parse(log.details) : {};
    } catch {
      details = {};
    }

    return {
      id: log.id,
      action: log.action,
      details,
      user: details.user || 'sistema',
      ip: details.ip || '-',
      created_at: log.created_at
    };
  });

  res.json(formatted);
});

// ================= ACESSOS =================

app.get('/api/admin/access-logs', requireAuth, async (req, res) => {
  const db = await getDb();

  const logs = await db.all(`
    SELECT *
    FROM access_logs
    ORDER BY id DESC
    LIMIT 1000
  `);

  const today = new Date().toISOString().slice(0, 10);
  const uniqueIps = new Set(logs.map(l => l.ip)).size;

  const todayCount = logs.filter(l => {
    if (!l.created_at) return false;
    const date = new Date(l.created_at).toISOString().slice(0, 10);
    return date === today;
  }).length;


  res.json({
    total: logs.length,
    today: todayCount,
    uniqueIps,
    logs: logs.slice(0, 200).map(log => ({
      id: log.id,
      page: log.route || 'loja',
      path: log.route || '/',
      ip: log.ip || '-',
      user_agent: log.user_agent || '',
      created_at: log.created_at
    }))
  });


});

// ================= CONFIGURAÇÕES DA LOJA ADMIN =================

app.get('/api/admin/settings', requireAuth, async (req, res) => {
  const db = await getDb();

  const settings = await db.get(`
    SELECT *
    FROM settings
    WHERE id = 1
  `);

  res.json(settings);
});

app.put('/api/admin/settings', requireAuth, async (req, res) => {
  const db = await getDb();

  const current = await db.get(`SELECT * FROM settings WHERE id = 1`);

  const whatsappNumber = String(req.body.whatsapp_number || '').replace(/\D/g, '');
  const isOpen = req.body.is_open ? 1 : 0;

  if (!whatsappNumber || whatsappNumber.length < 10) {
    return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });
  }

  await db.run(`
    UPDATE settings
    SET
      whatsapp_number = $1,
      is_open = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [
    whatsappNumber,
    isOpen
  ]);

  await logAudit(req, 'alterou configurações da loja', {
    loja: current?.store_name || 'Delícias da Aninha',
    whatsapp: whatsappNumber,
    loja_aberta: isOpen
  });

  res.json({ ok: true });
});


// ================= IMPORTAÇÃO XLSX PRODUTOS =================

app.post('/api/admin/import-products', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const db = await getDb();

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: true
    });

    let imported = 0;
    let skipped = 0;
    let categoriesCreated = 0;

    for (const row of rows) {
      const codigo_barras = String(
        row.codigo_barras ||
        row.CODIGO_BARRAS ||
        row.Código ||
        row.CODIGO ||
        row.codigo ||
        ''
      ).trim();

      const nome_descricao = String(
        row.nome_descricao ||
        row.NOME_DESCRICAO ||
        row.Descrição ||
        row.DESCRICAO ||
        row.DESCRIÇÃO ||
        row.Produto ||
        row.PRODUTO ||
        row.Nome ||
        row.NOME ||
        ''
      ).trim();

      const precoValue =
        row.preco ??
        row.PRECO ??
        row.Preço ??
        row.PREÇO ??
        row.valor ??
        row.VALOR ??
        0;

      let preco = 0;

      if (typeof precoValue === 'number') {
        preco = precoValue;
      } else {
        let txt = String(precoValue)
          .replace('R$', '')
          .replace(/\s/g, '')
          .trim();

        if (txt.includes(',') && txt.includes('.')) {
          txt = txt.replace(/\./g, '').replace(',', '.');
        } else if (txt.includes(',')) {
          txt = txt.replace(',', '.');
        }

        preco = Number(txt);
      }



      const categoriaNome = String(
        row.categoria ||
        row.CATEGORIA ||
        row.Categoria ||
        'Geral'
      ).trim() || 'Geral';

      if (!nome_descricao || !preco || preco <= 0) {
        skipped++;
        continue;
      }

      let category = await db.get(`
        SELECT id FROM categories
        WHERE LOWER(name) = LOWER($1)
      `, [categoriaNome]);

      if (!category) {
        category = await db.get(`
          INSERT INTO categories (name, active, sort_order)
          VALUES ($1, 1, 99)
          RETURNING id
        `, [categoriaNome]);

        categoriesCreated++;
      }

      const exists = codigo_barras
        ? await db.get(`
            SELECT id FROM products
            WHERE codigo_barras = $1
          `, [codigo_barras])
        : null;

      if (exists) {
        await db.run(`
          UPDATE products
          SET
            nome_descricao = $1,
            category_id = $2,
            preco = $3,
            active = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [
          nome_descricao,
          category.id,
          preco,
          exists.id
        ]);
      } else {
        await db.run(`
          INSERT INTO products (
            codigo_barras,
            nome_descricao,
            category_id,
            preco,
            image_url,
            active
          )
          VALUES ($1, $2, $3, $4, '', 1)
        `, [
          codigo_barras,
          nome_descricao,
          category.id,
          preco
        ]);
      }

      imported++;
    }

    await logAudit(req, 'importou produtos via XLSX', {
      importados: imported,
      ignorados: skipped,
      categorias_criadas: categoriesCreated
    });

    res.json({
      ok: true,
      imported,
      skipped,
      categoriesCreated
    });

  } catch (err) {
    console.error('Erro importação XLSX:', err);
    res.status(500).json({ error: 'Erro ao importar planilha.' });
  }
});




app.get('/count-products', async (req, res) => {

  const db = await getDb();

  const total = await db.get(`
    SELECT COUNT(*) AS total
    FROM products
  `);

  res.json(total);
});



// ================= BUSCAR IMAGENS POR CÓDIGO DE BARRAS =================

app.post('/api/admin/fetch-product-images', requireAuth, async (req, res) => {
  const db = await getDb();

  const products = await db.all(`
    SELECT id, codigo_barras, nome_descricao, image_url
    FROM products
    WHERE active = 1
      AND codigo_barras IS NOT NULL
      AND codigo_barras <> ''
      AND (image_url IS NULL OR image_url = '')
    LIMIT 50
  `);

  let updated = 0;
  let notFound = 0;

  for (const product of products) {
    try {
      const ean = String(product.codigo_barras || '').trim();

      const response = await axios.get(
        `https://world.openfoodfacts.org/api/v2/product/${ean}.json`,
        { timeout: 8000 }
      );

      const data = response.data;

      const imageUrl =
        data?.product?.image_front_url ||
        data?.product?.image_url ||
        '';

      if (!imageUrl) {
        notFound++;
        continue;
      }

      await db.run(`
        UPDATE products
        SET image_url = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [imageUrl, product.id]);

      updated++;

    } catch (err) {
      notFound++;
    }
  }

  await logAudit(req, 'buscou imagens automáticas', {
    atualizados: updated,
    nao_encontrados: notFound
  });

  res.json({
    ok: true,
    checked: products.length,
    updated,
    notFound
  });
});


app.post('/api/admin/fetch-google-images', requireAuth, async (req, res) => {

  const db = await getDb();

  const products = await db.all(`
    SELECT id, codigo_barras, nome_descricao, image_url
    FROM products
    WHERE active = 1
      AND (image_url IS NULL OR image_url = '')
    LIMIT 200
  `);

  let updated = 0;
  let notFound = 0;

  for (const product of products) {

    try {

      const tentativas = [
        `${product.codigo_barras} ${product.nome_descricao}`,
        `${product.codigo_barras}`,
        `${product.nome_descricao}`
      ];

      let imageUrl = '';

      for (const query of tentativas) {
        console.log('Buscando:', query);

        imageUrl = await searchGoogleImage(
          query,
          String(product.codigo_barras || '').trim()
        );

        if (imageUrl) {
          console.log('✅ Encontrou com:', query);
          break;
        }
      }
          








      

      if (!imageUrl) {

        console.log(
          '❌ NÃO ENCONTROU:',
          product.nome_descricao
        );

        notFound++;

        continue;
      }

      console.log(
        '✅ IMAGEM ENCONTRADA:',
        product.nome_descricao
      );

      console.log(imageUrl);

      console.log(
        '⬇️ ENVIANDO PRO CLOUDINARY:',
        product.nome_descricao
      );

      const cloudinaryUrl =
        await uploadImageFromUrl(imageUrl);

      console.log(
        '☁️ CLOUDINARY URL:',
        cloudinaryUrl
      );

      await db.run(`
        UPDATE products
        SET image_url = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [
        cloudinaryUrl,
        product.id
      ]);

      updated++;
      console.log(
        '💾 SALVA NO BANCO:',
        product.nome_descricao
      );

      await new Promise(resolve =>
        setTimeout(resolve, 3000)
      );

    } catch (err) {

      console.log(
        'Erro:',
        product.nome_descricao
      );

      notFound++;
    }
  }

  res.json({
    ok: true,
    updated,
    notFound
  });
});




// app.get('/clear-products', async (req, res) => {

//   const db = await getDb();

//   await db.run(`DELETE FROM products`);

//   res.send('Produtos apagados.');
// });




app.get('/clear-images', async (req, res) => {

  const db = await getDb();

  await db.run(`
    UPDATE products
    SET image_url = ''
  `);

  res.send('Imagens removidas.');
});


app.put('/api/admin/products/:id/clear-image', requireAuth, async (req, res) => {
  const db = await getDb();

  const id = Number(req.params.id);

  const product = await db.get(`
    SELECT id, nome_descricao
    FROM products
    WHERE id = $1
  `, [id]);

  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  await db.run(`
    UPDATE products
    SET image_url = '',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [id]);

  await logAudit(req, 'removeu imagem do produto', {
    id,
    nome: product.nome_descricao
  });

  res.json({ ok: true });
});




app.delete('/api/admin/categories/:id', requireAuth, async (req, res) => {
  const db = await getDb();

  const id = Number(req.params.id);

  const category = await db.get(`
    SELECT id, name
    FROM categories
    WHERE id = $1
  `, [id]);

  if (!category) {
    return res.status(404).json({
      error: 'Categoria não encontrada.'
    });
  }

  // Garante que exista a categoria "Geral"
  let geral = await db.get(`
    SELECT id
    FROM categories
    WHERE LOWER(name) = 'geral'
  `);

  if (!geral) {
    geral = await db.get(`
      INSERT INTO categories (name, active, sort_order)
      VALUES ('Geral', 1, 99)
      RETURNING id
    `);
  }

  // Impede excluir a própria categoria Geral
  if (id === geral.id) {
    return res.status(400).json({
      error: 'A categoria Geral não pode ser excluída.'
    });
  }

  // Move os produtos para Geral
  await db.run(`
    UPDATE products
    SET category_id = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE category_id = $2
  `, [geral.id, id]);

  // Remove a categoria
  await db.run(`
    DELETE FROM categories
    WHERE id = $1
  `, [id]);

  await logAudit(req, 'excluiu categoria', {
    id,
    categoria: category.name,
    produtos_movidos_para: 'Geral'
  });

  res.json({
    ok: true,
    movedTo: 'Geral'
  });
});



// ================= DETALHAMENTO DE VENDAS ADMIN =================

app.get('/api/admin/reports/sales-detail', requireAuth, async (req, res) => {
  try {
    const db = await getDb();

    const type = String(req.query.type || 'day');
    const date = String(req.query.date || '');
    const month = String(req.query.month || '');

    let where = `WHERE o.status != 'cancelado'`;
    let params = [];

    if (type === 'day') {
      if (!date) {
        return res.status(400).json({ error: 'Informe a data.' });
      }

      params.push(`${date} 00:00:00`);
      params.push(`${date} 23:59:59`);

      where += ` AND o.created_at >= $1 AND o.created_at <= $2`;
    }

    if (type === 'month') {
      if (!month) {
        return res.status(400).json({ error: 'Informe o mês.' });
      }

      params.push(`${month}-01`);

      where += `
        AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', $1::date)
      `;
    }

    const rows = await db.all(`
      SELECT
        oi.product_name AS nome,
        COALESCE(SUM(oi.quantity), 0) AS quantidade,
        COALESCE(SUM(oi.quantity * oi.price), 0) AS total
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      ${where}
      GROUP BY oi.product_name
      ORDER BY quantidade DESC, total DESC
    `, params);

    res.json({
      type,
      date,
      month,
      itens: rows.map(item => ({
        nome: item.nome,
        quantidade: Number(item.quantidade || 0),
        total: Number(item.total || 0)
      }))
    });

  } catch (error) {
    console.error('Erro ao gerar detalhamento de vendas:', error);
    res.status(500).json({
      error: 'Erro ao gerar detalhamento de vendas.'
    });
  }
});




// ================= START =================

app.listen(PORT, () => {
  console.log(`Rodando em http://localhost:${PORT}`);
  console.log(`Loja: http://localhost:${PORT}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin/login.html`);
});

app.get('/admin/relatorios', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'admin-relatorios.html'));
});