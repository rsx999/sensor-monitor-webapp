import React, { useEffect, useState } from 'react';
import GraphContainer from './components/GraphContainer';
import SerialConnection from './components/SerialConnection';
import { saveAs } from 'file-saver';

const App = () => {
  const [dataPoints, setDataPoints] = useState([]);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState('🔌 Not connected');
  const [serialSupported, setSerialSupported] = useState(true);

  useEffect(() => {
    if (!('serial' in navigator)) {
      setSerialSupported(false);
      setLog(prev => [...prev, '❌ Web Serial API not supported in this browser. Please use Chrome or Edge.']);
    }
  }, []);

  const handleNewData = (data) => {
    setDataPoints(prev => [...prev, data]);
  };

  const handleLog = (msg) => {
    setLog(prev => [...prev, msg]);
  };

  const handleStatus = (msg) => {
    setStatus(msg);
  };

  const exportToCSV = () => {
    const headers = ['Time (s)', 'Baseline Atm', 'Gauge Pressure', 'Normalized Gauge', 'Tilt Angle', 'Elevation', 'ECG', 'Normalized ECG'];
    const csvContent = [headers.join(',')]
      .concat(dataPoints.map(dp => dp.values ? [dp.formattedTime, ...dp.values].join(',') : null).filter(Boolean))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'sensor_data.csv');
  };

  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif' }}>
      <h1>📈 Real-Time Sensor Monitor</h1>
      {serialSupported ? (
        <>
          <SerialConnection onData={handleNewData} onLog={handleLog} onStatus={handleStatus} />
          <p>{status}</p>
          <button onClick={exportToCSV} style={{ marginBottom: '10px' }}>📤 Export CSV</button>
        </>
      ) : (
        <p style={{ color: 'red' }}>Your browser does not support the Web Serial API. Please use a compatible browser like Chrome.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <GraphContainer dataPoints={dataPoints} />
        </div>
        <div>
          <h2>Serial Monitor</h2>
          <div style={{ background: '#000', color: '#0f0', padding: '10px', height: '600px', overflowY: 'scroll', fontSize: '12px', border: '1px solid #444' }}>
            {log.map((line, index) => <div key={index}>{line}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
