const express = require("express");
require("dotenv").config();

const app = express();

const cors = require("cors");
const jwt = require("jsonwebtoken");

const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

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
		const paymentCollection = client
			.db("resturantDb")
			.collection("payments");

		// jwt related api
		app.post("/jwt", async (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: "1h",
			});
			res.send({ token });
		});

		const verifyToken = (req, res, next) => {
			// console.log("inside verify token", req.headers.authorization);
			if (!req.headers.authorization) {
				return res.status(401).send({ message: "unauthorized access" });
			}
			const token = req.headers.authorization.split(" ")[1];
			jwt.verify(
				token,
				process.env.ACCESS_TOKEN_SECRET,
				(err, decoded) => {
					if (err) {
						return res
							.status(401)
							.send({ message: "unauthorized access" });
					}
					req.decoded = decoded;
					next();
				}
			);
		};

		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			const isAdmin = user?.role === "admin";
			if (!isAdmin) {
				return res.status(403).send({ message: "forbidden access" });
			}
			next();
		};

		// users related apis

		app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
			const result = await usersCollection.find().toArray();
			res.send(result);
		});

		app.get("/users/admin/:email", verifyToken, async (req, res) => {
			const email = req.params.email;

			if (email !== req.decoded.email) {
				return res.status(403).send({ message: "forbidden access" });
			}

			const query = { email: email };
			const user = await usersCollection.findOne(query);
			let admin = false;
			if (user) {
				admin = user?.role === "admin";
			}
			res.send({ admin });
		});

		app.post("/users", async (req, res) => {
			const user = req.body;
			// console.log(user);
			const query = { email: user.email };
			const existingUser = await usersCollection.findOne(query);
			// console.log("existing user", existingUser);
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
			const result = await menuCollection
				.find()
				.sort({ name: -1 })
				.toArray();
			res.send(result);
		});

		app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
			const newItem = req.body;
			const result = await menuCollection.insertOne(newItem);
			res.send(result);
		});
		app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			// console.log(id);
			const query = { _id: new ObjectId(id) };
			const result = await menuCollection.deleteOne(query);
			// console.log(result);
			res.send(result);
		});

		// reviews collection

		app.get("/reviews", async (req, res) => {
			const result = await reviewCollection.find().toArray();
			res.send(result);
		});

		// cart collection

		app.get("/carts", verifyToken, async (req, res) => {
			const email = req.query.email;

			if (!email) {
				res.send([]);
			}

			const decodedEmail = req.decoded.email;

			// console.log(decodedEmail);

			if (email !== decodedEmail) {
				return res
					.status(403)
					.send({ error: true, message: "unauthorized access" });
			}

			const query = { email: email };

			const result = await cartCollection.find(query).toArray();

			res.send(result);
		});

		app.post("/carts", async (req, res) => {
			const item = req.body;
			// console.log(item);
			const result = await cartCollection.insertOne(item);
			res.send(result);
		});

		app.delete("/carts/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await cartCollection.deleteOne(query);
			res.send(result);
		});

		// payments

		app.post("/create-payment-intent", verifyToken, async (req, res) => {
			const { price } = req.body;

			// console.log(price);
			const amount = parseInt(price * 100);

			// console.log(amount, "amount inside the intent");

			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: "usd",
				payment_method_types: ["card"],
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		app.post("/payments", verifyToken, async (req, res) => {
			const payment = req.body;
			const paymentResult = await paymentCollection.insertOne(payment);

			//  carefully delete each item from the cart
			// console.log("payment info", payment);
			const query = {
				_id: {
					$in: payment.cartItems.map((id) => new ObjectId(id)),
				},
			};

			const deleteResult = await cartCollection.deleteMany(query);

			res.send({ paymentResult, deleteResult });
		});

		// stats or analytics
		app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
			const users = await usersCollection.estimatedDocumentCount();
			const menuItems = await menuCollection.estimatedDocumentCount();
			const orders = await paymentCollection.estimatedDocumentCount();
			const result = await paymentCollection
				.aggregate([
					{
						$group: {
							_id: null,
							totalRevenue: {
								$sum: "$price",
							},
						},
					},
				])
				.toArray();

			const revenue = result.length > 0 ? result[0].totalRevenue : 0;

			res.send({
				users,
				menuItems,
				orders,
				revenue,
			});
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
