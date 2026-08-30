const fs = require('fs');
const path = require('path');

const uploadsDir = "c:/projetos/medv2/uploads";
const analysesPath = "c:/projetos/medv2/data/analyses.json";
const documentsPath = "c:/projetos/medv2/data/documents.json";

function cleanup() {
  console.log("Starting data cleanup...");

  // 1. Clean uploads folder
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted upload file: ${file}`);
      } catch (e) {
        console.error(`Error deleting file ${file}:`, e);
      }
    });
  } else {
    console.log("Uploads directory does not exist.");
  }

  // 2. Overwrite analyses.json to []
  try {
    fs.writeFileSync(analysesPath, JSON.stringify([], null, 2), 'utf8');
    console.log("Overwrote analyses.json with empty array.");
  } catch (e) {
    console.error("Error overwriting analyses.json:", e);
  }

  // 3. Overwrite documents.json to []
  try {
    fs.writeFileSync(documentsPath, JSON.stringify([], null, 2), 'utf8');
    console.log("Overwrote documents.json with empty array.");
  } catch (e) {
    console.error("Error overwriting documents.json:", e);
  }

  console.log("Cleanup complete. Ready for testing from scratch!");
}

cleanup();
