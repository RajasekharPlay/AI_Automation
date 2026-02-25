import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import RunsList from './pages/RunsList.jsx';
import RunDetail from './pages/RunDetail.jsx';
import TestcaseList from './pages/TestcaseList.jsx';
import CreateTest from './pages/CreateTest.jsx';
import CredentialsManager from './pages/CredentialsManager.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Dashboard />} />
        <Route path="/runs"              element={<RunsList />} />
        <Route path="/run/:runId"        element={<RunDetail />} />
        <Route path="/testcases"         element={<TestcaseList />} />
        <Route path="/testcases/create"  element={<CreateTest />} />
        <Route path="/credentials"       element={<CredentialsManager />} />
        {/* Legacy redirect */}
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
