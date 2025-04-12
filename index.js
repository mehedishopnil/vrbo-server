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
          imageURL: imageURL || null, // Default to null if no image URL is provided
          createdAt: new Date(), // Add timestamp
          isAdmin: false, // Default role
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

    // getting all users
    app.get('/users', async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.json(users);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
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

    // ========== YEARLY EARNINGS ROUTES ========== //

// Get all yearly earnings (returns array of documents)
app.get('/yearly-earnings', async (req, res) => {
  try {
    const result = await yearlyEarningsCollection.find().sort({ year: 1 }).toArray();
    res.json(result);
  } catch (error) {
    console.error('Error fetching yearly earnings:', error);
    res.status(500).json({ error: 'Error fetching yearly earnings' });
  }
});

// Update specific year's earnings
app.put('/yearly-earnings/:year', async (req, res) => {
  try {
    const year = req.params.year;
    const { amount } = req.body;

    if (!year || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid year or amount' });
    }

    const result = await yearlyEarningsCollection.updateOne(
      { year },
      { $set: { amount } },
      { upsert: true }
    );

    res.json({ 
      message: 'Yearly earnings updated successfully',
      year,
      amount,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedId: result.upsertedId
    });
  } catch (error) {
    console.error('Error updating yearly earnings:', error);
    res.status(500).json({ error: 'Error updating yearly earnings' });
  }
});

// Bulk update yearly earnings
app.put('/yearly-earnings', async (req, res) => {
  try {
    const earningsData = req.body;

    if (!Array.isArray(earningsData)) {
      return res.status(400).json({ error: 'Expected array of earnings data' });
    }

    const bulkOps = earningsData.map(entry => ({
      updateOne: {
        filter: { year: entry.year },
        update: { $set: { amount: entry.amount } },
        upsert: true
      }
    }));

    const result = await yearlyEarningsCollection.bulkWrite(bulkOps);

    res.json({
      message: 'Bulk update successful',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });
  } catch (error) {
    console.error('Error bulk updating yearly earnings:', error);
    res.status(500).json({ error: 'Error bulk updating yearly earnings' });
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


    // Route to fetch hotel list data
    app.get('/hotels-list', async (req, res) => {
      try {
        const result = await AllHotelListCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error('Error fetching hotel list data:', error);
        res.status(500).json({ error: 'Error fetching hotel list data' });
      }
    });

    // Route to insert new hotel list data
    app.post('/hotels-list', async (req, res) => {
      try {
        const newItem = req.body;
        const result = await AllHotelListCollection.insertOne(newItem);
        res.status(201).json(result);
      } catch (error) {
        console.error('Error inserting into hotel list data:', error);
        res.status(500).json({ error: 'Error inserting into hotel list' });
      }
    });

    // Route to fetch earning list data
    app.get('/all-earnings', async (req, res) => {
      try {
        const result = await earningListCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error('Error fetching earning list data:', error);
        res.status(500).json({ error: 'Error fetching earning list data' });
      }
    });

    // Route to insert new earnings data
    app.post('/all-earnings', async (req, res) => {
      try {
        const newItem = req.body;
        const result = await earningListCollection.insertOne(newItem);
        res.status(201).json(result);
      } catch (error) {
        console.error('Error inserting into earning list data:', error);
        res.status(500).json({ error: 'Error inserting into earning list' });
      }
    });

    // Route to handle adding property data
    app.post('/add-property', async (req, res) => {
      try {
        console.log("Received property data:", req.body); // Debugging line

        const { propertyType, location, details } = req.body;

        if (
          !propertyType ||
          !location ||
          !details ||
          !details.name ||
          !details.country ||
          !details.address ||
          !details.city ||
          !details.state ||
          !details.zipCode
        ) {
          return res.status(400).json({ error: 'Invalid property data. Ensure all required fields are provided.' });
        }

        // Insert property data into MongoDB
        const result = await PropertyDataCollection.insertOne(req.body);

        res.status(201).json({ message: 'Property added successfully', insertedId: result.insertedId });
      } catch (error) {
        console.error('Error adding property:', error);
        res.status(500).json({ error: 'Error adding property' });
      }
    });

    // Route to fetch property list data
    app.get('/add-property', async (req, res) => {
      try {
        const result = await PropertyDataCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error('Error fetching property list data:', error);
        res.status(500).json({ error: 'Error fetching property list data' });
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
