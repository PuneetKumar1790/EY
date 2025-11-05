require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swagger");
const apiRoutes = require("./src/routes/apiRoutes");

const app = express();

// Middleware
app.use(cors());
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

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Tender Eligibility Analyzer API Documentation"
}));

// Routes
app.use("/api", apiRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Tender Eligibility Analyzer API is running
 */
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
  console.log(`📚 Swagger API Docs: http://localhost:${PORT}/api-docs`);
});

module.exports = app;
