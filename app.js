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

// MYSQL接続情報をプールに変更
const pool = mysql.createPool({
    host: '192.168.100.25',
    user: 'test',
    password: 'test',
    database: 'web_app',
    connectionLimit: 10, // プール内の最大接続数
});
// プールを使ったクエリ関数の作成
const queryDatabase = (query, params) => {
    return new Promise((resolve, reject) => {
        pool.query(query, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
};

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
app.get('/', async (req, res) => {

    if (res.locals.isLoggedIn === true){
        const today = new Date();//現在の時刻と投稿時間との比較のため
        try {
            const results = await queryDatabase(
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
                [req.session.acountNum]
            );
            res.render('index.ejs',{posts: results, recentPost});
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        res.redirect('/login');
    }
});

//プロフィールページ
app.get('/profile', async (req, res) => {
    const userId = req.query.userid;
    if (res.locals.isLoggedIn === true){
        const today = new Date();//現在の時刻と投稿時間との比較のため
        // console.log(todayTime);
        if (userId === undefined) {//ユーザーIDの指定がない場合自分のプロフィールページを表示
            try {
                const profResult = await queryDatabase(
                    `SELECT * FROM acount WHERE acountNum = ?`,
                    [req.session.acountNum]
                );
                const results = await queryDatabase(
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
                    [req.session.acountNum, req.session.acountNum]
                );
                res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: 'myprofile'});
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }

        } else {//URLのユーザーIDのプロフィールページ表示
            try {
                const profResult = await queryDatabase(
                `SELECT * FROM acount WHERE userId = ?`,
                [userId]
                );  
                if (profResult[0].acountNum === req.session.acountNum){//自分のユーザーIDならQUERY無しURLにリダイレクト
                    res.redirect('/profile');
                }
                
                const results = await queryDatabase(
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
                    [userId, req.session.acountNum]
                );
                //対象のアカウントをフォロー中かチェック
                const followResult = await queryDatabase(
                    `SELECT * FROM follow WHERE acountNum = ? AND followAcountNum = ?`,
                    [req.session.acountNum, profResult[0].acountNum]
                );

                if (followResult.length > 0) {//一致するデータがなければまだフォローしていない
                    res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: true});
                } else {
                    res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: false});
                }
            } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
            }
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        res.redirect('/login');
    }
});

//プロフィール編集ページ
app.get('/profeditor', authenticateUser, async (req, res) => {
    if (req.session.acountNum != undefined){
        const results = await queryDatabase(
            `SELECT * FROM acount WHERE acountNum = ?`,
            [req.session.acountNum]
        );

        return res.render('profeditor.ejs', {errors: [], acount: results, editData: results[0].introduction});
        
    } else {
        return res.redirect('/login');
    }
});

//プロフィール編集処理
app.post('/profeditor', authenticateUser, async (req, res) => {
    const { userId, displayName, email, password, password2, introduction } = req.body;
    const errors = [];
    // フォームのエラーチェック
    if (!userId) errors.push('※ユーザーIDは必須です');
    if (!displayName) errors.push('※表示名は必須です');
    if (!email) errors.push('※メールアドレスは必須です');
    if (!password) errors.push('※パスワードは必須です');
    if (password != password2) errors.push('※パスワードをもう一度入力してください');
    
    try {
        //未入力項目がある場合もう再度編集ページへ
        if (errors.length > 0) {
            console.log(errors);
            const results = await queryDatabase(
                `SELECT * FROM acount WHERE acountNum = ?`,
                [req.session.acountNum]
            );
            return res.render('profeditor.ejs', {errors, acount: results, editData: introduction});
        }
        //ユーザーIDの重複チェック
        const useridCheck = await queryDatabase(
            `SELECT * FROM acount WHERE userId = ?`,
            [userId]
        );
        //自分のuserIdを除いたuserIdの重複チェック
        if (useridCheck.length > 0 && useridCheck[0].acountNum != req.session.acountNum){
            errors.push('※ユーザーID['+useridCheck[0].userId+']は既に使われています');
            const results = await queryDatabase(
                `SELECT * FROM acount WHERE acountNum = ?`,
                [req.session.acountNum]
            );
            return res.render('profeditor.ejs', {errors, acount: results, editData: introduction});
        } else {
            const results = await queryDatabase(
                `UPDATE acount SET 
                userId = ?, displayName = ?, email = ?,
                password = ?, introduction = ?
                WHERE acount.acountNum = ?;`,
                [userId, displayName, email, password, introduction, req.session.acountNum]
            );
            return res.redirect('/profile');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

//フォロー機能
app.post('/follow', authenticateUser, async (req, res) => {
    const followId = req.body.followid;
    const date = new Date();
    const followDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    try {
        const results_follow = await queryDatabase(
            `UPDATE acount SET follow = follow + 1 WHERE acount.acountNum = ?;`,
            [req.session.acountNum]
        );
        const results_followers = await queryDatabase(
            `UPDATE acount SET followers = followers + 1 WHERE acount.acountNum = ?;`,
            [followId]
        );
        const results_followR = await queryDatabase(
            `INSERT INTO follow (acountNum, followAcountNum, followDate) VALUES (?, ?, ?)`,
            [req.session.acountNum, followId ,followDate]
        );
        const result = await queryDatabase(
            `SELECT userId FROM acount WHERE acountNum = ?`,
            [followId]
        );
        return res.redirect('/profile?userid='+result[0].userId);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

//フォロー解除機能
app.post('/unfollow', authenticateUser, async (req, res) => {
    const followId = req.body.followid;
    try {
        const results_follow = await queryDatabase(
            `UPDATE acount SET follow = follow - 1 WHERE acount.acountNum = ?;`,
            [req.session.acountNum]
        );            
        const results_followers = await queryDatabase(
            `UPDATE acount SET followers = followers - 1 WHERE acount.acountNum = ?;`,
            [followId]
        );
        const results_followR = await queryDatabase(
            `DELETE FROM follow WHERE acountNum = ? AND followAcountNum = ?`,
            [req.session.acountNum, followId]
        );
        const result = await queryDatabase(
            `SELECT userId FROM acount WHERE acountNum = ?`,
            [followId]
        );
        return res.redirect('/profile?userid='+result[0].userId);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
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
app.post('/createPost', async (req, res) => {
    const date = new Date();
    const postTime = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得
    console.log(postTime);
    try {
        const results = await queryDatabase(
            `INSERT INTO post (acountNum, content, datetime) VALUES (?, ?, ?)`,
            [req.session.acountNum, req.body.content, postTime]
        );
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }   
});

//投稿内容の削除
app.post('/deletepost', authenticateUser, async (req, res) => {
    const postNum = req.body.postNum;
    const redirect = req.body.redirect;
    try {
        const results = await queryDatabase(
            `UPDATE post SET deleteFlg = 1 WHERE postNum = ?;`,
            [postNum]
        );
        if (redirect === "index") {//クリック元ページ判定
            res.redirect('/');
        } else if(redirect === "profile") {
            res.redirect('/profile');
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

//アカウント新規登録ページ
app.get('/signup', (req, res) => {
    res.render('signup.ejs', {errors: []});
});

//アカウント登録処理
app.post('/signup', async (req, res, next) => {
    const { userid, displayName, email, password, agree } = req.body;
    const errors = [];
    // フォームのエラーチェック
    if (!userid) errors.push('※ユーザーIDは必須です');
    if (!displayName) errors.push('※表示名は必須です');
    if (!email) errors.push('※メールアドレスは必須です');
    if (!password) errors.push('※パスワードは必須です');
    if (!agree) errors.push('※利用規約に同意してください');
    if (errors.length > 0) {
        console.log(errors);
        return res.render('signup.ejs', {errors});
    }
    //今後ここでパスワードのハッシュ化を行う
    const date = new Date();
    const signupDate = date.toFormat('YYYYMMDDHH24MISS');//投稿日時取得
    try {
        const results = await queryDatabase(
            `INSERT INTO acount (userId, displayName, email, password, signupDate) VALUES (?, ?, ? ,?, ?)`,
            [userid, displayName, email, password, signupDate]
        );
        req.session.acountNum = results.insertId;
        return res.redirect('/');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

//ログインページ
app.get('/login', (req, res) => {
        res.render('login.ejs', {formErrors: [], loginError: false});
});

//ログイン処理
app.post('/login', async (req, res) => {
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
        try {
            const results = await queryDatabase(
                `SELECT * FROM acount WHERE email = ?`,
                [email]
            );
            console.log(results);
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
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }   
    }
});

//GOOD機能
app.post('/good', authenticateUser, async (req, res) => {
    const postNum = req.body.postNum;
    const redirect = req.body.redirect;
    const date = new Date();
    const goodDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    try {
        const goodPlusResult = await queryDatabase(
            `UPDATE post SET good = good + 1 WHERE post.postNum = ?;`,
            [postNum]
        );
        const goodInsert = await queryDatabase(
            `INSERT INTO good (acountNum, postNum, goodDate) VALUES (?, ?, ?)`,
            [req.session.acountNum, postNum ,goodDate]
        );
        if (redirect === "index") {//クリック元ページ判定
            return res.redirect('/');
        } else if(redirect === "profile") {
            const results = await queryDatabase(
                `SELECT acount.userId AS acount_userId
                FROM acount
                INNER JOIN post ON post.postNum = ? AND acount.acountNum = post.acountNum`,
                [postNum]
            );
            return res.redirect('/profile?userid=' + results[0].acount_userId);
        } else {
            return res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

//GOODキャンセル
app.post('/goodcancel', authenticateUser, async (req, res) => {
    const postNum = req.body.postNum;
    const redirect = req.body.redirect;
    const date = new Date();
    const goodDate = date.toFormat('YYYYMMDDHH24MISS');//GOOD日時取得
    try {
        const goodMinusResult = await queryDatabase(
            `UPDATE post SET good = good - 1 WHERE post.postNum = ?;`,
            [postNum]
        );
        const goodDelete = await queryDatabase(
            `DELETE FROM good WHERE acountNum = ? AND postNum = ?`,
            [req.session.acountNum, postNum]
        );
        if (redirect === "index") {//クリック元ページ判定
            return res.redirect('/');
        } else if(redirect === "profile") {
            const results = await queryDatabase(
                `SELECT acount.userId AS acount_userId
                FROM acount
                INNER JOIN post ON post.postNum = ? AND acount.acountNum = post.acountNum`,
                [postNum]
            );
            return res.redirect('/profile?userid=' + results[0].acount_userId);
        } else {
            return res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
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