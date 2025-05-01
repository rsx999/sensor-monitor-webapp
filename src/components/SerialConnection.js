import React, { useState, useEffect } from 'react';

const SerialConnection = ({ onData, onLog }) => {
  const [port, setPort] = useState(null);
  const [reader, setReader] = useState(null);
  const [readableStreamClosed, setReadableStreamClosed] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [abortController, setAbortController] = useState(null);

  useEffect(() => {
    return () => disconnect();
  }, []);

  const connect = async () => {
    try {
      const newPort = await navigator.serial.requestPort();
      await newPort.open({ baudRate: 9600 });

      const textDecoder = new TextDecoderStream();
      const readableClosed = newPort.readable.pipeTo(textDecoder.writable);
      const newReader = textDecoder.readable.getReader();

      setPort(newPort);
      setReader(newReader);
      setReadableStreamClosed(readableClosed);
      setAbortController(new AbortController());
      setIsConnected(true);
      onLog('✅ Serial port connected.');

      readLoop(newReader);
    } catch (err) {
      onLog(`❌ Connection error: ${err.message}`);
    }
  };

  const disconnect = async () => {
    onLog('⚠️ Disconnecting...');
    try {
      if (reader) {
        await reader.cancel();
        await reader.releaseLock();
      }

      if (readableStreamClosed) {
        await readableStreamClosed.catch(() => {});
      }

      if (port) {
        await port.close();
      }

      setPort(null);
      setReader(null);
      setReadableStreamClosed(null);
      setIsConnected(false);
      onLog('🔌 Disconnected.');
    } catch (err) {
      onLog(`❌ Disconnect failed: ${err.message}`);
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
          buffer = lines.pop();
          for (let line of lines) {
            const cleanLine = line.trim();
            if (cleanLine) {
              onLog(cleanLine);
              const parts = cleanLine.split(',').map(x => parseFloat(x));
              if (parts.length === 7 && parts.every(x => !isNaN(x))) {
                const [timestamp, ...values] = parts;
                onData({ formattedTime: timestamp.toFixed(2), values });
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onLog(`⚠️ Read loop error: ${err.message}`);
      }
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
