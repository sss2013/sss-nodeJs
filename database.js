const { MongoClient } = require('mongodb');

const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const url = `mongodb+srv://${dbUser}:${dbPass}@cluster0.sx8zk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

let connectDB = new MongoClient(url).connect()

module.exports = connectDB