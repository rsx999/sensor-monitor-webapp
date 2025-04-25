import React, { useState } from 'react';

const SerialConnection = ({ onData, onLog, onStatus }) => {
  const [port, setPort] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectSerial = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 9600 });
      setPort(selectedPort);
      setIsConnected(true);
      onStatus && onStatus('✅ Serial connected');

      const decoder = new TextDecoderStream();
      const inputDone = selectedPort.readable.pipeTo(decoder.writable);
      const inputStream = decoder.readable.getReader();

      let buffer = '';

      while (true) {
        const { value, done } = await inputStream.read();
        if (done) break;
        if (!value) continue;

        buffer += value;

        let lines = buffer.split('\n');
        buffer = lines.pop(); // incomplete line saved for next read

        for (const line of lines) {
          onLog && onLog(line);

          const clean = line.trim();
          if (!clean) continue;

          const parts = clean.split(',');
          if (parts.length !== 8) continue; // ensure complete format

          const [timestamp, basatm, gauge, normg, tilt, elev, ecg, norm_ecg] = parts.map(parseFloat);
          if (isNaN(timestamp)) continue;

          onData({
            formattedTime: (timestamp ),
            values: [basatm, gauge, normg, tilt, elev, ecg, norm_ecg]
          });
        }
      }
    } catch (error) {
      console.error('Serial connection failed:', error);
      onStatus && onStatus(`❌ Connection error: ${error.message}`);
    }
  };

  const disconnectSerial = async () => {
    if (port) {
      await port.close();
      setPort(null);
      setIsConnected(false);
      onStatus && onStatus('🔌 Serial disconnected');
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      {isConnected ? (
        <button onClick={disconnectSerial}>🔌 Disconnect</button>
      ) : (
        <button onClick={connectSerial}>🔗 Connect</button>
      )}
    </div>
  );
};

export default SerialConnection;
