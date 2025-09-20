require('dotenv').config();

const express = require('express');
const app = express();
const port = 8080;
const path = require('path');
const cors = require('cors');
const { MongoClient, ObjectId } = require("mongodb");
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const { S3Client } = require('@aws-sdk/client-s3');
const s3AccessKey = process.env.S3_ACCESSKEY
const s3SecretKey = process.env.S3_SECRETKEY
const s3Bucket = process.env.S3_BUCKET
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const db_url = `mongodb+srv://${dbUser}:${dbPass}@cluster0.sx8zk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey
    }
})

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Bucket,
        key: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, 'images/' + new Date().toString() + ext);
        }
    })
})
let connectDB = require('./database.js');
const { search } = require('./routes/list.js');
require('./routes/list.js');

let db;
connectDB.then((client) => {
    console.log('DB connected')
    db = client.db('music_db')
    app.locals.db = db; // 반드시 할당

    // 미들웨어 등록
    app.use(cors());
    app.set('view engine', 'ejs')
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(__dirname + '/public'))
    app.use(methodOverride('_method'))
    app.use(passport.initialize())

    app.use(session({
        secret: '암호화에 쓸 비번',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 3600 * 24 * 7 },
        store: MongoStore.create({
            mongoUrl: db_url,
            dbName: 'music_db'
        })
    }))
    app.use(passport.session())

    passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
        try {
            let result = await db.collection('users').findOne({ username: 입력한아이디 })
            if (!result) {
                return cb(null, false, { message: 'ユーザー情報が存在しません' })
            }
            if (await bcrypt.compare(입력한비번, result.password)) {
                return cb(null, result)
            } else {
                return cb(null, false, { message: 'パスワードが正しくありません' });
            }
        } catch (err) {
            console.log(err)
            return cb(err)
        }
    }));

    passport.serializeUser((user, done) => {
        process.nextTick(() => {
            done(null, { id: user._id, username: user.username, })
        })
    });

    passport.deserializeUser(async (user, done) => {
        let result = await db.collection('users').findOne({ _id: new ObjectId(user.id) })
        delete result.password
        process.nextTick(() => {
            done(null, result)
        })
    });

    function checkLogin(req, res, next) {
        if (req.user) {
            next()
        } else {
            res.status(400).send('ログインしてください')
        }
    }

    app.use('/list', require('./routes/list.js'))



    app.get('/', (req, res) => {
        res.render('home.ejs', { user: req.user });
    })

    app.get('/about', (req, res) => {
        res.sendFile(__dirname + '/about.html')
    })


    app.get('/time', (req, res) => {
        let now = new Date()
        res.render('time.ejs', { time: now, user: req.user })
    })

    app.get('/add', checkLogin, (req, res) => {
        res.render('addSong.ejs', { user: req.user })
    })

    app.post('/add', upload.single('img1'), async (req, res) => {

        const { artist, name } = req.body;

        const img = req.file.location;

        if (artist === "" || name === "") {
            return res.status(400).send('Artist and name are required');
        }

        try {
            await db.collection('songs').insertOne({ artist: artist, name: name, image: img });
            let result = await db.collection('songs').find().toArray()
            res.redirect('/list');
        } catch (err) {
            console.error(err);
            return res.status(500).send('Error inserting song');
        }

    })

    app.get('/detail/:id', async (req, res) => {
        try {
            let result = await db.collection('songs').findOne({
                _id: new ObjectId(req.params.id)
            })
            let comments = await db.collection('comments').find({
                parentId: new ObjectId(req.params.id)
            }).toArray()
            if (result == null) {
                return res.status(404).send('Song not found')
            }
            res.render('detail.ejs', { song: result, comments: comments, user: req.user })
        } catch (e) {
            console.log(e)
            return res.status(400).send('Invalid ID format')
        }
    })

    app.get('/update/:id', checkLogin, async (req, res) => {
        try {
            let item = await db.collection('songs').findOne({
                _id: new ObjectId(req.params.id)
            })
            if (item == null) {
                return res.status(404).send('Song not found')
            }
            res.render('updateSong.ejs', { song: item, user: req.user })
        } catch (e) {
            console.log(e)
            return res.status(400).send('Invalid ID format')
        }
    })

    app.put('/update', async (req, res) => {

        const { id, artist, name } = req.body;
        if (id === "" || artist === "" || name === "") {
            return res.status(400).send('Artist and name are required');
        }
        try {
            await db.collection('songs').updateOne(
                { _id: new ObjectId(id) },
                { $set: { artist: artist, name: name } }
            );
            res.redirect(`/detail/${id}`);
        } catch (err) {
            console.error(err);
            return res.status(500).send('Error updating song');
        }
    })

    app.put('/like', async (req, res) => {
        const { id } = req.body;
        if (id === "") {
            return res.status(400).send('ID is required');
        }
        try {
            await db.collection('songs').updateOne(
                { _id: new ObjectId(id) },
                { $inc: { like: 1 } }
            );
            res.redirect(`/detail/${id}`);
        } catch (err) {
            console.error(err);
            return res.status(500).send('Error liking song');
        }
    })

    app.get('/popular', async (req, res) => {
        try {
            const result = await db.collection('songs').find(
                { like: { $gte: 2 } }
            ).sort({ like: -1 }).toArray()
            res.render('popular.ejs', { songs: result, user: req.user })
        }
        catch (err) {
            console.log(err)
        }
    })

    app.delete('/delete', async (req, res) => {
        try {
            const { id } = req.body;
            if (id === "") {
                return res.status(400).send('ID is required');
            }
            await db.collection('songs').deleteOne(
                { _id: new ObjectId(id) }
            );
            const result = await db.collection('songs').find().toArray()

            return res.status(200).json({ songs: result });
        } catch (err) {
            console.log(err)
            return res.status(500).send('Error deleting song');
        }
    })

    app.get('/login', (req, res) => {
        res.render('login.ejs', { user: req.user })
    })

    app.post('/login', async (req, res, next) => {
        passport.authenticate('local', (err, user, info) => {
            if (err) return res.status(500).send(err)
            else if (!user) return res.status(400).send(info.message)
            req.login(user, (err) => {
                if (err) return next(err)
                res.redirect('/list')
            })
        })(req, res, next)
    })

    app.get('/mypage', checkLogin, (req, res) => {
        res.render('mypage.ejs', { user: req.user })
    })

    app.get('/register', (req, res) => {
        res.render('register.ejs', { user: req.user })
    })

    app.post('/register', async (req, res) => {
        const { username, password, nickname } = req.body;

        if (username === "" || password === "" || nickname === "") {
            return res.status(400).send('All fields are required');
        }
        try {
            const existingUser = await db.collection('users').findOne({ username: username });
            if (existingUser) {
                return res.status(400).send('Username already exists');
            }
            let hashedPassword = await bcrypt.hash(password, 10);

            await db.collection('users').insertOne({
                username: username,
                password: hashedPassword,
                nickname: nickname
            });
            res.redirect('/login');
        } catch (err) {
            console.error(err);
            return res.status(500).send('Error registering user');
        }
    })

    app.get('/logout', (req, res, next) => {
        req.logout(function (err) {
            if (err) { return next(err); }
            res.redirect('/login');
        });
    });

    app.get('/search/:name', async (req, res) => {
        const name = req.params.name;
        try {
            let searchCondition = [
                {
                    $search: {
                        index: 'name_index',
                        text: { query: name, path: 'name' }
                    }
                },
                { $project: { name: 1 } } // ０なら隠す、１なら見せる
            ]
            // インデックス性能評価
            // const result = await db.collection('songs').find({
            //     $text: { $search: name }
            // }).explain('executionStats')
            const result = await db.collection('songs').aggregate(searchCondition).toArray();
            console.log(result);
            return res.status(200).json({ songs: result, user: req.user })
        } catch (err) {
            return res.status(404).send('曲が存在しません')
        }
    })

    app.post('/commentPost', checkLogin, async (req, res) => {
        const { id, comment, userId, username } = req.body;

        if (id === "" || comment === "" || userId === "" || username === "") {
            return res.status(400).send('ID and comment are required');
        }
        try {
            await db.collection('comments').insertOne({
                parentId: new ObjectId(id),
                comment: comment,
                userId: req.user._id,
                username: req.user.username,
            })
            res.redirect(`/detail/${id}`);
        } catch (err) {
            console.error(err);
            return res.status(500).send('Error posting comment');
        }
    })

    // 서버 시작
    app.listen(port, () => {
        console.log('Server is running on port 8080')
    })
}).catch((err) => {
    console.log(err)
})

