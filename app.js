const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const app = express();
const { recentPost } = require('./recentpost');//投稿日時と現在の時刻の差分計算

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


const authenticateUser = (req, res, next) => {//ログインしていないユーザによる不正URLクエリ防止
    if (!req.session.acountNum) {
        return res.status(401).send('401 - Unauthorized');
    }
    next();
};

//トップページ
app.get('/', (req, res) => {

    if (res.locals.isLoggedIn === true){
        const today = new Date();//現在の時刻と投稿時間との比較のため
        // console.log(todayTime);
        connection.query(
            `SELECT post.postNum AS post_postNum,
            post.acountNum AS post_acountNum,
            post.content AS post_content,
            post.datetime AS post_datetime,
            post.good AS post_good,      
            acount.acountNum AS acount_acountNum,
            acount.userId AS acount_userId,
            acount.displayName AS acount_displayName,
            good.postNum AS good_postNum,
            good.acountNum AS good_acountNum
            FROM post 
            INNER JOIN acount ON post.acountNum = acount.acountNum AND deleteFlg = "0"
            LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
            ORDER BY datetime DESC`,
            [req.session.acountNum],
            (error, results) => {
                console.log(results);
                console.log(error);
                res.render('index.ejs',{posts: results, recentPost});
            }
        );
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        res.redirect('/login');
    }
});

//プロフィールページ
app.get('/profile', (req, res) => {
    const userId = req.query.userid;
    if (res.locals.isLoggedIn === true){
        const today = new Date();//現在の時刻と投稿時間との比較のため
        // console.log(todayTime);
        if (userId === undefined) {//ユーザーIDの指定がない場合自分のプロフィールページを表示
            connection.query(
                `SELECT * FROM acount WHERE acountNum = ?`,
                [req.session.acountNum],
                (error, profResult) => {
                    console.log(profResult);
                    console.log(error);
                
                    connection.query(
                        `SELECT post.postNum AS post_postNum,
                        post.acountNum AS post_acountNum,
                        post.content AS post_content,
                        post.datetime AS post_datetime,
                        post.good AS post_good,      
                        acount.acountNum AS acount_acountNum,
                        acount.userId AS acount_userId,
                        acount.displayName AS acount_displayName,
                        good.postNum AS good_postNum,
                        good.acountNum AS good_acountNum
                        FROM post 
                        INNER JOIN acount ON acount.acountNum = ? AND post.acountNum = acount.acountNum AND deleteFlg = "0"
                        LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
                        ORDER BY post.datetime DESC`,
                        [req.session.acountNum, req.session.acountNum],
                        (error, results) => {
                            // console.log(results);
                            console.log(error);
                            console.log('はははははははは');
                            console.log(results);
                            res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: 'myprofile'});
                        }
                    );
                }
            );
        } else {//URLのユーザーIDのプロフィールページ表示
            connection.query(
                `SELECT * FROM acount WHERE userId = ?`,
                [userId],
                (prof_error, profResult) => {
                    console.log(profResult);
                    console.log(prof_error);
                    if (profResult[0].acountNum === req.session.acountNum){//自分のユーザーIDならQUERY無しURLにリダイレクト
                        res.redirect('/profile');
                    }
              
                    connection.query(
                        `SELECT post.postNum AS post_postNum,
                        post.acountNum AS post_acountNum,
                        post.content AS post_content,
                        post.datetime AS post_datetime,
                        post.good AS post_good,      
                        acount.acountNum AS acount_acountNum,
                        acount.userId AS acount_userId,
                        acount.displayName AS acount_displayName,
                        good.postNum AS good_postNum,
                        good.acountNum AS good_acountNum
                        FROM post 
                        INNER JOIN acount ON acount.userId = ? AND post.acountNum = acount.acountNum AND deleteFlg = "0"
                        LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
                        ORDER BY post.datetime DESC`,
                        [userId, req.session.acountNum],
                        (error, results) => {
                            // console.log(results);
                            console.log(error);

                            //対象のアカウントをフォロー中かチェック
                            connection.query(
                                `SELECT * FROM follow WHERE acountNum = ? AND followAcountNum = ?`,
                                [req.session.acountNum, profResult[0].acountNum],
                                (follow_error, followResult) => {
                                    console.log(followResult);
                                    console.log(follow_error);
                                    if (followResult.length > 0) {//一致するデータがなければまだフォローしていない
                                        res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: true});
                                    } else {
                                        res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: false});
                                    }
                                }
                            );
                        }
                    );
                }
            );
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        res.redirect('/login');
    }
});

//フォロー機能
app.post('/follow', authenticateUser, (req, res) => {
    const followId = req.body.followid;
    const date = new Date();
    const followDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    connection.query(
        `UPDATE acount SET follow = follow + 1 WHERE acount.acountNum = ?;`,
        [req.session.acountNum],
        (error_follow, results_follow) => {
            console.log(results_follow);
            console.log(error_follow);
            
            connection.query(
                `UPDATE acount SET followers = followers + 1 WHERE acount.acountNum = ?;`,
                [followId],
                (error_followers, results_followers) => {
                    console.log(results_followers);
                    console.log(error_followers);
                
                    connection.query(
                        `INSERT INTO follow (acountNum, followAcountNum, followDate) VALUES (?, ?, ?)`,
                        [req.session.acountNum, followId ,followDate],
                        (error_followR, results_followR) => {
                            console.log(results_followR);
                            console.log(error_followR);
                            connection.query(
                                `SELECT userId FROM acount WHERE acountNum = ?`,
                                [followId],
                                (error, result) => {
                                    console.log(result);
                                    console.log(error);
                                    res.redirect('/profile?userid='+result[0].userId);
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

//フォロー解除機能
app.post('/unfollow', authenticateUser, (req, res) => {
    const followId = req.body.followid;
    connection.query(
        `UPDATE acount SET follow = follow - 1 WHERE acount.acountNum = ?;`,
        [req.session.acountNum],
        (error_follow, results_follow) => {
            console.log(results_follow);
            console.log(error_follow);
            
            connection.query(
                `UPDATE acount SET followers = followers - 1 WHERE acount.acountNum = ?;`,
                [followId],
                (error_followers, results_followers) => {
                    console.log(results_followers);
                    console.log(error_followers);
                
                    connection.query(
                        `DELETE FROM follow WHERE acountNum = ? AND followAcountNum = ?`,
                        [req.session.acountNum, followId],
                        (error_followR, results_followR) => {
                            console.log(results_followR);
                            console.log(error_followR);
                            connection.query(
                                `SELECT userId FROM acount WHERE acountNum = ?`,
                                [followId],
                                (error, result) => {
                                    console.log(result);
                                    console.log(error);
                                    res.redirect('/profile?userid='+result[0].userId);
                                }
                            );
                        }
                    );
                }
            );
        }
    );
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
        `INSERT INTO post (acountNum, content, datetime) VALUES (?, ?, ?)`,
        [req.session.acountNum, req.body.content, postTime],
        (error, results) => {
            console.log(error);
            res.redirect('/');
        })
    }
);

//投稿内容の削除
app.post('/deletepost', authenticateUser, (req, res) => {
    const postNum = req.body.postNum;
    const redirect = req.body.redirect;
    connection.query(
        `UPDATE post SET deleteFlg = 1 WHERE postNum = ?;`,
        [postNum],
        (error, results) => {
            console.log(results);
            console.log(error);

            if (redirect === "index") {//クリック元ページ判定
                res.redirect('/');
            } else if(redirect === "profile") {
                res.redirect('/profile');
            } else {
                res.redirect('/');
            }
        }
    );
});

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
            `INSERT INTO acount (userId, displayName, email, password, signupDate) VALUES (?, ?, ? ,?, ?)`,
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
            `SELECT * FROM acount WHERE email = ?`,
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
app.post('/good', authenticateUser, (req, res) => {
    const postNum = req.body.postNum;
    const redirect = req.body.redirect;
    const date = new Date();
    const goodDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    connection.query(
        `UPDATE post SET good = good + 1 WHERE post.postNum = ?;`,
        [postNum],
        (error, results) => {
            console.log(results);
            console.log(error);
            connection.query(
                `INSERT INTO good (acountNum, postNum, goodDate) VALUES (?, ?, ?)`,
                [req.session.acountNum, postNum ,goodDate],
                (error, results) => {
                    console.log(results);
                    console.log(error);
                    if (redirect === "index") {//クリック元ページ判定
                        res.redirect('/');
                    } else if(redirect === "profile") {
                        connection.query(
                            `SELECT acount.userId AS acount_userId
                            FROM acount
                            INNER JOIN post ON post.postNum = ? AND acount.acountNum = post.acountNum`,
                            [postNum],
                            (error, results) => {
                                res.redirect('/profile?userid=' + results[0].acount_userId);      
                            }
                        );
                    } else {
                        res.redirect('/');
                    }
                }
            );
        }
    );
});

//GOODキャンセル
app.post('/goodcancel', authenticateUser, (req, res) => {
    const postNum = req.body.postNum;
    const redirect = req.body.redirect;
    const date = new Date();
    const goodDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    connection.query(
        `UPDATE post SET good = good - 1 WHERE post.postNum = ?;`,
        [postNum],
        (error, results) => {
            console.log(results);
            console.log(error);
            connection.query(
                `DELETE FROM good WHERE acountNum = ? AND postNum = ?`,
                [req.session.acountNum, postNum],
                (error, results) => {
                    console.log(results);
                    console.log(error);
                    if (redirect === "index") {//クリック元ページ判定
                        res.redirect('/');
                    } else if(redirect === "profile") {
                        connection.query(
                            `SELECT acount.userId AS acount_userId
                            FROM acount
                            INNER JOIN post ON post.postNum = ? AND acount.acountNum = post.acountNum`,
                            [postNum],
                            (error, results) => {
                                res.redirect('/profile?userid=' + results[0].acount_userId);      
                            }
                        );
                    } else {
                        res.redirect('/');
                    }
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