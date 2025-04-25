import React, { useEffect, useState } from 'react';
import GraphContainer from './components/GraphContainer';
import SerialConnection from './components/SerialConnection';
import { saveAs } from 'file-saver';

const App = () => {
  const [dataPoints, setDataPoints] = useState([]);
  const [log, setLog] = useState([]);
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
    console.log(msg);
  };

  const exportToCSV = () => {
    const headers = ['Time (s)', 'Gauge Pressure (Raw)', 'Gauge Pressure (Detrended)', 'Filtered ECG', 'Tilt Angle (°)', 'Baseline Atm', 'Baseline Elevation'];
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
        <SerialConnection onData={handleNewData} onLog={handleLog} />
      ) : (
        <p style={{ color: 'red' }}>Your browser does not support the Web Serial API. Please use a compatible browser like Chrome.</p>
      )}
      <button onClick={exportToCSV} style={{ marginBottom: '10px' }}>📤 Export CSV</button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ flex: 2, minWidth: '1000px' }}>
          <GraphContainer dataPoints={dataPoints} />
        </div>
        <div style={{ flex: 1, minWidth: '300px' }}>
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
