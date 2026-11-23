// Punto de entrada del frontend: monta React y conecta la navegación por rutas.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Estilos base primero; el tema del acceso/panel los especializa después.
import './styles.css';
import './portal-theme.css';

// Inserta la aplicación dentro del elemento #root de frontend/index.html.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
