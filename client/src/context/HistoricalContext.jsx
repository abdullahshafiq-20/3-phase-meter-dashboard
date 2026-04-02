import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

const HistoricalContext = createContext(null);

export function HistoricalProvider({ children }) {
  const { selectedDevice } = useDevice();
  const prevDeviceRef = useRef(null);
  const cacheRef = useRef({});

  const [chartPreset, setChartPreset] = useState('24h');
  const [tableData, setTableData] = useState(null);
  const [page, setPage] = useState(1);
  const [rangeData, setRangeData] = useState({ count: 0, data: [] });
  const [rangeFilter, setRangeFilter] = useState({ from: '', to: '' });
  const [loadingTable, setLoadingTable] = useState(false);
  const [loadingRange, setLoadingRange] = useState(false);

  useEffect(() => {
    const prev = prevDeviceRef.current;
    if (prev && prev !== selectedDevice) {
      cacheRef.current[prev] = {
        chartPreset,
        tableData,
        page,
        rangeData,
        rangeFilter,
      };
    }

    if (selectedDevice) {
      const c = cacheRef.current[selectedDevice];
      if (c) {
        setChartPreset(c.chartPreset);
        setTableData(c.tableData);
        setPage(c.page);
        setRangeData(c.rangeData);
        setRangeFilter(c.rangeFilter);
      } else {
        setChartPreset('24h');
        setTableData(null);
        setPage(1);
        setRangeData({ count: 0, data: [] });
        setRangeFilter({ from: '', to: '' });
      }
    }

    prevDeviceRef.current = selectedDevice;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice]);

  useEffect(() => {
    if (!selectedDevice) return;
    cacheRef.current[selectedDevice] = {
      chartPreset,
      tableData,
      page,
      rangeData,
      rangeFilter,
    };
  }, [selectedDevice, chartPreset, tableData, page, rangeData, rangeFilter]);

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
    if (!selectedDevice) return;
    loadTable();
  }, [loadTable]);

  const value = useMemo(
    () => ({
      chartPreset,
      setChartPreset,
      tableData,
      page,
      setPage,
      rangeData,
      rangeFilter,
      setRangeFilter,
      applyRange,
      loadingTable,
      loadingRange,
    }),
    [chartPreset, tableData, page, rangeData, rangeFilter, applyRange, loadingTable, loadingRange]
  );

  return <HistoricalContext.Provider value={value}>{children}</HistoricalContext.Provider>;
}

export const useHistorical = () => {
  const ctx = useContext(HistoricalContext);
  if (!ctx) throw new Error('useHistorical must be used within HistoricalProvider');
  return ctx;
};
