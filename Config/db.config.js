const mongoose = require("mongoose");
const { seedDefaultAdmin } = require("../Services/auth.service");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/pushforge";
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    await seedDefaultAdmin();
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    // Do not call process.exit(1) so server stays up to serve health checks & log errors cleanly
  }
};

module.exports = connectDB;