const express = require("express");
const router = express.Router();
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

router.get("/generate-report", async (req, res) => {
  try {
    // Absolute path to script
    const pythonScript = path.resolve(__dirname, "../../../script-report/report-generate.py");

    // Use python inside venv
    const pythonPath = path.resolve(__dirname, "../../../script-report/venv/bin/python3");

    // Folder for final PDF
    const outputFolder = path.resolve(__dirname, "../../../reports/generated");
    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

    // Output PDF full path
    const outputPDF = path.join(outputFolder, "construction_report.pdf");

    console.log("Running report generator:");
    console.log("Python:", pythonPath);
    console.log("Script:", pythonScript);
    console.log("Output:", outputPDF);

    // Spawn Python process
    const child = spawn(pythonPath, [pythonScript, outputPDF], {
      cwd: path.resolve(__dirname, "../../../"), // ensure consistent working directory
      env: process.env,
    });

    child.stdout.on("data", (data) => console.log("[PYTHON]", data.toString()));
    child.stderr.on("data", (data) => console.error("[PYTHON ERR]", data.toString()));

    child.on("close", (code) => {
      console.log("Python exited with code:", code);

      if (code !== 0) {
        return res.status(500).json({ error: "Python script failed" });
      }

      // Download only the final PDF (no images)
      res.download(outputPDF, "construction_report.pdf", (err) => {
        if (err) console.error("Download error:", err);
      });
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
