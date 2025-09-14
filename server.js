const express = require('express');
const app = express();
const port = 8080;
const cors = require('cors');
app.use(cors());

let db
require('dotenv').config()
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const { MongoClient, ObjectId } = require('mongodb')

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
app.listen(port, () => {
    console.log('Server is running on port 8080')
})
const methodOverride = require('method-override')
app.use(methodOverride('_method'))

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
        res.render('detail.ejs', { song: result })
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
        res.render('updateSong.ejs', { song: item })
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
        res.render('popular.ejs', { songs: result })
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
    res.render('page.ejs', { songs: result, isFirstPage: true })
})

app.get('/list/prev/:id', async (req, res) => {
    const minSong = await db.collection('songs').find().sort({ _id: 1 }).limit(1).toArray();
    const minId = minSong[0]._id;
    const firstId = new ObjectId(req.params.id);
    const perPage = 5
    let result = await db.collection('songs').find({ _id: { $lt: firstId } }).sort({ _id: -1 }).limit(perPage).toArray()
    result.reverse()
    const isFirstPage = result.length > 0 && firstId.equals(minId);
    res.render('page.ejs', { songs: result, isFirstPage: isFirstPage })
})

app.get('/list/next/:id', async (req, res) => {
    const lastId = new ObjectId(req.params.id)
    const perPage = 5
    let result = await db.collection('songs').find({ _id: { $gt: lastId } }).limit(perPage).toArray()
    res.render('page.ejs', { songs: result, isFirstPage: false })
})