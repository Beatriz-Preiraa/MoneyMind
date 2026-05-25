import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec }      from './config/swagger';
import authRoutes           from './routes/authRoutes';
import transactionRoutes    from './routes/transactionRoutes';
import dashboardRoutes      from './routes/dashboardRoutes';
import categoryRoutes       from './routes/categoryRoutes';
import goalRoutes           from './routes/goalRoutes';
import chatRoutes           from './routes/chatRoutes';
import whatsappRoutes       from './routes/whatsapp';
import { errorHandler }     from './middleware/errorHandler';

dotenv.config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/docs',         swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/categories',   categoryRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/chat',         chatRoutes);
app.use('/api/whatsapp',     whatsappRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor MoneyMind rodando em http://localhost:${PORT}`);
  console.log(`Documentacao em http://localhost:${PORT}/api/docs`);
});

export default app;
