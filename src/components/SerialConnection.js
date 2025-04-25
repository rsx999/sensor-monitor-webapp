// SerialConnection.js
import React, { useState, useEffect } from 'react';

const SerialConnection = ({ onData, onLog }) => {
  const [port, setPort] = useState(null);
  const [reader, setReader] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    return () => disconnect();
  }, []);

  const connect = async () => {
    try {
      const newPort = await navigator.serial.requestPort();
      await newPort.open({ baudRate: 9600 });
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = newPort.readable.pipeTo(textDecoder.writable);
      const newReader = textDecoder.readable.getReader();

      setPort(newPort);
      setReader(newReader);
      setIsConnected(true);
      onLog('✅ Connected to serial port');

      readLoop(newReader);
    } catch (err) {
      console.error('❌ Connection failed:', err);
      onLog(`❌ Connection error: ${err.message}`);
    }
  };

  const disconnect = async () => {
    try {
      if (reader) {
        await reader.cancel();
        await reader.releaseLock();
      }
      if (port) {
        await port.close();
      }
      setReader(null);
      setPort(null);
      setIsConnected(false);
      onLog('🔌 Disconnected from serial port');
    } catch (err) {
      console.error('❌ Disconnection failed:', err);
      onLog(`❌ Disconnection error: ${err.message}`);
    }
  };

  const readLoop = async (reader) => {
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep last incomplete line
          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine) {
              onLog(cleanLine);
              const parts = cleanLine.split(',').map(x => parseFloat(x));
              if (parts.length >= 7 && parts.every(v => !isNaN(v))) {
                const [timestamp, ...values] = parts;
                onData({ formattedTime: (timestamp).toFixed(2), values });
              } else {
                console.warn('⚠️ Malformed line skipped:', cleanLine);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Read loop error:', err);
      onLog(`⚠️ Read error: ${err.message}`);
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <button onClick={isConnected ? disconnect : connect}>
        {isConnected ? '🔌 Disconnect' : '🔗 Connect'}
      </button>
    </div>
  );
};

export default SerialConnection;
