import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {  Box,  Typography,  Button,  Card,  CardContent,  Table,  TableBody,  TableCell,  TableContainer,  TableHead,  TableRow, 
  Paper,  Dialog,  DialogTitle,  DialogContent,  DialogActions,  TextField,  CircularProgress,  IconButton,  Chip, 
  Stack, FormControl,  InputLabel,  Select,  MenuItem,  Alert,} from '@mui/material';
import {  AccountBalanceWallet,  CheckCircle,  AccessTime,  GetApp,  Close,  ArrowForward,  Security,  NotificationsActive, InfoOutlined} from '@mui/icons-material';

export default function Analytics({ account_number }) {
  const [remittances, setRemittances] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('Complete'); 
  const [selectedRange, setSelectedRange] = useState('3');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const formatTo2026CustomDate = useCallback((dateStr) => {
    if (!dateStr || dateStr === 'Unspecified Date' || dateStr === 'Awaiting Settlement') {
      return dateStr === 'Awaiting Settlement' ? 'Awaiting Settlement' : '—';
    }
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthName = monthNames[dateObj.getMonth()];
      return `2026-${monthName}-${day}`;
    } catch {
      return dateStr;
    }
  }, []);

  useEffect(() => {
    // Ensures page opens at the top on mount
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const formatArchitectName = useCallback((name) => {
    if (!name) return '';
    const parts = name.split('|').map(part => part.trim());
    const alphaParts = parts.filter(part => isNaN(part) && part.length > 0);
    return alphaParts.length > 0 ? alphaParts.join(' | ') : parts[parts.length - 1];
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch remittances along with transaction_id
      const { data: remittanceData, error: remError } = await supabase
        .from('remittances')
        .select('id, architect_name, utr, status, amount, payment_mode, done_payment_date, transaction_id, created_at')
        .eq('account_number', account_number);

      if (remError) throw remError;
      setRemittances(remittanceData || []);

      // 2. Fetch commission ledger
      const { data: ledgerRows, error: ledError } = await supabase
        .from('commission_ledger')
        .select('lead_id, claim_date, claim_no, total_payout_amount, architect_name')
        .order('claim_date', { ascending: true });

      if (ledError) throw ledError;
      setLedgerData(ledgerRows || []);

      // 3. Fetch payout_request along with id
      const { data: payoutData, error: payError } = await supabase
        .from('payout_request')
        .select('id, architect_name, payout_amount, status, created_at')
        .eq('account_identity', account_number);

      if (payError) throw payError;
      setPayoutRequests(payoutData || []);
    } catch (error) {
      showToast(error.message || 'Error pulling cloud matrix metrics', 'error');
    } finally {
      setLoading(false);
    }
  }, [account_number]);

  useEffect(() => {
    if (account_number) {
      fetchAnalyticsData();
    }
  }, [account_number, fetchAnalyticsData]);

  // REVISED LIFECYCLE FINANCIAL METRICS CALCULATION
  const financialMetrics = useMemo(() => {
    const totalEarned = ledgerData
      .filter(item => item.architect_name && item.architect_name.includes(account_number))
      .reduce((sum, item) => sum + Number(item.total_payout_amount || 0), 0);

    const totalPaidOut = remittances
      .filter(item => item.status === 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    // 1. Requests pending in payout_request Queue (Not yet processed by admin)
    const pendingPayoutRequestsSum = payoutRequests
      .filter(item => item.status === 'Queue')
      .reduce((sum, item) => sum + Number(item.payout_amount || 0), 0);

    // 2. Requests converted to ledger entry and currently pending in remittances table
    const pendingRemittancesSum = remittances
      .filter(item => item.status === 'Pending')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    // Total pending balance under process
    const totalPending = pendingPayoutRequestsSum + pendingRemittancesSum;

    const netAvailableBalance = totalEarned - totalPaidOut - totalPending;

    const rawArchitectName = remittances[0]?.architect_name || 
      ledgerData.find(item => item.architect_name?.includes(account_number))?.architect_name ||
      'Valued Partner';

    return {
      totalEarned,
      totalPaidOut,
      totalPending,
      netAvailableBalance: netAvailableBalance < 0 ? 0 : netAvailableBalance,
      primaryArchitectName: formatArchitectName(rawArchitectName)
    };
  }, [remittances, ledgerData, payoutRequests, account_number, formatArchitectName]);

  const flattenedLedgerData = useMemo(() => {
    const list = [];
    const uniqueLeadIdsInOrder = [];

    const filteredLedger = ledgerData.filter(item => item.architect_name && item.architect_name.includes(account_number));
    
    // 1. Process items chronologically to track arrival sequence
    const chronologicalLedger = [...filteredLedger].sort((a, b) => new Date(a.claim_date) - new Date(b.claim_date));
    const earnedAggregationMap = {};

    chronologicalLedger.forEach(item => {
      const date = item.claim_date || 'Unspecified Date';
      const leadId = item.lead_id || 'N/A';
      const compositeKey = `${date}_${leadId}`;

      if (leadId !== 'N/A' && !uniqueLeadIdsInOrder.includes(leadId)) {
        uniqueLeadIdsInOrder.push(leadId);
      }
      const siteNumber = uniqueLeadIdsInOrder.indexOf(leadId) + 1;

      if (!earnedAggregationMap[compositeKey]) {
        earnedAggregationMap[compositeKey] = {
          date,
          type: 'earned',
          label: `Lead ID: ${leadId} (Site ${siteNumber || 1})`,
          amount: 0
        };
      }
      earnedAggregationMap[compositeKey].amount += Number(item.total_payout_amount || 0);
    });

    Object.values(earnedAggregationMap).forEach(entry => {
      list.push(entry);
    });

    // 2. Process Disbursements
    const filteredPaid = remittances.filter(item => item.status === 'Paid');
    filteredPaid.forEach(item => {
      const date = item.done_payment_date || 'Unspecified Date';
      list.push({
        date,
        type: 'paid',
        label: `Disbursed Settlement (UTR NO ${item.utr || 'N/A'})`,
        amount: Number(item.amount || 0)
      });
    });

    // 3. Process Transactions In Progress for Transaction History View
    const pendingPayouts = payoutRequests.filter(item => item.status === 'Queue');
    pendingPayouts.forEach(item => {
      list.push({
        // A payout request is a claim raised by the architect; show when it was raised.
        date: item.created_at || 'Unspecified Date',
        type: 'pending',
        label: 'Under Process',
        amount: Number(item.payout_amount || 0)
      });
    });

    const pendingRemittances = remittances.filter(item => item.status === 'Pending');
    pendingRemittances.forEach(item => {
      list.push({
        date: item.created_at || 'Unspecified Date',
        type: 'pending',
        label: 'Under Process',
        amount: Number(item.amount || 0)
      });
    });

    // 4. Sort to keep pending on top, then latest items top
    list.sort((a, b) => {
      if (a.type === 'pending' && b.type !== 'pending') return -1;
      if (a.type !== 'pending' && b.type === 'pending') return 1;
      if (a.type === 'paid' && b.type !== 'paid') return -1;
      if (a.type !== 'paid' && b.type === 'paid') return 1;
      return new Date(b.date) - new Date(a.date);
    });

    return list;
  }, [ledgerData, remittances, payoutRequests, account_number]);

  const targetViewDataset = useMemo(() => {
    if (activeTab === 'Pending') {
      // Items in Queue state in payout_request table
      const underProcessQueueItems = payoutRequests
        .filter(item => item.status === 'Queue')
        .map(item => ({
          id: item.id || 'REQ',
          utr: 'Awaiting Verification',
          payment_mode: 'Processing Pipeline',
          status: 'Under Process',
          claim_date: item.created_at || 'Unspecified Date',
          amount: item.payout_amount
        }));

      // Items in Pending state in remittances table
      const remittancePendingItems = remittances
        .filter(item => item.status === 'Pending')
        .map(item => ({
          id: item.id,
          utr: item.utr || 'Awaiting Allocation',
          payment_mode: item.payment_mode || 'Digital Transfer',
          status: 'Under Process',
          claim_date: item.created_at || 'Unspecified Date',
          amount: item.amount
        }));

      return [...underProcessQueueItems, ...remittancePendingItems];
    }

    if (activeTab === 'Paid') {
      return remittances.filter(item => item.status === 'Paid');
    }

    return [];
  }, [remittances, payoutRequests, activeTab]);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
  };

  const handleCloseToast = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    
    const numericAmount = parseFloat(payoutAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Please input a valid capital distribution figure.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: freshLedger, error: freshLedgErr } = await supabase
        .from('commission_ledger')
        .select('architect_name, total_payout_amount');
      const { data: freshPayouts, error: freshPayErr } = await supabase
        .from('payout_request')
        .select('payout_amount, status')
        .eq('account_identity', account_number);
      const { data: freshRemits, error: freshRemErr } = await supabase
        .from('remittances')
        .select('amount, status')
        .eq('account_number', account_number);
      
      const { data: masterArchData, error: masterArchErr } = await supabase
        .from('master_architect')
        .select('mobile_number')
        .eq('account_number', account_number);

      if (!freshPayErr && !freshRemErr && !freshLedgErr && !masterArchErr) {
        const currentPaid = (freshRemits || [])
          .filter(i => i.status === 'Paid')
          .reduce((s, i) => s + Number(i.amount || 0), 0);
        
        const pendingPayoutsSum = (freshPayouts || [])
          .filter(i => i.status === 'Queue')
          .reduce((s, i) => s + Number(i.payout_amount || 0), 0);

        const pendingRemitsSum = (freshRemits || [])
          .filter(i => i.status === 'Pending')
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        const currentQueue = pendingPayoutsSum + pendingRemitsSum;

        const currentEarned = (freshLedger || [])
          .filter(item => item.architect_name && item.architect_name.includes(account_number))
          .reduce((sum, item) => sum + Number(item.total_payout_amount || 0), 0);

        const freshAvailable = currentEarned - currentPaid - currentQueue;

        if (numericAmount > freshAvailable) {
          setFormError(`Transaction Denied: Secure verification failed. Available pool balance has changed or exceeds limit of ₹${freshAvailable.toLocaleString('en-IN')}`);
          setSubmitting(false);
          fetchAnalyticsData();
          return;
        }
      }

      const linkedMobileNumber = masterArchData && masterArchData.length > 0 ? masterArchData[0].mobile_number : null;

      const { error } = await supabase
        .from('payout_request')
        .insert([{
          account_identity: account_number,
          architect_name: financialMetrics.primaryArchitectName,
          payout_amount: numericAmount,
          status: 'Queue',
          mobile_no: linkedMobileNumber
        }]);

      if (error) throw error;

      setIsModalOpen(false);
      setPayoutAmount('');
      showToast('Your payout request has been successfully submitted and will be solved within 2 to 3 working days.');
      await fetchAnalyticsData();
    } catch (error) {
      setFormError(error.message || 'Write execution failure on ledger database.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateRangePDFReport = () => {
    const rangeInMonths = parseInt(selectedRange);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const cutOffDate = new Date();
    cutOffDate.setMonth(today.getMonth() - rangeInMonths);
    cutOffDate.setHours(0, 0, 0, 0);

    let reportTitle = "";
    let dataToRender = [];

    let openingBalance = 0;
    let periodCredits = 0;
    let periodDebits = 0;

    if (activeTab === 'Complete') {
      reportTitle = `Complete Ledger Statement - Last ${rangeInMonths} Months`;
      
      flattenedLedgerData.forEach(item => {
        if (item.type === 'pending' || item.date === 'Awaiting Settlement' || item.label === 'Under Process') return;
        if (!item.date || item.date === 'Unspecified Date') return;
        
        const itemDate = new Date(item.date);
        const amt = Number(item.amount || 0);

        if (itemDate < cutOffDate) {
          if (item.type === 'earned') openingBalance += amt;
          if (item.type === 'paid') openingBalance -= amt;
        } else if (itemDate >= cutOffDate && itemDate <= today) {
          if (item.type === 'earned') periodCredits += amt;
          if (item.type === 'paid') periodDebits += amt;
          dataToRender.push(item);
        }
      });
    } else if (activeTab === 'Paid') {
      reportTitle = `Settled Remittances Statement - Last ${rangeInMonths} Months`;
      
      targetViewDataset.forEach(item => {
        if (!item.done_payment_date || item.done_payment_date === 'Awaiting Settlement') return;
        const itemDate = new Date(item.done_payment_date);
        const amt = Number(item.amount || 0);

        if (itemDate < cutOffDate) {
          openingBalance -= amt;
        } else if (itemDate >= cutOffDate && itemDate <= today) {
          periodDebits += amt;
          dataToRender.push(item);
        }
      });
    }

    const closingBalance = openingBalance + periodCredits - periodDebits;

    const doc = new jsPDF();

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(reportTitle, 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${formatTo2026CustomDate(new Date().toISOString())}`, 14, 25);
    doc.text(`DUROPLY Industries Limited | Account Ref: ${account_number}`, 14, 30);
    doc.text(`Beneficiary Partner: ${financialMetrics.primaryArchitectName}`, 14, 35);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 40, 182, 32, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("FINANCIAL SUMMARY OVERVIEW", 18, 47);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);

    doc.text(`• Opening Balance : Rs. ${openingBalance.toLocaleString('en-IN')}`, 18, 54);
    doc.text(`• Total Credits (+) : Rs. ${periodCredits.toLocaleString('en-IN')}`, 18, 60);
    doc.text(`• Total Debits (-)  : Rs. ${periodDebits.toLocaleString('en-IN')}`, 18, 66);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`• Closing Balance : Rs. ${closingBalance.toLocaleString('en-IN')}`, 110, 66);

    doc.setTextColor(0, 0, 0);

    if (activeTab === 'Complete') {
      const tableColumn = ["Date", "Source / Entities", "Type", "Transaction Amount"];
      const tableRows = dataToRender.map(item => {
        const isPaid = item.type === 'paid';
        const dateCell = formatTo2026CustomDate(item.date);
        const displayAmount = `${isPaid ? '-' : '+'}Rs. ${Number(item.amount).toLocaleString('en-IN')}`;
        return [dateCell, item.label, isPaid ? 'Debit' : 'Credit', displayAmount];
      });

      autoTable(doc, {
        startY: 77,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 85 },
          2: { cellWidth: 25 },
          3: { halign: 'right', cellWidth: 37 }
        },
        styles: { fontSize: 8.5, cellPadding: 3 }
      });
    } else {
      const tableColumn = ["Payment Date", "UTR Reference", "Payment Mode", "Disbursed Amount"];
      const tableRows = dataToRender.map(item => [
        formatTo2026CustomDate(item.done_payment_date),
        item.utr || 'N/A',
        item.payment_mode || 'Digital Transfer',
        `Rs. ${Number(item.amount).toLocaleString('en-IN')}`
      ]);

      autoTable(doc, {
        startY: 77,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { halign: 'right', cellWidth: 47 }
        },
        styles: { fontSize: 8.5, cellPadding: 3 }
      });
    }

    doc.save(`${reportTitle.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#FDFBF7', gap: 2.5 }}>
        <CircularProgress sx={{ color: '#1e293b' }} size={40} thickness={4} />
        <Typography sx={{ color: '#64748b', fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Syncing Distributed Ledger Balances
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #FDFBF7 0%, #F8F6F0 100%)', p: { xs: 2, sm: 3, lg: 4 }, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      
      {notification.show && (
        <Box 
          sx={{ 
            mb: 2, 
            p: 2, 
            borderRadius: '12px', 
            bgcolor: notification.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${notification.type === 'error' ? '#fee2e2' : '#dcfce7'}`,
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <NotificationsActive sx={{ color: notification.type === 'error' ? '#ef4444' : '#22c55e' }} />
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: notification.type === 'error' ? '#991b1b' : '#166534' }}>
              {notification.message}
            </Typography>
          </Stack>
          <IconButton onClick={handleCloseToast} sx={{ color: notification.type === 'error' ? '#991b1b' : '#166534' }}>
            <Close sx={{ fontSize: '16px' }} />
          </IconButton>
        </Box>
      )}

      {/* 1. All 4 KPIs Row */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: 2, 
          mb: 2.5, 
          width: '100%',
          overflowX: 'auto',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        
        {/* KPI 1 */}
        <Card sx={{ flex: 1, minWidth: '180px', borderRadius: '8px', background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', border: '1px solid rgba(15, 23, 42, 0.05)', boxShadow: '0 2px 10px rgba(15,23,42,0.01)' }}>
          <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>LIFETIME EARNINGS</Typography>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#94a3b8', lineHeight: 1 }}>₹</Typography>
            </Box>
            <Typography sx={{ fontSize: '18px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, color: '#0f172a' }}>
              ₹{financialMetrics.totalEarned.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card sx={{ flex: 1, minWidth: '180px', borderRadius: '8px', background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', border: '1px solid rgba(15, 23, 42, 0.05)', boxShadow: '0 2px 10px rgba(15,23,42,0.01)' }}>
          <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>GROSS AMOUNT SETTLED</Typography>
              <CheckCircle sx={{ fontSize: '15px', color: '#15803d', opacity: 0.7 }} />
            </Box>
            <Typography sx={{ fontSize: '18px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, color: '#0f172a' }}>
              ₹{financialMetrics.totalPaidOut.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>

        {/* KPI 3 - Payment in progress */}
        <Card sx={{ flex: 1, minWidth: '180px', borderRadius: '8px', background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', border: '1px solid rgba(15, 23, 42, 0.05)', boxShadow: '0 2px 10px rgba(15,23,42,0.01)' }}>
          <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>PAYMENT IN PROGRESS</Typography>
              <AccessTime sx={{ fontSize: '15px', color: '#b45309', opacity: 0.8 }} />
            </Box>
            <Typography sx={{ fontSize: '18px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, color: '#c2410c' }}>
              ₹{financialMetrics.totalPending.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>

        {/* KPI 4 - Remaining Balance */}
        <Card sx={{ flex: 1, minWidth: '180px', borderRadius: '8px', background: 'linear-gradient(135deg, #02041a 0%, #0f172a 100%)', color: '#fff', boxShadow: '0 4px 14px rgba(15,23,42,0.08)' }}>
          <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>REMAINING AMOUNT</Typography>
              <Security sx={{ fontSize: '15px', color: '#38bdf8' }} />
            </Box>
            <Typography sx={{ fontSize: '18px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, color: '#FDFBF7' }}>
              ₹{financialMetrics.netAvailableBalance.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>

      </Box>

      {/* 2. Initiate Payout Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3, width: '100%' }}>
        <Button 
          variant="contained" 
          onClick={() => setIsModalOpen(true)}
          startIcon={<AccountBalanceWallet />}
          sx={{ 
            background: '#0f172a',
            color: '#fff', 
            textTransform: 'none', 
            fontWeight: 700, 
            py: 1.2, 
            px: 3,
            borderRadius: '6px',
            border: '2.5px solid #FFD700',
            boxShadow: '0 0 12px rgba(255, 215, 0, 0.4)'
          }}
        >
          Initiate Payout
        </Button>
      </Box>

      {/* Ledger History Core Wrapper */}
      <Paper sx={{ borderRadius: '12px', border: '1px solid rgba(15, 23, 42, 0.06)', background: '#ffffff', overflow: 'hidden', mb: 4 }}>
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
          <Stack direction="row" spacing={1} sx={{ p: 0.6, bgcolor: '#F8F6F0', borderRadius: '10px', width: 'fit-content' }}>
            <Button
              onClick={() => setActiveTab('Complete')}
              sx={{
                textTransform: 'none', fontSize: '12px', fontWeight: 700, px: 2.5, py: 0.8, borderRadius: '6px',
                bgcolor: activeTab === 'Complete' ? '#fff' : 'transparent',
                color: activeTab === 'Complete' ? '#0f172a' : '#64748b'
              }}
            >
              Transaction History
            </Button>
            <Button
              onClick={() => setActiveTab('Pending')}
              sx={{
                textTransform: 'none', fontSize: '12px', fontWeight: 700, px: 2.5, py: 0.8, borderRadius: '6px',
                bgcolor: activeTab === 'Pending' ? '#fff' : 'transparent',
                color: activeTab === 'Pending' ? '#0f172a' : '#64748b'
              }}
            >
              Transaction In Progress
            </Button>
            <Button
              onClick={() => setActiveTab('Paid')}
              sx={{
                textTransform: 'none', fontSize: '12px', fontWeight: 700, px: 2.5, py: 0.8, borderRadius: '6px',
                bgcolor: activeTab === 'Paid' ? '#fff' : 'transparent',
                color: activeTab === 'Paid' ? '#0f172a' : '#64748b'
              }}
            >
             Transaction Completed
            </Button>
          </Stack>

          {(activeTab === 'Complete' || activeTab === 'Paid') && (
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="range-select-label" sx={{ fontSize: '12px', fontWeight: 600 }}>Duration Cycle</InputLabel>
                <Select
                  labelId="range-select-label"
                  id="range-select"
                  value={selectedRange}
                  label="Duration Cycle"
                  onChange={(e) => setSelectedRange(e.target.value)}
                  sx={{ borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                >
                  <MenuItem value="3">Last 3 Months</MenuItem>
                  <MenuItem value="6">Last 6 Months</MenuItem>
                  <MenuItem value="9">Last 9 Months</MenuItem>
                  <MenuItem value="12">Last 12 Months</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={generateRangePDFReport}
                startIcon={<GetApp />}
                sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 600, borderRadius: '8px', height: '40px', bgcolor: '#0f172a' }}
              >
                Download Statement
              </Button>
            </Stack>
          )}
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#FDFBF7' }}>
              {activeTab === 'Complete' || activeTab === 'Pending' ? (
                <TableRow>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2, pl: 3 }}>Date</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2 }}>Source / Entity</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2, textAlign: 'right', pr: 3 }}>Transaction Amount</TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2, pl: 3 }}>Payment Date</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2 }}>UTR Number</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2 }}>Payment Mode</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2, textAlign: 'center' }}>Settlement State</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', py: 2, textAlign: 'right', pr: 3 }}>Amount Disbursed</TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {activeTab === 'Complete' ? (
                flattenedLedgerData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ textAlign: 'center', py: 6, color: '#94a3b8', fontSize: '13px' }}>
                      No matching tracking logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  flattenedLedgerData.map((item, idx) => {
                    const isDisbursedSettlement = item.type === 'paid';
                    const isPending = item.type === 'pending';

                    return (
                      <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#FDFBF7' } }}>
                        <TableCell sx={{ fontSize: '12px', color: '#64748b', py: 1.5, pl: 3 }}>
                          {formatTo2026CustomDate(item.date)}
                        </TableCell>
                        <TableCell sx={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', py: 1.5 }}>
                          {isPending ? (
                            <Chip 
                              label="Under Process" 
                              size="small" 
                              sx={{ fontSize: '10px', fontWeight: 700, bgcolor: '#fffbeb', color: '#b45309', borderRadius: '4px' }} 
                            />
                          ) : (
                            item.label
                          )}
                        </TableCell>
                        <TableCell sx={{ 
                          fontSize: '14px', 
                          fontWeight: 700, 
                          color: isPending ? '#b45309' : (isDisbursedSettlement ? '#dc2626' : '#16a34a'), 
                          textAlign: 'right', 
                          pr: 3, 
                          py: 1.5 
                        }}>
                          {isPending ? '' : (isDisbursedSettlement ? '-' : '+')}₹{item.amount.toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )
              ) : activeTab === 'Pending' ? (
                targetViewDataset.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ textAlign: 'center', py: 6, color: '#94a3b8', fontSize: '13px' }}>
                      No matching pending transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  targetViewDataset.map((item, idx) => (
                    <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#FDFBF7' } }}>
                      <TableCell sx={{ fontSize: '12px', color: '#64748b', py: 1.5, pl: 3 }}>
                        {formatTo2026CustomDate(item.claim_date)}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip 
                          label="Under Process" 
                          size="small" 
                          sx={{ fontSize: '10px', fontWeight: 700, bgcolor: '#fffbeb', color: '#b45309', borderRadius: '4px' }} 
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '14px', fontWeight: 700, color: '#b45309', textAlign: 'right', pr: 3, py: 1.5 }}>
                        ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : (
                targetViewDataset.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: '#94a3b8', fontSize: '13px' }}>
                      No matching settlement logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  targetViewDataset.map((item, idx) => (
                    <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#FDFBF7' } }}>
                      <TableCell sx={{ fontSize: '12px', color: '#64748b', py: 1.5, pl: 3 }}>
                        {formatTo2026CustomDate(item.done_payment_date)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', color: '#475569', py: 1.5 }}>
                        {item.utr || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip label={item.payment_mode || 'Digital Transfer'} size="small" sx={{ fontSize: '10px', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569', borderRadius: '4px' }} />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', py: 1.5 }}>
                        <Chip label="Paid" size="small" sx={{ fontSize: '10px', fontWeight: 700, bgcolor: '#f0fdf4', color: '#15803d', borderRadius: '4px' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '14px', fontWeight: 600, color: '#15803d', textAlign: 'right', pr: 3, py: 1.5 }}>
                        ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Expanded Width Modal Popup */}
      <Dialog 
        open={isModalOpen} 
        fullWidth
        maxWidth="sm"
        onClose={() => { if (!submitting) { setIsModalOpen(false); setFormError(''); setPayoutAmount(''); } }}
        PaperProps={{ sx: { borderRadius: '16px', p: 1, maxHeight: '90vh', overflowY: 'auto' } }}
      >
        <DialogTitle sx={{ m: 0, p: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              Authorize Settlement Disbursal
            </Typography>
          </Box>
          <IconButton disabled={submitting} onClick={() => { setIsModalOpen(false); setFormError(''); setPayoutAmount(''); }} sx={{ color: '#94a3b8' }}>
            <Close sx={{ fontSize: '18px' }} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: 'rgba(15, 23, 42, 0.05)', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'visible' }}>
          
          <Box sx={{ display: 'flex', gap: 1.5, bgcolor: '#fef3c7', p: 2, borderRadius: '8px', border: '1px solid #fde68a' }}>
            <InfoOutlined sx={{ color: '#b45309', fontSize: '18px', mt: 0.2 }} />
            <Box>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#92400e', mb: 0.5 }}>
                Tax Deduction Notice
              </Typography>
              <Typography sx={{ fontSize: '11.5px', color: '#b45309', fontWeight: 500, lineHeight: 1.4 }}>
               10% TDS will be automatically deducted from the requested amount (applicable for each FY) as per government regulation.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', mb: 1 }}>BENEFICIARY NAME</Typography>
              <TextField fullWidth variant="outlined" value={financialMetrics.primaryArchitectName} disabled InputProps={{ style: { fontSize: 13, background: '#F8F6F0', borderRadius: '8px' } }} sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }} />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', mb: 1 }}>ACCOUNT IDENTITY REFERENCE</Typography>
              <TextField fullWidth variant="outlined" value={account_number} disabled InputProps={{ style: { fontSize: 13, fontFamily: 'monospace', background: '#F8F6F0', borderRadius: '8px' } }} sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }} />
            </Box>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>WITHDRAWAL AMOUNT (INR)</Typography>
              <Typography sx={{ fontSize: '11px', color: '#0f172a', fontWeight: 700, ml: 'auto' }}>Max Pool: ₹{financialMetrics.netAvailableBalance.toLocaleString('en-IN')}</Typography>
            </Box>
            <TextField 
              fullWidth 
              variant="outlined"
              type="number"
              placeholder="0.00"
              disabled={submitting}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              InputProps={{
                startAdornment: <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', mr: 0.5 }}>₹</Typography>,
                style: { fontSize: 14, fontWeight: 600, color: '#0f172a', borderRadius: '8px' }
              }}
            />

            {/* Quick Amount Option Chips */}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {[5000, 10000, 20000].map((val) => (
                <Chip
                  key={val}
                  label={`₹${val.toLocaleString('en-IN')}`}
                  clickable
                  disabled={submitting}
                  onClick={() => setPayoutAmount(val.toString())}
                  sx={{ 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    bgcolor: payoutAmount === val.toString() ? '#0f172a' : '#f1f5f9',
                    color: payoutAmount === val.toString() ? '#ffffff' : '#334155',
                    '&:hover': { bgcolor: payoutAmount === val.toString() ? '#0f172a' : '#e2e8f0' }
                  }}
                />
              ))}
              <Chip
                label="All"
                clickable
                disabled={submitting}
                onClick={() => setPayoutAmount(financialMetrics.netAvailableBalance.toString())}
                sx={{ 
                  borderRadius: '6px', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  bgcolor: payoutAmount === financialMetrics.netAvailableBalance.toString() ? '#0f172a' : '#e0f2fe',
                  color: payoutAmount === financialMetrics.netAvailableBalance.toString() ? '#ffffff' : '#0369a1',
                  '&:hover': { bgcolor: payoutAmount === financialMetrics.netAvailableBalance.toString() ? '#0f172a' : '#bae6fd' }
                }}
              />
            </Stack>
          </Box>

          {formError && (
            <Alert severity="error" icon={false} sx={{ borderRadius: '8px', fontSize: '12px', mt: 0.5 }}>
              {formError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2, gap: 2 }}>
          <Button disabled={submitting} onClick={() => { setIsModalOpen(false); setFormError(''); setPayoutAmount(''); }} sx={{ flex: 1, textTransform: 'none', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Cancel</Button>
          <Button 
            variant="contained"
            disabled={submitting}
            onClick={handlePayoutSubmit}
            endIcon={submitting ? <CircularProgress size={16} /> : <ArrowForward />}
            sx={{ flex: 1, textTransform: 'none', fontSize: '13px', fontWeight: 600, py: 1.2, borderRadius: '8px', background: '#0f172a' }}
          >
            {submitting ? 'Verifying...' : 'Confirm Clear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
