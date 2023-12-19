const express = require("express");
require("dotenv").config();

const app = express();

const cors = require("cors");
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const uri = `mongodb+srv://restaurantUser:LXkkknVgn2WY8Euj@cluster0.dlgosdc.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dlgosdc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();
		const usersCollection = client.db("resturantDb").collection("users");
		const menuCollection = client.db("resturantDb").collection("menu");
		const reviewCollection = client.db("resturantDb").collection("reviews");
		const cartCollection = client.db("resturantDb").collection("carts");

		// users related apis

		app.get("/users", async (req, res) => {
			const result = await usersCollection.find().toArray();
			res.send(result);
		});

		app.post("/users", async (req, res) => {
			const user = req.body;
			console.log(user);
			const query = { email: user.email };
			const existingUser = await usersCollection.findOne(query);
			console.log("existing user", existingUser);
			if (existingUser) {
				return res.send({
					message: "user already exists",
					insertedId: null,
				});
			}
			const result = await usersCollection.insertOne(user);
			res.send(result);
		});

		// update users to admin

		app.patch("/users/admin/:id", async (req, res) => {
			const id = req.params.id;

			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: "admin",
				},
			};

			const result = await usersCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		app.delete("/users/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await usersCollection.deleteOne(query);
			res.send(result);
		});

		// Find Menu

		app.get("/menu", async (req, res) => {
			const result = await menuCollection.find().toArray();
			res.send(result);
		});

		app.get("/reviews", async (req, res) => {
			const result = await reviewCollection.find().toArray();
			res.send(result);
		});

		// cart collection

		app.get("/carts", async (req, res) => {
			const email = req.query.email;

			if (!email) {
				res.send([]);
			}

			const query = { email: email };

			const result = await cartCollection.find(query).toArray();

			res.send(result);
		});

		app.post("/carts", async (req, res) => {
			const item = req.body;
			console.log(item);
			const result = await cartCollection.insertOne(item);
			res.send(result);
		});

		app.delete("/carts/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await cartCollection.deleteOne(query);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("boss is sitting");
});

app.listen(port, () => {
	console.log(`Restaurant server is running on port ${port} `);
});
