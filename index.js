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

console.log(process.env.DB_USER)
console.log(process.env.DB_PASS)

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
    const allResortDataCollection = db.collection("allResorts");
    const usersCollection = db.collection("users");
    const allBookingsCollection = db.collection("allBookings");

    // Email format validation function
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // ==================== Users Routes ====================
    app.post("/users", async (req, res) => {
      try {
        const { name, email } = req.body;

        if (!name || !email || !isValidEmail(email)) {
          return res.status(400).send("Valid name and email are required");
        }

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).send("User with this email already exists");
        }

        const result = await usersCollection.insertOne(req.body);
        res.status(201).send({
          message: "User successfully added",
          userId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding user data:", error.message);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/users", async (req, res) => {
      const { email } = req.query;

      try {
        if (!email || !isValidEmail(email)) {
          return res.status(400).json({ error: "Valid email is required" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
      } catch (error) {
        console.error("Error fetching user data:", error.message);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/all-users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        console.error("Error fetching all user data:", error.message);
        res.status(500).send("Internal Server Error");
      }
    });

    app.patch("/update-user", async (req, res) => {
      const { email, isAdmin } = req.body;

      try {
        if (!email || typeof isAdmin !== "boolean") {
          return res.status(400).send("Email and isAdmin status are required");
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { isAdmin } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send("User not found or role not updated");
        }

        res.send({ success: true, message: "User role updated successfully" });
      } catch (error) {
        console.error("Error updating user role:", error.message);
        res.status(500).send("Internal Server Error");
      }
    });

    app.patch("/update-user-info", async (req, res) => {
      const { email, age, securityDeposit, idNumber } = req.body;

      try {
        const result = await usersCollection.updateOne(
          { email },
          { $set: { age, securityDeposit, idNumber } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found or information not updated.",
          });
        }

        res.json({
          success: true,
          message: "User information updated successfully.",
        });
      } catch (error) {
        console.error("Error updating user info:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });

    // ==================== Resorts Routes ====================
    app.get("/allResorts", async (req, res) => {
      try {
        const resorts = await allResortDataCollection.find().toArray();
        res.send(resorts);
      } catch (error) {
        console.error("Error fetching all resort data:", error.message);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/resorts", async (req, res) => {
      try {
        const resort = req.body;
        const result = await allResortDataCollection.insertOne(resort);
        res.send(result);
      } catch (error) {
        console.error("Error adding resort data:", error.message);
        res.status(500).send("Internal Server Error");
      }
    });

    // ==================== Bookings Routes ====================
    app.put("/bookings", async (req, res) => {
      try {
        const booking = req.body;

        if (!booking.email || !booking.resortId || !isValidEmail(booking.email)) {
          return res.status(400).json({ message: "Valid email and resortId are required" });
        }

        const filter = { email: booking.email, resortId: booking.resortId };
        const update = { $set: booking };
        const options = { upsert: true };

        const result = await allBookingsCollection.updateOne(filter, update, options);
        res.status(200).json({
          success: true,
          message: result.upsertedCount
            ? "Booking created successfully"
            : "Booking updated successfully",
        });
      } catch (error) {
        console.error("Error creating/updating booking:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get("/bookings", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email || !isValidEmail(email)) {
          return res.status(400).json({ message: "Valid email is required in query" });
        }

        const bookings = await allBookingsCollection.find({ email }).toArray();
        res.status(200).json(bookings);
      } catch (error) {
        console.error("Error fetching bookings by email:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get("/all-bookings", async (req, res) => {
      try {
        const allBookings = await allBookingsCollection.find().toArray();
        res.status(200).json(allBookings);
      } catch (error) {
        console.error("Error fetching all bookings:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await allBookingsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: "Booking not found" });
        }

        res.status(200).json({ success: true, message: "Booking deleted successfully" });
      } catch (error) {
        console.error("Error deleting booking:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
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

// Global error handler (Optional but good for catching unexpected errors)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "Something went wrong!" });
});
