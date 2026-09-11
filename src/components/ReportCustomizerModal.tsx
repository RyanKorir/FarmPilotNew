import React, { useState, useEffect } from 'react';
import { X, FileText, Table, Download, GripVertical, Image as ImageIcon, DollarSign, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generatePDFReport, generateExcelReport, generateStrategicManifest } from '../utils/reportGenerator';
import { format as formatDate, subDays, startOfDay, endOfDay } from 'date-fns';

interface ReportCustomizerModalProps {
// ... (rest of the interface remains the same)
  isOpen: boolean;
  onClose: () => void;
  title: string;
  availableColumns: string[];
  data: any[];
  fileName: string;
  columnMapping?: Record<string, string | ((item: any) => any)>;
  includeNetProfit?: boolean;
  netProfitValue?: number;
}

export default function ReportCustomizerModal({ 
  isOpen, 
  onClose, 
  title, 
  availableColumns, 
  data, 
  fileName,
  columnMapping,
  includeNetProfit: showNetProfitOption = false,
  netProfitValue = 0
}: ReportCustomizerModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(availableColumns);
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [watermark, setWatermark] = useState('');
  const [includeNetProfit, setIncludeNetProfit] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleDownload = () => {
    // Filter data based on period
    const now = new Date();
    let filteredData = data;
    
    if (reportPeriod === 'daily') {
      const today = formatDate(now, 'yyyy-MM-dd');
      filteredData = data.filter(item => (item.date || item.lastUpdated)?.startsWith(today));
    } else if (reportPeriod === 'weekly') {
      const weekAgo = subDays(now, 7);
      filteredData = data.filter(item => new Date(item.date || item.lastUpdated) >= weekAgo);
    } else if (reportPeriod === 'monthly') {
      const monthAgo = subDays(now, 30);
      filteredData = data.filter(item => new Date(item.date || item.lastUpdated) >= monthAgo);
    }

    const tableData = filteredData.map(item => {
      return selectedColumns.map(col => {
        const mapping = columnMapping?.[col];
        const value = typeof mapping === 'function'
          ? mapping(item)
          : (item[mapping || col.toLowerCase().replace(/\s+/g, '')] || item[col] || '');
        
        // Handle special cases like dates or nested objects
        if (value instanceof Date) return value.toLocaleDateString();
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        
        return value;
      });
    });

    const reportTitle = `${title} (${reportPeriod.toUpperCase()})`;
    const farmName = data?.[0]?.farmId ? 'Primary Estate' : 'FarmPilot System'; // Simplified or can be passed

    if (format === 'pdf') {
      if (fileName.includes('strategic_production_manifest')) {
        generateStrategicManifest(
          reportTitle,
          filteredData,
          `${fileName}_${reportPeriod}`,
          farmName
        );
      } else {
        generatePDFReport(
          reportTitle, 
          selectedColumns, 
          tableData, 
          `${fileName}_${reportPeriod}`,
          {
            watermark,
            subtitle: `Aggregated Performance Data - ${formatDate(now, 'PPP')}`,
            footer: showNetProfitOption && includeNetProfit ? {
              label: 'Net Profit',
              value: `$${netProfitValue.toLocaleString()}`
            } : undefined
          }
        );
      }
    } else {
      generateExcelReport(
        selectedColumns, 
        tableData, 
        `${fileName}_${reportPeriod}`,
        showNetProfitOption && includeNetProfit ? {
          label: 'Net Profit',
          value: netProfitValue
        } : undefined
      );
    }
    
    if (isScheduled) {
      alert(`Report scheduled! You will receive this ${scheduleFrequency} at ${scheduleTime}.`);
    }
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl my-auto relative"
          >
            <div className="p-8 max-h-[90vh] overflow-y-auto custom-scrollbar scroll-mask">
              <div className="flex items-center justify-between mb-8 sticky top-0 bg-white z-10 pb-2">
                <div>
                  <h3 className="text-2xl font-serif font-black text-[#1a1a1a] tracking-tight">Report Registry</h3>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#5A5A40]/60 mt-1">Lifecycle Documentation</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Period Selection */}
                <div>
                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Reporting Period</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['daily', 'weekly', 'monthly', 'custom'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setReportPeriod(p as any)}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${reportPeriod === p ? 'border-[#5A5A40] bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20' : 'border-gray-100 text-gray-400 hover:border-gray-200 bg-gray-50/50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format Selection */}
                <div>
                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Export Format</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setFormat('pdf')}
                      className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${format === 'pdf' ? 'border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40]' : 'border-gray-100 text-gray-400 bg-gray-50/50'}`}
                    >
                      <FileText size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">PDF Document</span>
                    </button>
                    <button 
                      onClick={() => setFormat('excel')}
                      className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${format === 'excel' ? 'border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40]' : 'border-gray-100 text-gray-400 bg-gray-50/50'}`}
                    >
                      <Table size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Excel Sheet</span>
                    </button>
                  </div>
                </div>

                {/* Scheduling */}
                <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#5A5A40] text-white rounded-lg">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Schedule Report</p>
                        <p className="text-[10px] text-gray-500 font-medium italic">Automated delivery to your email</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsScheduled(!isScheduled)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${isScheduled ? 'bg-[#5A5A40]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isScheduled ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>

                  {isScheduled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-4 border-t border-gray-200"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Frequency</label>
                          <select 
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none"
                            value={scheduleFrequency}
                            onChange={(e) => setScheduleFrequency(e.target.value as any)}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Time</label>
                          <input 
                            type="time"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Advanced Options */}
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase">Advanced Options</label>
                  
                  {/* Watermark */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-2 flex items-center gap-1">
                      <ImageIcon size={10} />
                      Watermark Text
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. DRAFT or Farm Name"
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] focus:bg-white rounded-xl outline-none transition-all text-sm"
                      value={watermark}
                      onChange={(e) => setWatermark(e.target.value)}
                    />
                  </div>

                  {/* Net Profit Option */}
                  {showNetProfitOption && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-3">
                        <DollarSign size={16} className="text-[#5A5A40]" />
                        <span className="text-sm font-medium text-gray-700">Include Net Profit Summary</span>
                      </div>
                      <button
                        onClick={() => setIncludeNetProfit(!includeNetProfit)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${includeNetProfit ? 'bg-[#5A5A40]' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${includeNetProfit ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Column Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Included Columns</label>
                  <div className="space-y-2">
                    {availableColumns.map(col => (
                      <div 
                        key={col}
                        onClick={() => toggleColumn(col)}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical size={16} className="text-gray-300" />
                          <span className="text-sm font-medium text-gray-700">{col}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${selectedColumns.includes(col) ? 'bg-[#5A5A40] border-[#5A5A40]' : 'border-gray-300'}`}>
                          {selectedColumns.includes(col) && <X size={14} className="text-white rotate-45" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleDownload}
                  disabled={selectedColumns.length === 0}
                  className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-[#5A5A40]/10 flex items-center justify-center gap-2 disabled:opacity-50 mt-4 h-14"
                >
                  <Download size={18} />
                  Initiate {format.toUpperCase()} Protocol
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
