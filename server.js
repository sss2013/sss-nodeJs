const express = require('express');
const app = express();
const port = 8080;
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
require('dotenv').config();
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const { MongoClient, ObjectId } = require('mongodb');
const url = `mongodb+srv://${dbUser}:${dbPass}@cluster0.sx8zk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
let db

app.use(cors());
app.set('view engine', 'ejs')
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'))
app.listen(port, () => {
    console.log('Server is running on port 8080')
})
app.use(methodOverride('_method'))
app.use(passport.initialize())
app.use(session({
    secret: '암호화에 쓸 비번',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600 * 24 * 7 },
    store: MongoStore.create({
        mongoUrl: url,
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

}))

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


new MongoClient(url).connect().then((client) => {
    console.log('DB connected')
    db = client.db('music_db')
}).catch((err) => {
    console.log(err)
})

app.listen(port, () => {
    console.log('Server is running on port 8080')
})

app.get('/api/hello', async (req, res) => {
    const list = await db.collection('songs').find().toArray();
    const songs = list.map(song => ({
        id: song._id,
        artist: song.artist,
        name: song.name,
    }));
    res.json({ songs });
})

app.get('/', (req, res) => {
    res.render('home.ejs', { user: req.user });
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/about.html')
})

app.get('/list', async (req, res) => {

    let result = await db.collection('songs').find().toArray()
    res.render('list.ejs', { songs: result, user: req.user })
})

app.get('/time', (req, res) => {
    let now = new Date()
    res.render('time.ejs', { time: now, user: req.user })
})

app.get('/add', (req, res) => {
    if (!req.user) {
        return res.status(403).send('login required')
    } else {
        res.render('addSong.ejs', { user: req.user })
    }
})

app.post('/add', async (req, res) => {
    const { artist, name } = req.body;
    if (artist === "" || name === "") {
        return res.status(400).send('Artist and name are required');
    }

    try {
        await db.collection('songs').insertOne({ artist: artist, name: name });
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
        if (result == null) {
            return res.status(404).send('Song not found')
        }
        res.render('detail.ejs', { song: result, user: req.user })
    } catch (e) {
        console.log(e)
        return res.status(400).send('Invalid ID format')
    }
})

app.get('/update/:id', async (req, res) => {
    try {
        console.log(req.params.id)
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

app.get('/list/page', async (req, res) => {
    const perPage = 5
    const page = req.params.number
    let result = await db.collection('songs').find().limit(perPage).toArray();
    res.render('page.ejs', { songs: result, isFirstPage: true, user: req.user })
})

app.get('/list/prev/:id', async (req, res) => {
    const minSong = await db.collection('songs').find().sort({ _id: 1 }).limit(1).toArray();
    const minId = minSong[0]._id;
    const firstId = new ObjectId(req.params.id);
    const perPage = 5
    let result = await db.collection('songs').find({ _id: { $lt: firstId } }).sort({ _id: -1 }).limit(perPage).toArray()
    result.reverse()
    const isFirstPage = result.length > 0 && firstId.equals(minId);
    res.render('page.ejs', { songs: result, isFirstPage: isFirstPage, user: req.user })
})

app.get('/list/next/:id', async (req, res) => {
    const lastId = new ObjectId(req.params.id)
    const perPage = 5
    let result = await db.collection('songs').find({ _id: { $gt: lastId } }).limit(perPage).toArray()
    res.render('page.ejs', { songs: result, isFirstPage: false, user: req.user })
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

app.get('/mypage', (req, res) => {
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