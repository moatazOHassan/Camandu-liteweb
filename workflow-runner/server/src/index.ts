import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import modelerRoutes from './routes/modelerRoutes';
import operatorRoutes from './routes/operatorRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is healthy" });
});

app.use('/api/modeler', modelerRoutes);
app.use('/api/operator', operatorRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
