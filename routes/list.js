const express = require('express')
const router = express.Router();
const { ObjectId } = require("mongodb");

router.get('/page', async (req, res) => {
    const db = req.app.locals.db

    const perPage = 5
    const page = req.params.number
    let result = await db.collection('songs').find().limit(perPage).toArray();
    res.render('page.ejs', { songs: result, isFirstPage: true, user: req.user })
})

router.get('/prev/:id', async (req, res) => {
    const db = req.app.locals.db

    const minSong = await db.collection('songs').find().sort({ _id: 1 }).limit(1).toArray();
    const minId = minSong[0]._id;
    const firstId = new ObjectId(req.params.id);
    const perPage = 5
    let result = await db.collection('songs').find({ _id: { $lt: firstId } }).sort({ _id: -1 }).limit(perPage).toArray()
    result.reverse()
    const isFirstPage = result.length > 0 && firstId.equals(minId);
    res.render('page.ejs', { songs: result, isFirstPage: isFirstPage, user: req.user })
})

router.get('/next/:id', async (req, res) => {
    const db = req.app.locals.db

    const lastId = new ObjectId(req.params.id)
    const perPage = 5
    let result = await db.collection('songs').find({ _id: { $gt: lastId } }).limit(perPage).toArray()
    res.render('page.ejs', { songs: result, isFirstPage: false, user: req.user })
})

router.get('/', async (req, res) => {
    const db = req.app.locals.db

    let result = await db.collection('songs').find().toArray()
    res.render('list.ejs', { songs: result, user: req.user })
})



module.exports = router