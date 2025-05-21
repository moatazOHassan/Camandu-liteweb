import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ModelerPage from './pages/ModelerPage';
import OperatorPage from './pages/OperatorPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div>
        <nav>
          <ul>
            <li>
              <Link to="/">Modeler</Link>
            </li>
            <li>
              <Link to="/operator">Operator</Link>
            </li>
          </ul>
        </nav>

        <hr />

        <Routes>
          <Route path="/" element={<ModelerPage />} />
          <Route path="/operator" element={<OperatorPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
