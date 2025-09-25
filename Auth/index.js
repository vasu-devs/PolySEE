require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.error("Mongo error", err));

app.use("/auth", authRoutes); // /auth/register, /auth/login, /auth/me
app.use("/api/user", userRoutes); // protected user routes (recent chats etc.)

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Express listening on", PORT));
