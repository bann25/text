require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const port = 3000;

// Настройка сессий
app.use(session({
    secret: 'bookworm_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Подключение к базе данных
const db = new sqlite3.Database('./database/bookworm.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('Подключено к базе данных SQLite');
        initializeDatabase();
    }
});

// Инициализация базы данных
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Создаем таблицу пользователей
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fullName TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                login TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                isAdmin BOOLEAN DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, async () => {
                // Проверяем существование администратора
                db.get("SELECT id FROM users WHERE login = ?", [process.env.ADMIN_LOGIN], async (err, row) => {
                    if (err) return reject(err);
                    
                    if (!row) {
                        try {
                            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
                            db.run(
                                "INSERT INTO users (fullName, phone, email, login, password, isAdmin) VALUES (?, ?, ?, ?, ?, ?)",
                                [
                                    'Системный Администратор',
                                    '+79000000000',
                                    'admin@bookworm.com',
                                    process.env.ADMIN_LOGIN,
                                    hashedPassword,
                                    1
                                ],
                                function(err) {
                                    if (err) reject(err);
                                    else {
                                        console.log('Администратор создан');
                                        resolve();
                                    }
                                }
                            );
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        console.log('Администратор уже существует');
                        resolve();
                    }
                });
            });
        });
    });
}

// Инициализация при старте
initializeDatabase().catch(err => {
    console.error('Ошибка инициализации БД:', err);
});

module.exports = db;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Проверка аутентификации
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/auth');
}

// Проверка администратора
function isAdmin(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }
    res.status(403).send('Доступ запрещен');
}

// Маршруты
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'auth.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/cards', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'cards.html'));
});

app.get('/create-card', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'create-card.html'));
});

app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// API маршруты
app.post('/api/register', (req, res) => {
    const { fullName, phone, email, login, password } = req.body;
    
    // Валидация
    if (!fullName || !phone || !email || !login || !password) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    if (!/^[а-яА-ЯёЁ\s]+$/.test(fullName)) {
        return res.status(400).json({ error: 'ФИО должно содержать только кириллицу и пробелы' });
    }
    
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: 'Неверный формат электронной почты' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.run(`INSERT INTO users (full_name, phone, email, login, password) 
            VALUES (?, ?, ?, ?, ?)`, 
            [fullName, phone, email, login, hashedPassword], 
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Логин или email уже заняты' });
                    }
                    return res.status(500).json({ error: 'Ошибка при регистрации' });
                }
                res.json({ success: true, userId: this.lastID });
            });
});

app.post('/api/auth', (req, res) => {
    const { login, password } = req.body;
    
    db.get(`SELECT id, login, password, is_admin FROM users WHERE login = ?`, [login], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        req.session.userId = user.id;
        req.session.isAdmin = user.is_admin === 1;
        
        res.json({ success: true, isAdmin: user.is_admin === 1 });
    });
});

app.get('/api/user', isAuthenticated, (req, res) => {
    db.get(`SELECT id, full_name, phone, email, login FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(user);
    });
});

app.post('/api/cards', isAuthenticated, (req, res) => {
    const { author, title, type } = req.body;
    
    if (!author || !title || !type) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    
    db.run(`INSERT INTO cards (user_id, author, title, type) 
            VALUES (?, ?, ?, ?)`, 
            [req.session.userId, author, title, type], 
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка при создании карточки' });
                }
                res.json({ success: true, cardId: this.lastID });
            });
});

app.get('/api/cards', isAuthenticated, (req, res) => {
    const { status } = req.query;
    let query = `SELECT * FROM cards WHERE user_id = ?`;
    const params = [req.session.userId];
    
    if (status) {
        query += ` AND status = ?`;
        params.push(status);
    }
    
    db.all(query, params, (err, cards) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка при получении карточек' });
        }
        res.json(cards);
    });
});

app.delete('/api/cards/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    
    db.run(`DELETE FROM cards WHERE id = ? AND user_id = ?`, [id, req.session.userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Ошибка при удалении карточки' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Карточка не найдена или нет прав на удаление' });
        }
        res.json({ success: true });
    });
});

// Админские маршруты
app.get('/api/admin/cards', isAuthenticated, isAdmin, (req, res) => {
    const { status } = req.query;
    let query = `SELECT c.*, u.full_name, u.email 
                FROM cards c 
                JOIN users u ON c.user_id = u.id`;
    const params = [];
    
    if (status) {
        query += ` WHERE c.status = ?`;
        params.push(status);
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    db.all(query, params, (err, cards) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка при получении карточек' });
        }
        res.json(cards);
    });
});

app.put('/api/admin/cards/:id', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    
    if (!status || (status === 'rejected' && !rejection_reason)) {
        return res.status(400).json({ error: 'Неверные параметры запроса' });
    }
    
    db.run(`UPDATE cards 
            SET status = ?, rejection_reason = ?
            WHERE id = ?`, 
            [status, rejection_reason, id], 
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка при обновлении карточки' });
                }
                res.json({ success: true });
            });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});