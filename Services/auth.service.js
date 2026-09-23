const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../Models");

const registerUser = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error("User with this email already exists");
    error.statusCode = 400;
    throw error;
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword
  });

  const token = generateToken(user);
  return { user: formatUserResponse(user), token };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user);
  return { user: formatUserResponse(user), token };
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return formatUserResponse(user);
};

const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET || "supersecretkey_change_me_in_production";
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: "7d" }
  );
};

const formatUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile
};
