const express = require('express');
const cors = require('cors');

const app = express();

// Habilitar CORS
app.use(cors());

app.use(express.json());

// Importar las rutas desde rutas.js
const rutas = require('./rutas');

// Configurar las rutas
app.use('/api', rutas);

const port = 8000; // Puedes cambiar el número de puerto si es necesario

app.listen(port, () => {
  console.log(`Servidor Express escuchando en el puerto ${port}`);
});

  