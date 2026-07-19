import express from 'express';
import cors from 'cors';

import imagenRoutes from './Routes/imagen.routes.js';

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    proyecto: 'PESCADO API',
    version: '1.0.0'
  });
});

// RUTAS
app.use('/api/imagen', imagenRoutes);
// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'PÁGINA NO ENCONTRADA'
  });
});

export default app;