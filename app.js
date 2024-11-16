const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const app = express();

//時刻取得
require('date-utils');

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
        console.log('ゲストアクセス');
        res.locals.name = 'ゲスト';
        res.locals.isLoggedIn = false;
    } else {
        console.log('ログイン成功');
        res.locals.name = req.session.name;
        console.log('ユーザ：' + req.session.name);
        res.locals.isLoggedIn = true;
    }
    next();
});

//publicディレクトリのデータを読めるようにするやつ
app.use(express.static('public'));
//フォームの値を受け取れるようにしたやつ
app.use(express.urlencoded({extended: false}));

app.get('/', (req, res) => {
    connection.query(
        'SELECT * FROM post ',
        (error, results) => {
            // console.log(results);
            // console.log(error);
            res.render('index.ejs',{posts: results});
        }
    );
});

app.get('/post', (req, res) => {
    if (res.locals.isLoggedIn === true){
        res.render('post.ejs');
    } else {
        res.render('login.ejs');
    }
});

app.post('/createPost',(req, res) => {
    const date = new Date();
    const currentTime = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得
    console.log(currentTime);
    connection.query(
        'INSERT INTO post (name, content, datetime) VALUES (?, ?, ?)',
        [req.session.name, req.body.content, currentTime],
        (error, results) => {
            // console.log(results);
            // console.log(error);
            res.redirect('/')
        })
    }
);

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

app.post('/signup', (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    
    connection.query(
        'INSERT INTO acount (name, email, password) VALUES (?, ?, ?)',
        [name, email, password],
        (error, results) => {
            res.redirect('/');
        }
    );
});


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
                    req.session.name = results[0].name;
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
        res.redirect('/');
    });
});

app.listen(3000);