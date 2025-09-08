const express = require('express')
const app = express()

let db
require('dotenv').config()
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const { MongoClient } = require('mongodb')

const url = `mongodb+srv://${dbUser}:${dbPass}@cluster0.sx8zk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
new MongoClient(url).connect().then((client) => {
    console.log('DB연결성공')
    db = client.db('music_db')
}).catch((err) => {
    console.log(err)
})

app.set('view engine', 'ejs')
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'))
app.listen(8080, () => {
    console.log('Server is running on port 8080')
})

app.get('/', (req, res) => {
    res.render('home.ejs');
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/about.html')
})

app.get('/list', async (req, res) => {
    let result = await db.collection('songs').find().toArray()
    res.render('list.ejs', { songs: result })
})

app.get('/time', (req, res) => {
    let now = new Date()
    res.render('time.ejs', { time: now })
})

app.get('/add', (req, res) => {
    res.render('addSong.ejs')
})

app.post('/add', async (req, res) => {
    const { artist, name } = req.body;
    await db.collection('songs').insertOne({ artist: artist, name: name });
    let result = await db.collection('songs').find().toArray()
    res.render('list.ejs', { songs: result })
})

