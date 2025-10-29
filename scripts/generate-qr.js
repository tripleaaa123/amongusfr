const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

const tasks = [
  { id: 'task_001', label: 'Throw 3 paper balls into trash', qr_id: 'qr_001', location: 'Cafeteria' },
  { id: 'task_002', label: 'Do 10 pushups', qr_id: 'qr_002', location: 'Gym' },
  { id: 'task_003', label: 'Stack 5 cups', qr_id: 'qr_003', location: 'Kitchen' },
  { id: 'task_004', label: 'Find the hidden key', qr_id: 'qr_004', location: 'Storage' },
  { id: 'task_005', label: 'Water the plant', qr_id: 'qr_005', location: 'Greenhouse' },
  { id: 'task_006', label: 'Take out the trash', qr_id: 'qr_006', location: 'Hallway' },
];

async function generateQRToken(gameId, taskId, qrId) {
  const payload = {
    v: 1,
    gameId,
    taskId,
    qrId,
    nonce: uuidv4(),
    exp: Date.now() + (365 * 24 * 60 * 60 * 1000)
  };

  return jwt.sign(payload, JWT_SECRET);
}

async function generateQRCode(token, outputPath) {
  try {
    await QRCode.toFile(outputPath, token, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    console.log(`QR Code generated: ${outputPath}`);
  } catch (err) {
    console.error('Error generating QR code:', err);
  }
}

async function main() {
  const gameId = process.argv[2] || 'test-game-id';
  const outputDir = path.join(__dirname, '..', 'qr-codes', gameId);

  try {
    await fs.mkdir(outputDir, { recursive: true });

    const htmlContent = [`
<!DOCTYPE html>
<html>
<head>
  <title>Among Us QR Codes - ${gameId}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f0f0f0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .qr-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 30px;
      margin-top: 30px;
    }
    .qr-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .qr-card h2 {
      margin-top: 0;
      color: #333;
      font-size: 24px;
    }
    .location {
      color: #666;
      font-size: 18px;
      margin: 10px 0;
    }
    .task-id {
      color: #999;
      font-size: 14px;
      font-family: monospace;
    }
    .qr-image {
      margin: 20px 0;
    }
    h1 {
      text-align: center;
      color: #333;
    }
    .game-id {
      text-align: center;
      color: #666;
      font-family: monospace;
      margin-bottom: 20px;
    }
    @media print {
      body {
        background: white;
      }
      .qr-card {
        page-break-inside: avoid;
        box-shadow: none;
        border: 1px solid #ddd;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Among Us QR Codes</h1>
    <div class="game-id">Game ID: ${gameId}</div>
    <div class="qr-grid">
`];

    for (const task of tasks) {
      const token = await generateQRToken(gameId, task.id, task.qr_id);
      const qrFilename = `${task.qr_id}.png`;
      const qrPath = path.join(outputDir, qrFilename);

      await generateQRCode(token, qrPath);

      htmlContent.push(`
      <div class="qr-card">
        <h2>${task.label}</h2>
        <div class="location">📍 ${task.location}</div>
        <div class="qr-image">
          <img src="${qrFilename}" alt="${task.label}" width="250" height="250">
        </div>
        <div class="task-id">${task.qr_id}</div>
      </div>
      `);
    }

    htmlContent.push(`
    </div>
  </div>
</body>
</html>
`);

    const htmlPath = path.join(outputDir, 'index.html');
    await fs.writeFile(htmlPath, htmlContent.join(''));
    console.log(`\nHTML file generated: ${htmlPath}`);
    console.log(`\nAll QR codes generated successfully!`);
    console.log(`Open ${htmlPath} in a browser to view and print.`);

  } catch (err) {
    console.error('Error:', err);
  }
}

if (require.main === module) {
  main();
}