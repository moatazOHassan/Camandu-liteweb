import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Define the directory for storing BPMN diagrams.
// Assuming 'dist' is the output directory for compiled JS files (from tsconfig.json's outDir)
// and this routes file will be in 'dist/routes/', so we go up two levels to project root, then to 'data/diagrams'.
const diagramsDir = path.join(__dirname, '..', '..', 'data', 'diagrams');

// Ensure the diagrams directory exists when the module is loaded or on first use.
// It's good practice to ensure it before any route handler that needs it.
if (!fs.existsSync(diagramsDir)) {
  fs.mkdirSync(diagramsDir, { recursive: true });
}

interface DiagramMetadata {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
}

// In-memory array to store diagram metadata.
// In a production app, this would be a database or a manifest file.
let diagramsMetadata: DiagramMetadata[] = [];

// POST /diagrams - Create a new BPMN diagram
router.post('/diagrams', (req: Request, res: Response) => {
  const { name = 'Untitled Diagram', xml } = req.body;

  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ message: 'BPMN XML content (xml) is required in the request body.' });
  }

  const id = uuidv4();
  const filename = `${id}.bpmn`; // Store files by ID for easy lookup
  const filepath = path.join(diagramsDir, filename);
  const createdAt = new Date().toISOString();

  try {
    // Ensure directory exists (it should due to the check above, but good for safety)
    fs.mkdirSync(diagramsDir, { recursive: true });
    
    fs.writeFileSync(filepath, xml, 'utf8');

    const newDiagram: DiagramMetadata = { id, name, filename, createdAt };
    diagramsMetadata.push(newDiagram);
    
    // Optional: Sort diagrams by creation date or name if needed
    diagramsMetadata.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(201).json(newDiagram);
  } catch (error) {
    console.error('Error saving diagram:', error);
    res.status(500).json({ message: 'Failed to save diagram.' });
  }
});

// GET /diagrams - List all BPMN diagrams
router.get('/diagrams', (_req: Request, res: Response) => {
  // For now, just returns the in-memory list.
  // If implementing a file-based manifest or reading directly from dir, logic would go here.
  res.status(200).json(diagramsMetadata);
});

// GET /diagrams/:id - Retrieve a specific BPMN diagram by ID
router.get('/diagrams/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const diagram = diagramsMetadata.find(d => d.id === id);

  if (!diagram) {
    return res.status(404).json({ message: 'Diagram not found.' });
  }

  const filepath = path.join(diagramsDir, diagram.filename);

  try {
    if (fs.existsSync(filepath)) {
      const xmlContent = fs.readFileSync(filepath, 'utf8');
      res.setHeader('Content-Type', 'application/xml'); // Or 'text/xml'
      res.status(200).send(xmlContent);
    } else {
      // This case might happen if the file was manually deleted but metadata still exists
      console.error(`File not found for diagram ID: ${id}, filename: ${diagram.filename}`);
      // Clean up stale metadata
      diagramsMetadata = diagramsMetadata.filter(d => d.id !== id);
      res.status(404).json({ message: 'Diagram file not found, metadata cleaned.' });
    }
  } catch (error) {
    console.error('Error retrieving diagram:', error);
    res.status(500).json({ message: 'Failed to retrieve diagram.' });
  }
});

export default router;
