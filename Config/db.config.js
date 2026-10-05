const mongoose = require("mongoose");
const { seedDefaultAdmin } = require("../Services/auth.service");

const connectDB = async () => {
  try {
    const rawUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/pushforge";
    const sanitizedUri = rawUri.includes("@") ? rawUri.replace(/:([^:@]+)@/, ":****@") : rawUri;
    console.log(`Attempting MongoDB Connection to: ${sanitizedUri}`);

    const conn = await mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    await seedDefaultAdmin();
  } catch (error) {
    console.error(`Database Connection Error (${error.code || error.name}): ${error.message}`);
  }
};

module.exports = connectDB;