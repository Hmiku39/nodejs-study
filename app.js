const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const app = express();
const { recentPost } = require('./recentpost');//投稿日時と現在の時刻の差分計算

// プロフィール画像用アップロード設定
//ファイル名をランダム化処理追加
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/profimages'));
    },
    filename: (req, file, cb) => {
        const randomName = crypto.randomBytes(16).toString('hex'); // ランダムな16進文字列
        const ext = path.extname(file.originalname); // 拡張子を保持
        cb(null, `${randomName}${ext}`);
    }
});

//画像ファイルのみアップロード受け付け
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Only images are allowed'), false);
    }
    cb(null, true);
};

const profileUpload = multer({ 
    storage: profileStorage,
    fileFilter,
});

// 文章投稿用画像アップロード設定
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/postimages')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const postUpload = multer({ storage: postStorage });

// 静的ファイルを提供
app.use('/public', express.static(path.join(__dirname, 'public')));

// 自己署名証明書の読み込み
const options = {
    key: fs.readFileSync('./privateKey.pem'), // 秘密鍵
    cert: fs.readFileSync('./certificate.pem') // 証明書
};

// HTTPSサーバーを起動
https.createServer(options, app).listen(8443, () => {
    console.log('HTTPS server running on port 8443');
});

//時刻取得
require('date-utils');

//publicディレクトリのデータを読めるようにするやつ
app.use(express.static('public'));
//フォームの値を受け取れるようにしたやつ
app.use(express.urlencoded({extended: false}));

// MYSQL接続情報をプールに変更
const pool = mysql.createPool({
    host: '192.168.10.7',
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

            // const results = await queryDatabase(//フォロー関係無しに全投稿内容を表示
            //     `SELECT post.postNum AS post_postNum,
            //     post.acountNum AS post_acountNum,
            //     post.content AS post_content,
            //     post.datetime AS post_datetime,
            //     post.good AS post_good,      
            //     acount.acountNum AS acount_acountNum,
            //     acount.userId AS acount_userId,
            //     acount.displayName AS acount_displayName,
            //     acount.profImage AS acount_profImage,
            //     good.postNum AS good_postNum,
            //     good.acountNum AS good_acountNum
            //     FROM post 
            //     INNER JOIN acount ON post.acountNum = acount.acountNum AND deleteFlg = "0"
            //     LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
            //     ORDER BY datetime DESC`,
            //     [req.session.acountNum]
            // );
            const results = await queryDatabase(//自身の投稿とフォロー済みユーザーの投稿内容を表示
                `SELECT post.postNum AS post_postNum,
                post.acountNum AS post_acountNum,
                post.content AS post_content,
                post.datetime AS post_datetime,
                post.good AS post_good,      
                acount.acountNum AS acount_acountNum,
                acount.userId AS acount_userId,
                acount.displayName AS acount_displayName,
                acount.profImage AS acount_profImage,
                good.postNum AS good_postNum,
                good.acountNum AS good_acountNum,
                follow.acountNum AS follow_acountNum,
                follow.followAcountNum AS follow_followAcountNum
                FROM post
                JOIN acount ON post.acountNum = acount.acountNum
                LEFT JOIN follow ON follow.followAcountNum = post.acountNum AND follow.acountNum = ?
                LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
                WHERE  (post.acountNum = ? OR follow.acountNum = ?) AND post.deleteFlg = 0
                ORDER BY post.datetime DESC`,
                [req.session.acountNum, req.session.acountNum, req.session.acountNum, req.session.acountNum]
            );
            return res.render('index.ejs',{posts: results, recentPost});
        } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        return res.redirect('/login');
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
                return res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: 'myprofile'});
            } catch (error) {
                console.error(error);
                return res.status(500).send('Internal Server Error');
            }

        } else {//URLのユーザーIDのプロフィールページ表示
            try {
                const profResult = await queryDatabase(
                `SELECT * FROM acount WHERE userId = ?`,
                [userId]
                );  
                if (profResult[0].acountNum === req.session.acountNum){//自分のユーザーIDならQUERY無しURLにリダイレクト
                    return res.redirect('/profile');
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
                    return res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: true});
                } else {
                    return res.render('profile.ejs',{posts: results, prof: profResult, recentPost, followStatus: false});
                }
            } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
            }
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        return res.redirect('/login');
    }
});

//フォロー中ユーザーの表示
app.get('/follow', async (req, res) => {
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
                    `SELECT     
                    acount.acountNum AS acount_acountNum,
                    acount.userId AS acount_userId,
                    acount.displayName AS acount_displayName,
                    acount.introduction AS acount_introduction,
                    acount.profImage AS acount_profImage,
                    follow.acountNum As follow_acountNum,
                    follow.followAcountNum AS follow_followAcountNum
                    FROM follow
                    JOIN acount ON
                    follow.followAcountNum = acount.acountNum 
                    WHERE follow.acountNum = ?
                    ORDER BY follow.followDate DESC`,
                    [req.session.acountNum]
                );
                return res.render('follow.ejs',{users: results, prof: profResult, recentPost, followStatus: 'myprofile', whichpage: 'follow'});
            } catch (error) {
                console.error(error);
                return res.status(500).send('Internal Server Error');
            }

        } else {//URLのユーザーIDのプロフィールページ表示
            try {
                const profResult = await queryDatabase(
                `SELECT * FROM acount WHERE userId = ?`,
                [userId]
                );  
                if (profResult[0].acountNum === req.session.acountNum){//自分のユーザーIDならQUERY無しURLにリダイレクト
                    return res.redirect('/follow');
                }
                
                const results = await queryDatabase(
                    `SELECT     
                    acount.acountNum AS acount_acountNum,
                    acount.userId AS acount_userId,
                    acount.displayName AS acount_displayName,
                    acount.introduction AS acount_introduction,
                    acount.profImage AS acount_profImage,
                    follow.acountNum AS follow_acountNum,
                    follow.followAcountNum AS follow_followAcountNum,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 
                            FROM follow AS f_check
                            WHERE f_check.acountNum = ? AND f_check.followAcountNum = acount.acountNum
                        ) THEN 'following'
                        ELSE 'notfollow'
                    END AS followStatus
                    FROM follow
                    JOIN acount ON
                    follow.followAcountNum = acount.acountNum 
                    WHERE follow.acountNum = (
                    SELECT acountNum 
                    FROM acount WHERE userId = ?)
                    ORDER BY follow.followDate DESC`,
                    [req.session.acountNum, userId]
                );
                //対象のアカウントをフォロー中かチェック
                const followResult = await queryDatabase(
                    `SELECT * FROM follow WHERE acountNum = ? AND followAcountNum = ?`,
                    [req.session.acountNum, profResult[0].acountNum]
                );

                if (followResult.length > 0) {//一致するデータがなければまだフォローしていない
                    return res.render('follow.ejs',{users: results, prof: profResult, recentPost, followStatus: true, whichpage: 'follow'});
                } else {
                    return res.render('follow.ejs',{users: results, prof: profResult, recentPost, followStatus: false, whichpage: 'follow'});
                }
            } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
            }
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        return res.redirect('/login');
    }
});

//フォロワーユーザの表示
app.get('/followers', async (req, res) => {
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
                    `SELECT     
                    acount.acountNum AS acount_acountNum,
                    acount.userId AS acount_userId,
                    acount.displayName AS acount_displayName,
                    acount.introduction AS acount_introduction,
                    acount.profImage AS acount_profImage,
                    follow.acountNum As follow_acountNum,
                    follow.followAcountNum AS follow_followAcountNum
                    FROM follow
                    JOIN acount ON
                    follow.acountNum = acount.acountNum 
                    WHERE follow.followAcountNum = ?
                    ORDER BY follow.followDate DESC`,
                    [req.session.acountNum]
                );
                return res.render('follow.ejs',{users: results, prof: profResult, recentPost, followStatus: 'myprofile', whichpage: 'followers'});
            } catch (error) {
                console.error(error);
                return res.status(500).send('Internal Server Error');
            }

        } else {//URLのユーザーIDのプロフィールページ表示
            try {
                const profResult = await queryDatabase(
                `SELECT * FROM acount WHERE userId = ?`,
                [userId]
                );  
                if (profResult[0].acountNum === req.session.acountNum){//自分のユーザーIDならQUERY無しURLにリダイレクト
                    return res.redirect('/followers');
                }
                
                const results = await queryDatabase(
                    `SELECT     
                    acount.acountNum AS acount_acountNum,
                    acount.userId AS acount_userId,
                    acount.displayName AS acount_displayName,
                    acount.introduction AS acount_introduction,
                    acount.profImage AS acount_profImage,
                    follow.acountNum AS follow_acountNum,
                    follow.followAcountNum AS follow_followAcountNum,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 
                            FROM follow AS f_check
                            WHERE f_check.acountNum = ? AND f_check.followAcountNum = acount.acountNum
                        ) THEN 'following'
                        ELSE 'notfollow'
                    END AS followStatus
                    FROM follow
                    JOIN acount ON
                    follow.acountNum = acount.acountNum 
                    WHERE follow.followAcountNum = (
                    SELECT acountNum 
                    FROM acount WHERE userId = ?)
                    ORDER BY follow.followDate DESC`,
                    [req.session.acountNum, userId]
                );
                //対象のアカウントをフォロー中かチェック
                const followResult = await queryDatabase(
                    `SELECT * FROM follow WHERE acountNum = ? AND followAcountNum = ?`,
                    [req.session.acountNum, profResult[0].acountNum]
                );

                if (followResult.length > 0) {//一致するデータがなければまだフォローしていない
                    return res.render('follow.ejs',{users: results, prof: profResult, recentPost, followStatus: true, whichpage: 'followers'});
                } else {
                    return res.render('follow.ejs',{users: results, prof: profResult, recentPost, followStatus: false, whichpage: 'followers'});
                }
            } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
            }
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        return res.redirect('/login');
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
app.post('/profeditor', profileUpload.single('image'), authenticateUser, async (req, res) => {
    const { defaultImage, userId, displayName, email, password, password2, introduction } = req.body;
    const file = req.file;
    let filename = defaultImage;
    const errors = [];
    // フォームの未入力チェック
    if (!userId) errors.push('※ユーザーIDは必須です');
    if (!displayName) errors.push('※表示名は必須です');
    if (!email) errors.push('※メールアドレスは必須です');
    if (!password) errors.push('※パスワードは必須です');
    if (password != password2) errors.push('※パスワードをもう一度入力してください');
    if (!file) {
        filename = defaultImage;
        console.log(filename);
    } else {
        filename = req.file.filename;
        console.log(filename);
    }
    
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
        } else {//userId重複なし、すべてのチェックを終え、以下から更新処理に
            const results = await queryDatabase(
                `UPDATE acount SET 
                userId = ?, displayName = ?, email = ?,
                password = ?, introduction = ?,
                profImage = ?
                WHERE acount.acountNum = ?;`,
                [userId, displayName, email, password, introduction, filename, req.session.acountNum]
            );
            return res.redirect('/profile');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
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
        return res.status(500).send('Internal Server Error');
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
        return res.status(500).send('Internal Server Error');
    }
});

//投稿ページ
app.get('/post', (req, res) => {
    if (req.session.acountNum === undefined){
        return res.redirect('/login');
    } else {
        return res.render('post.ejs');
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
        return res.redirect('/');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
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
            return res.redirect('/');
        } else if(redirect === "profile") {
            return res.redirect('/profile');
        } else {
            return res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

//アカウント新規登録ページ
app.get('/signup', (req, res) => {
    return res.render('signup.ejs', {errors: []});
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
        return res.render('login.ejs', {formErrors: [], loginError: false});
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
        return res.render('login.ejs', {formErrors: formErrors, loginError: loginError});
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
                    return res.redirect('/');
                } else {
                    return res.render('login.ejs', {formErrors: formErrors, loginError: true});
                }
            } else {
                return res.render('login.ejs', {formErrors: formErrors, loginError: true});
            }
        } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
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

//検索ページ
app.get('/search', async (req, res) => {
    const keyword = req.query.keyword;
    if (res.locals.isLoggedIn === true){
        const today = new Date();//現在の時刻と投稿時間との比較のため
        // console.log(todayTime);
        if (keyword === undefined) {//検索キーワードが空白のとき
            try {
                const results = [];
                return res.render('search.ejs', {posts: results, recentPost, keyword: "", dataLength: ""});
            } catch (error) {
                console.error(error);
                return res.status(500).send('Internal Server Error');
            }

        } else {//URLのkeywordの検索結果
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
                    acount.profImage AS acount_profImage,
                    good.postNum AS good_postNum,
                    good.acountNum AS good_acountNum
                    FROM post
                    INNER JOIN acount ON post.acountNum = acount.acountNum AND post.deleteFlg = "0"
                    LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
                    WHERE post.content LIKE CONCAT('%', ?, '%')
                    ORDER BY post.datetime DESC`,
                    [req.session.acountNum, keyword]
                );
                const dataLength = results.length;
                // console.log(dataLength);
                //ポスト内容、検索キーワード、検索ヒット数を送ります。
                return res.render('search.ejs', {posts: results, recentPost, keyword: keyword, dataLength: dataLength});
            } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
            }
        }
    } else {
        // res.render('login.ejs', {formErrors: [], loginError: false});
        return res.redirect('/login');
    }
});

//ポスト内容詳細ページ
app.get('/detail', async (req, res) => {
    const postNum = req.query.postid;
    if (res.locals.isLoggedIn === true) {
        if (postNum === undefined) {//ポスト番号（postid）が空のときトップページに飛ばす
            try {
                const results = [];
                return res.redirect('/');
            } catch (error) {
                console.error(error);
                return res.status(500).send('Internal Server Error');
            }
        } else {
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
                    acount.profImage AS acount_profImage,
                    good.postNum AS good_postNum,
                    good.acountNum AS good_acountNum
                    FROM post
                    INNER JOIN acount ON post.acountNum = acount.acountNum AND post.deleteFlg = "0"
                    LEFT OUTER JOIN good ON good.acountNum = ? AND post.postNum = good.postNum
                    WHERE post.postNum = ?
                    ORDER BY post.datetime DESC`,
                    [req.session.acountNum, postNum]
                );
                // console.log(dataLength);
                //ポスト内容、検索キーワード、検索ヒット数を送ります。
                return res.render('detail.ejs', {posts: results, recentPost});
            } catch (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
            }
        }
    } else {
        return res.redirect('/login');
    }
});

app.get('/test', (req, res) => {
    return res.render('test.ejs');
});

//ログアウト
app.get('/logout', (req, res) => {
    req.session.destroy((error)  => {
        return res.redirect('/');
    });
});

// app.listen(3000);