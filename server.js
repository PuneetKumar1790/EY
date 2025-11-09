require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const apiRoutes = require("./src/routes/apiRoutes");
const cors = require("cors");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ey-mu.vercel.app",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure directories exist
const dirs = [
  "uploads/tender1",
  "uploads/tender2",
  "uploads/company",
  "summaries/tender1",
  "summaries/tender2",
  "analysis/tender1",
  "analysis/tender2",
];

dirs.forEach((dir) => {
  fs.ensureDirSync(dir);
  console.log(`✓ Ensured directory: ${dir}`);
});

// Routes
app.use("/api", apiRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Tender Eligibility Analyzer API is running",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
