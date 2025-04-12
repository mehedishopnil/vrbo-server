const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Validate environment variables
if (!process.env.DB_PASS) {
  console.error("DB_PASS environment variable is missing.");
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan("combined"));

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jmsycr3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("vrboDB");
    const AllResortsCollection = db.collection("allResorts");
    const usersCollection = db.collection("users");
    const AllHotelListCollection = db.collection("hotelList");
    const earningListCollection = db.collection("earningList");
    const yearlyEarningsCollection = db.collection("yearlyEarnings");
    const PropertyDataCollection = db.collection("propertyData");
    const userInfoDataCollection = db.collection("userInfo");

    // ========== USER MANAGEMENT ROUTES ========== //

    // Get all users
    app.get('/users', async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
      }
    });

    // Update user by ID
    app.put('/users/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        const updateData = req.body;

        if (!ObjectId.isValid(userId)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully' });
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error updating user' });
      }
    });

    // Delete user by ID
    app.delete('/users/:id', async (req, res) => {
      try {
        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error deleting user' });
      }
    });

    // ========== YEARLY EARNINGS ROUTES ========== //

    // Get yearly earnings
    app.get('/yearly-earnings', async (req, res) => {
      try {
        const result = await yearlyEarningsCollection.findOne({});
        res.json(result || {});
      } catch (error) {
        console.error('Error fetching yearly earnings:', error);
        res.status(500).json({ error: 'Error fetching yearly earnings' });
      }
    });

    
    // Update yearly earnings
    app.put('/yearly-earnings', async (req, res) => {
      try {
        const earningsData = req.body;

        // Validate the earnings data structure
        if (!earningsData || typeof earningsData !== 'object') {
          return res.status(400).json({ error: 'Invalid earnings data' });
        }

        // Upsert the yearly earnings document
        const result = await yearlyEarningsCollection.updateOne(
          {},
          { $set: earningsData },
          { upsert: true }
        );

        res.json({ 
          message: 'Yearly earnings updated successfully',
          updated: result.modifiedCount,
          upserted: result.upsertedCount
        });
      } catch (error) {
        console.error('Error updating yearly earnings:', error);
        res.status(500).json({ error: 'Error updating yearly earnings' });
      }
    });

    // ========== EXISTING ROUTES (KEPT FOR BACKWARD COMPATIBILITY) ========== //

    // Route to fetch hotel data
    app.get('/hotel-data', async (req, res) => {
      try {
        const result = await AllResortsCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error('Error fetching hotel data:', error);
        res.status(500).json({ error: 'Error fetching hotel data' });
      }
    });

    // Route to fetch userInfo data
    app.get('/userInfo', async (req, res) => {
      try {
        const result = await userInfoDataCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error('Error fetching userInfo data:', error);
        res.status(500).json({ error: 'Error fetching userInfo data' });
      }
    });

    // Route to handle user registration and Google login
    app.post('/users', async (req, res) => {
      try {
        const { uid, name, email, imageURL } = req.body;

        // Validate required fields
        if (!uid || !name || !email) {
          return res.status(400).json({ error: 'Missing required fields (uid, name, email)' });
        }

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(200).json({ message: 'User already exists', user: existingUser });
        }

        // Create new user document
        const newUser = {
          uid,
          name,
          email,
          imageURL: imageURL || null,
          createdAt: new Date(),
          isAdmin: false,
          lastLogin: new Date()
        };

        // Insert new user into the database
        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({ message: 'User created successfully', user: newUser });
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
      }
    });

    // Route to fetch a specific user by email
    app.get('/users/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const user = await usersCollection.findOne(query);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
      } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Error fetching user' });
      }
    });

    // Route to update user role (e.g., make admin)
    app.patch('/users/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        const { isAdmin } = req.body;

        if (typeof isAdmin !== 'boolean') {
          return res.status(400).json({ error: 'Invalid role data' });
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { isAdmin } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User role updated successfully' });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Error updating user role' });
      }
    });

    // Health check route
    app.get("/", (req, res) => {
      res.send("Vrbo server is running");
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
}

run().catch(console.dir);

// Gracefully close the MongoDB connection on process termination
process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed.");
  process.exit();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "Something went wrong!" });
});