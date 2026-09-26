const mongoose = require("mongoose");
const { seedDefaultAdmin } = require("../Services/auth.service");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/pushforge";
    console.log(`Attempting MongoDB Connection...`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds instead of buffering indefinitely
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    await seedDefaultAdmin();
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
  }
};

module.exports = connectDB;