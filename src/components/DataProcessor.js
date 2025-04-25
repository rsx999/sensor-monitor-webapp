import { useEffect } from 'react';

const DataProcessor = ({ rawData, onProcessedData, onStatusChange }) => {
  useEffect(() => {
    if (!rawData) return;
    const { ts, atm, water, tilt, elev } = rawData;
    const point = { time: ts, atm, water, tilt, elev };
    onProcessedData(point);
    onStatusChange(
      `Processed → t=${ts}, atm=${atm.toFixed(2)}, water=${water.toFixed(2)}, tilt=${tilt.toFixed(1)}, elev=${elev.toFixed(1)}`
    );
  }, [rawData, onProcessedData, onStatusChange]);

  return null;
};

export default DataProcessor;

