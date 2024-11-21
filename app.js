const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const app = express();
//時刻取得
require('date-utils');

//publicディレクトリのデータを読めるようにするやつ
app.use(express.static('public'));
//フォームの値を受け取れるようにしたやつ
app.use(express.urlencoded({extended: false}));

//MYSQL接続情報
const connection = mysql.createConnection({
    host: '192.168.100.25',
    user: 'test',
    password: 'test',
    database: 'web_app'
});
//セッション使用準備
app.use(
    session({
        secret: 'my_secret_key',
        resave: false,
        saveUninitialized: false,
    })
);
//ログインチェック
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

//トップページ
app.get('/', (req, res) => {
    const today = new Date();
    // console.log(todayTime);
    connection.query(
        'SELECT * FROM post ',
        (error, results) => {
            // console.log(results);
            // console.log(error);
            res.render('index.ejs',{posts: results, today: today});
        }
    );
});

//投稿ページ
app.get('/post', (req, res) => {
    if (res.locals.isLoggedIn === true){
        res.render('post.ejs');
    } else {
        res.render('login.ejs', {formErrors: [], loginError: false});
    }
});

//投稿処理
app.post('/createPost',(req, res) => {
    const date = new Date();
    const postTime = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得
    console.log(postTime);
    connection.query(
        'INSERT INTO post (name, content, datetime) VALUES (?, ?, ?)',
        [req.session.name, req.body.content, postTime],
        (error, results) => {
            // console.log(results);
            console.log(error);
            res.redirect('/')
        })
    }
);

//アカウント新規登録ページ
app.get('/signup', (req, res) => {
    res.render('signup.ejs', {errors: []});
});

//アカウント登録処理
app.post('/signup', (req, res, next) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const agree = req.body.agree;
    const errors = [];
    if(name === ''){
        errors[0] = true;
      }
      if(email === ''){
        errors[1] = true;
      }
      if(password === ''){
        errors[2] = true;
      }
      if(agree === undefined){
        errors[3] = true;
      }
      if(errors.length > 0){
        res.render('signup.ejs', {errors: errors});
      }else{
        next();
      }
},
    (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const date = new Date();
    const signupDate = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得

    connection.query(
        'INSERT INTO acount (name, email, password, signupDate) VALUES (?, ?, ? ,?)',
        [name, email, password, signupDate],
        (error, results) => {
            req.session.userId = results.insertId;
            req.session.name = name;
            res.redirect('/');
        }
    );
});

//ログインページ
app.get('/login', (req, res) => {
        res.render('login.ejs', {formErrors: [], loginError: false});
});

//ログイン処理
app.post('/login', (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    const formErrors = [];
    const loginError = false;
    if(email === ''){
        formErrors[0] = true;
    }
    if(password === ''){
        formErrors[1] = true;
    }
    if(formErrors.length > 0){
        res.render('login.ejs', {formErrors: formErrors, loginError: loginError});
    }else{
        connection.query(
            'SELECT * FROM acount WHERE email = ?',
            [email],
            (error, results) => {
                console.log(results);
                console.log(error);
                console.log(results.length);
                if (results.length > 0) {
                    if (req.body.password === results[0].password){
                        req.session.userId = results[0].id;
                        req.session.name = results[0].name;
                        res.redirect('/');
                    } else {
                        res.render('login.ejs', {formErrors: formErrors, loginError: true});
                    }
                } else {
                    res.render('login.ejs', {formErrors: formErrors, loginError: true});
                }
            }
        );
    }
});

app.get('/test', (req, res) => {
    res.render('test.ejs');
});

//ログアウト
app.get('/logout', (req, res) => {
    req.session.destroy((error)  => {
        res.redirect('/');
    });
});

app.listen(3000);