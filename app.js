const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const app = express();
const connection = mysql.createConnection({
    host: '192.168.100.25',
    user: 'test',
    password: 'test',
    database: 'web_app'
});
app.use(
    session({
        secret: 'my_secret_key',
        resave: false,
        saveUninitialized: false,
    })
);
app.use((req, res, next) => {
    if (req.session.userId === undefined) {
        console.log('ログインしていません');
        res.locals.username = 'ゲスト';
    } else {
        console.log('ログインしています');
        res.locals.username = req.session.username;
    }
    next();
});

//publicディレクトリのデータを読めるようにするやつ
app.use(express.static('public'));
//フォームの値を受け取れるようにしたやつ
app.use(express.urlencoded({extended: false}));

app.get('/', (req, res) => {
    connection.query(
        'SELECT * FROM acount ',
        (error, results) => {
            console.log(results);
            console.log(error);
            res.render('index.ejs',{acounts: results});
        }
    );
});

app.get('/new', (req, res) => {
        res.render('new.ejs');
    }
);

app.post('/create',(req, res) => {
    connection.query(
        'INSERT INTO acount (name) VALUES (?)',
        [req.body.itemName],
        (error, results) => {
            res.redirect('/')
        })
    }
);

app.get('/login', (req, res) => {
        res.render('login.ejs');
});
app.post('/login', (req, res) => {
    const email = req.body.email;
    connection.query(
        'SELECT * FROM acount WHERE email = ?',
        [email],
        (error, results) => {
            if (results.length > 0) {
                if (req.body.password === results[0].password){
                    req.session.userId = results[0].id;
                    req.session.username = results[0].username;
                    res.redirect('/');
                } else {
                    res.redirect('/login');
                }    
            } else {
            res.redirect('/login');
            }
        }
    );
  });

app.get('/logout', (req, res) => {
    req.session.destroy((error)  => {
        res.redirect('/list');
    });
});

app.listen(3000);