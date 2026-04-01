import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

const HistoricalContext = createContext(null);

export function HistoricalProvider({ children }) {
  const { selectedDevice } = useDevice();
  const [interval, setInterval] = useState('daily');
  const [consumption, setConsumption] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [page, setPage] = useState(1);
  const [rangeData, setRangeData] = useState({ count: 0, data: [] });
  const [rangeFilter, setRangeFilter] = useState({ from: '', to: '' });
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loadingRange, setLoadingRange] = useState(false);

  const loadConsumption = useCallback(async () => {
    if (!selectedDevice) return;
    setLoadingConsumption(true);
    try {
      const res = await api.getConsumption(selectedDevice, interval);
      setConsumption(res.data.entries || []);
    } finally {
      setLoadingConsumption(false);
    }
  }, [selectedDevice, interval]);

  const loadTable = useCallback(async () => {
    if (!selectedDevice) return;
    setLoadingTable(true);
    try {
      const res = await api.getHistorical(selectedDevice, page, 20);
      setTableData(res.data);
    } finally {
      setLoadingTable(false);
    }
  }, [selectedDevice, page]);

  const applyRange = useCallback(async () => {
    if (!selectedDevice || !rangeFilter.from || !rangeFilter.to) return;
    setLoadingRange(true);
    try {
      const res = await api.getRange(
        selectedDevice,
        new Date(rangeFilter.from).toISOString(),
        new Date(rangeFilter.to).toISOString()
      );
      setRangeData(res.data);
    } finally {
      setLoadingRange(false);
    }
  }, [selectedDevice, rangeFilter]);

  useEffect(() => {
    loadConsumption();
  }, [loadConsumption]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    setPage(1);
    setRangeData({ count: 0, data: [] });
  }, [selectedDevice]);

  const value = useMemo(
    () => ({
      interval,
      setInterval,
      consumption,
      tableData,
      page,
      setPage,
      rangeData,
      rangeFilter,
      setRangeFilter,
      applyRange,
      loadingConsumption,
      loadingTable,
      loadingRange
    }),
    [
      interval,
      consumption,
      tableData,
      page,
      rangeData,
      rangeFilter,
      applyRange,
      loadingConsumption,
      loadingTable,
      loadingRange
    ]
  );

  return <HistoricalContext.Provider value={value}>{children}</HistoricalContext.Provider>;
}

export const useHistorical = () => {
  const ctx = useContext(HistoricalContext);
  if (!ctx) throw new Error('useHistorical must be used within HistoricalProvider');
  return ctx;
};
