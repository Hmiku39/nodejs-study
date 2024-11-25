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
    if (req.session.acountNum === undefined) {
        res.locals.isLoggedIn = false;
        console.log('ゲストアクセス');
    } else {
        console.log('ログイン成功');
        console.log('ユーザ：' + req.session.acountNum);
        res.locals.acountNum = req.session.acountNum;
        res.locals.isLoggedIn = true;
    }
    next();
});

//トップページ
app.get('/', (req, res) => {

    if( res.locals.isLoggedIn === true ){
        const today = new Date();//現在の時刻と投稿時間との比較のため
        // console.log(todayTime);
        connection.query(
            // `SELECT * FROM post 
            // INNER JOIN acount ON post.acountNum = acount.acountNum AND deleteFlg = "0" 
            // LEFT OUTER JOIN good ON post.postNum = good.postNum ORDER BY datetime DESC`,
            `SELECT * FROM post 
            INNER JOIN acount ON post.acountNum = acount.acountNum AND deleteFlg = "0"　ORDER BY datetime DESC`,
            (error, results) => {
                console.log(results);
                console.log(error);
                res.render('index.ejs',{posts: results, today: today});
            }
        );
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        res.redirect('/login');
    }
});

//投稿ページ
app.get('/post', (req, res) => {
    if (req.session.acountNum === undefined){
        res.redirect('/login');
    } else {
        res.render('post.ejs');
    }
});

//投稿処理
app.post('/createPost',(req, res) => {
    const date = new Date();
    const postTime = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得
    console.log(postTime);
    connection.query(
        'INSERT INTO post (acountNum, content, datetime) VALUES (?, ?, ?)',
        [req.session.acountNum, req.body.content, postTime],
        (error, results) => {
            console.log(error);
            res.redirect('/');
        })
    }
);

//アカウント新規登録ページ
app.get('/signup', (req, res) => {
    res.render('signup.ejs', {errors: []});
});

//アカウント登録処理
app.post('/signup', (req, res, next) => {
    const userid = req.body.userid;
    const displayName = req.body.displayName;
    const email = req.body.email;
    const password = req.body.password;
    const agree = req.body.agree;
    const errors = [];
    if(userid === ''){
        errors[0] = true;
      }
      if(displayName === ''){
        errors[1] = true;
      }
      if(email === ''){
        errors[2] = true;
      }
      if(password === ''){
        errors[3] = true;
      }
      if(agree === undefined){
        errors[4] = true;
      }
      if(errors.length > 0){
        res.render('signup.ejs', {errors: errors});
      }else{
        next();
      }
},
    (req, res) => {
        const userid = req.body.userid;
        const displayName = req.body.displayName;
        const email = req.body.email;
        const password = req.body.password;
        const date = new Date();
        const signupDate = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得

        connection.query(
            'INSERT INTO acount (userId, displayName, email, password, signupDate) VALUES (?, ?, ? ,?, ?)',
            [userid, displayName, email, password, signupDate],
            (error, results) => {
                req.session.acountNum = results.insertId;
                res.redirect('/');
            }
        );
    }
);

//ログインページ
app.get('/login', (req, res) => {
        res.render('login.ejs', {formErrors: [], loginError: false});
});

//ログイン処理
app.post('/login', (req, res) => {
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
                        req.session.acountNum = results[0].acountNum;
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

//GOOD機能
app.get('/good/:postNum', (req, res) => {
    const postNum = req.params.postNum;
    const date = new Date();
    const goodDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    connection.query(
        'UPDATE post SET good = good + 1 WHERE post.postNum = ?;',
        [postNum],
        (error, results) => {
            console.log(results);
            console.log(error);
            connection.query(
                'INSERT INTO good (acountNum, postNum, goodDate) VALUES (?, ?, ?)',
                [req.session.acountNum, postNum ,goodDate],
                (error, results) => {
                    console.log(results);
                    console.log(error);
                    res.redirect('/');
                }
            );
        }
    );
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