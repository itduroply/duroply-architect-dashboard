import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {  Box,  Typography,  Button,  Card,  CardContent,  Table,  TableBody,  TableCell,  TableContainer,  TableHead,  TableRow, 
  Paper,  Dialog,  DialogTitle,  DialogContent,  DialogActions,  TextField,  CircularProgress,  IconButton,  Chip, 
  Stack, FormControl,  InputLabel,  Select,  MenuItem,  Alert,} from '@mui/material';
import {  AccountBalanceWallet,  CheckCircle,  AccessTime,  GetApp,  Close,  ArrowForward,  Security,  NotificationsActive, InfoOutlined} from '@mui/icons-material';

// Remittance rows come from the admin app and Excel imports, so the account
// number column and status casing are not reliable. Match the way the admin
// app does: account number column, or the account number at the start of
// architect_name ("<account> | <name>"), and status case-insensitively.
// Remittances linked to the architect's payout requests are matched by
// transaction_id as well, the same link the admin Payout page uses.
const remittanceAccountFilter = (accountNumber, payoutIds = []) => {
  const filters = [`account_number.eq.${accountNumber}`, `architect_name.ilike.${accountNumber}*`];
  if (payoutIds.length > 0) filters.push(`transaction_id.in.(${payoutIds.join(',')})`);
  return filters.join(',');
};

const isRemittanceStatus = (item, status) =>
  String(item.status || '').trim().toLowerCase() === status;

// payout_request is what takes money out of the balance. Same staging as the
// admin Payout page: a request is settled once its linked remittance
// (remittances.transaction_id = payout_request.id) is Paid; until then it is
// in progress, whether still in Queue or already Made. Remittances not linked
// to any payout request (direct entries) are counted on their own.
const computePayoutTotals = (payouts, remits) => {
  const remitByPayoutId = new Map();
  remits.forEach(r => {
    if (r.transaction_id !== null && r.transaction_id !== undefined) {
      remitByPayoutId.set(String(r.transaction_id), r);
    }
  });
  const payoutIds = new Set(payouts.map(p => String(p.id)));

  let settled = 0;
  let inProgress = 0;
  const payoutsWithoutRemittance = [];

  payouts.forEach(p => {
    const linked = remitByPayoutId.get(String(p.id));
    if (linked && isRemittanceStatus(linked, 'paid')) {
      settled += Number(linked.amount ?? p.payout_amount ?? 0);
    } else {
      inProgress += Number(p.payout_amount || 0);
      if (!linked) payoutsWithoutRemittance.push(p);
    }
  });

  remits
    .filter(r => !payoutIds.has(String(r.transaction_id)))
    .forEach(r => {
      if (isRemittanceStatus(r, 'paid')) settled += Number(r.amount || 0);
      else if (isRemittanceStatus(r, 'pending')) inProgress += Number(r.amount || 0);
    });

  return { settled, inProgress, payoutsWithoutRemittance };
};

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

  // OTP confirmation step for payout submission
  const [otpStep, setOtpStep] = useState(false);
  const [pendingMobile, setPendingMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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
      // 1. Fetch payout_request along with id (needed to link remittances)
      const { data: payoutData, error: payError } = await supabase
        .from('payout_request')
        .select('id, architect_name, payout_amount, status, created_at')
        .eq('account_identity', account_number);

      if (payError) throw payError;

      // 2. Fetch remittances along with transaction_id
      const { data: remittanceData, error: remError } = await supabase
        .from('remittances')
        .select('id, architect_name, utr, status, amount, payment_mode, done_payment_date, transaction_id, created_at')
        .or(remittanceAccountFilter(account_number, (payoutData || []).map(p => p.id)));

      if (remError) throw remError;
      setRemittances(remittanceData || []);

      // 3. Fetch commission ledger
      const { data: ledgerRows, error: ledError } = await supabase
        .from('commission_ledger')
        .select('lead_id, claim_date, claim_no, total_payout_amount, architect_name')
        .ilike('architect_name', `${account_number}%`)
        .order('claim_date', { ascending: true });

      if (ledError) throw ledError;
      setLedgerData(ledgerRows || []);

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

    // Every payout request reduces the balance: settled once its remittance is
    // Paid, in progress while it is in Queue or Made.
    const { settled: totalPaidOut, inProgress: totalPending } = computePayoutTotals(payoutRequests, remittances);

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
    const filteredPaid = remittances.filter(item => isRemittanceStatus(item, 'paid'));
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
    // Payout requests with no remittance yet (Queue, or Made without a linked row)
    const { payoutsWithoutRemittance: pendingPayouts } = computePayoutTotals(payoutRequests, remittances);
    pendingPayouts.forEach(item => {
      list.push({
        // A payout request is a claim raised by the architect; show when it was raised.
        date: item.created_at || 'Unspecified Date',
        type: 'pending',
        label: 'Under Process',
        amount: Number(item.payout_amount || 0)
      });
    });

    const pendingRemittances = remittances.filter(item => isRemittanceStatus(item, 'pending'));
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
      // Payout requests with no remittance yet (Queue, or Made without a linked row)
      const underProcessQueueItems = computePayoutTotals(payoutRequests, remittances).payoutsWithoutRemittance
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
        .filter(item => isRemittanceStatus(item, 'pending'))
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
      return remittances.filter(item => isRemittanceStatus(item, 'paid'));
    }

    return [];
  }, [remittances, payoutRequests, activeTab]);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
  };

  const handleCloseToast = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resetPayoutModal = () => {
    setPayoutAmount('');
    setFormError('');
    setOtpStep(false);
    setOtp('');
    setOtpError('');
    setPendingMobile('');
    setResendCooldown(0);
  };

  // Step 1: validate the requested amount against the live balance (same
  // checks as before), then send an OTP to the architect's registered
  // mobile number instead of submitting the payout request directly.
  const handleRequestOtp = async (e) => {
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
        .select('architect_name, total_payout_amount')
        .ilike('architect_name', `${account_number}%`);
      const { data: freshPayouts, error: freshPayErr } = await supabase
        .from('payout_request')
        .select('id, payout_amount, status')
        .eq('account_identity', account_number);
      const { data: freshRemits, error: freshRemErr } = await supabase
        .from('remittances')
        .select('amount, status, transaction_id')
        .or(remittanceAccountFilter(account_number, (freshPayouts || []).map(p => p.id)));

      const { data: masterArchData, error: masterArchErr } = await supabase
        .from('master_architect')
        .select('mobile_number')
        .eq('account_number', account_number);

      if (!freshPayErr && !freshRemErr && !freshLedgErr && !masterArchErr) {
        const { settled: currentPaid, inProgress: currentQueue } =
          computePayoutTotals(freshPayouts || [], freshRemits || []);

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

      if (!linkedMobileNumber) {
        setFormError('Registered mobile number not found for this account. Please contact administrator.');
        setSubmitting(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('architect-send-otp', {
        body: { mobile_number: linkedMobileNumber, purpose: 'payout' },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setFormError(data.error || 'Unable to send OTP. Please try again.');
        setSubmitting(false);
        return;
      }

      setPendingMobile(linkedMobileNumber);
      setOtp('');
      setOtpError('');
      setOtpStep(true);
      setResendCooldown(30);
    } catch (error) {
      setFormError(error.message || 'Write execution failure on ledger database.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: verify the OTP, then run the exact same payout_request insert
  // that used to run directly off the "Confirm Clear" click.
  const handleVerifyAndSubmitPayout = async (e) => {
    e.preventDefault();
    setOtpError('');

    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setOtpError('OTP is required to proceed');
      return;
    }

    const numericAmount = parseFloat(payoutAmount);
    setOtpLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('architect-verify-otp', {
        body: { mobile_number: pendingMobile, otp: cleanOtp, purpose: 'payout' },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
        return;
      }

      const { error } = await supabase
        .from('payout_request')
        .insert([{
          account_identity: account_number,
          architect_name: financialMetrics.primaryArchitectName,
          payout_amount: numericAmount,
          status: 'Queue',
          mobile_no: pendingMobile
        }]);

      if (error) throw error;

      setIsModalOpen(false);
      resetPayoutModal();
      showToast('Your payout request has been successfully submitted and will be solved within 2 to 3 working days.');
      await fetchAnalyticsData();
    } catch (error) {
      setOtpError(error.message || 'Write execution failure on ledger database.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendPayoutOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    setOtpLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('architect-send-otp', {
        body: { mobile_number: pendingMobile, purpose: 'payout' },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setOtpError(data.error || 'Unable to resend OTP. Please try again.');
        return;
      }

      setResendCooldown(30);
    } catch (error) {
      setOtpError('A connection error occurred. Please try again.');
    } finally {
      setOtpLoading(false);
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
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, width: '100%' }}>
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            // Bounces in when the page opens
            animation: 'payoutEnter 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            // Two ripple rings that keep spreading out from the button
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '12px',
              border: '2px solid rgba(15, 23, 42, 0.45)',
              animation: 'payoutRipple 2.2s ease-out infinite',
              pointerEvents: 'none',
            },
            '&::after': { animationDelay: '1.1s' },
            '@keyframes payoutEnter': {
              '0%': { opacity: 0, transform: 'translateY(30px) scale(0.6)' },
              '60%': { opacity: 1, transform: 'translateY(-6px) scale(1.06)' },
              '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
            '@keyframes payoutRipple': {
              '0%': { transform: 'scale(1)', opacity: 0.9 },
              '100%': { transform: 'scale(1.18, 1.45)', opacity: 0 },
            },
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              '&::before, &::after': { animation: 'none', display: 'none' },
            },
          }}
        >
          {/* Offer-style tag on the corner */}
          {financialMetrics.netAvailableBalance > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: -10,
                right: -8,
                zIndex: 2,
                px: 1,
                py: 0.2,
                borderRadius: '10px',
                background: '#16a34a',
                color: '#fff',
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.45)',
                animation: 'payoutTag 1.6s ease-in-out infinite',
                '@keyframes payoutTag': {
                  '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
                  '50%': { transform: 'scale(1.12) rotate(-4deg)' },
                },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            >
              💰 READY
            </Box>
          )}

          <Button
            variant="contained"
            onClick={() => setIsModalOpen(true)}
            startIcon={<AccountBalanceWallet className="payout-wallet-icon" />}
            endIcon={<ArrowForward className="payout-arrow-icon" />}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1,
              // Moving warm gradient, like a sale banner
              background: 'linear-gradient(110deg, #0b0b10, #1f2937, #3f3f46, #0b0b10)',
              backgroundSize: '300% 100%',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '15px',
              py: 1.3,
              px: 3.2,
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 8px 22px rgba(0, 0, 0, 0.4)',
              animation: 'payoutGradient 4s linear infinite',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                background: 'linear-gradient(110deg, #0b0b10, #1f2937, #3f3f46, #0b0b10)',
                backgroundSize: '300% 100%',
                transform: 'translateY(-3px) scale(1.04)',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
              },
              '&:active': { transform: 'scale(0.97)' },
              // White shine that sweeps across the button
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-75%',
                width: '45%',
                height: '100%',
                background: 'linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.55) 50%, transparent 100%)',
                transform: 'skewX(-20deg)',
                animation: 'payoutShine 2.6s ease-in-out infinite',
                pointerEvents: 'none',
              },
              '& .payout-wallet-icon': {
                animation: 'payoutWiggle 2.6s ease-in-out infinite',
              },
              '& .payout-arrow-icon': {
                animation: 'payoutArrow 1.2s ease-in-out infinite',
              },
              '@keyframes payoutGradient': {
                '0%': { backgroundPosition: '0% 50%' },
                '100%': { backgroundPosition: '300% 50%' },
              },
              '@keyframes payoutShine': {
                '0%': { left: '-75%' },
                '55%, 100%': { left: '130%' },
              },
              '@keyframes payoutWiggle': {
                '0%, 75%, 100%': { transform: 'rotate(0deg) scale(1)' },
                '80%': { transform: 'rotate(-16deg) scale(1.15)' },
                '85%': { transform: 'rotate(14deg) scale(1.15)' },
                '90%': { transform: 'rotate(-8deg) scale(1.1)' },
                '95%': { transform: 'rotate(4deg) scale(1)' },
              },
              '@keyframes payoutArrow': {
                '0%, 100%': { transform: 'translateX(0)' },
                '50%': { transform: 'translateX(5px)' },
              },
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                '&::after': { animation: 'none', display: 'none' },
                '& .payout-wallet-icon, & .payout-arrow-icon': { animation: 'none' },
              },
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span>Initiate Payout</span>
              {financialMetrics.netAvailableBalance > 0 && (
                <Typography component="span" sx={{ fontSize: '11px', fontWeight: 700, color: '#FFF7D6', letterSpacing: '0.02em' }}>
                  ₹{financialMetrics.netAvailableBalance.toLocaleString('en-IN')} ready to withdraw
                </Typography>
              )}
            </Box>
          </Button>
        </Box>
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
        onClose={() => { if (!submitting && !otpLoading) { setIsModalOpen(false); resetPayoutModal(); } }}
        PaperProps={{ sx: { borderRadius: '16px', p: 1, maxHeight: '90vh', overflowY: 'auto' } }}
      >
        <DialogTitle sx={{ m: 0, p: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              {otpStep ? 'Verify OTP to Confirm' : 'Authorize Settlement Disbursal'}
            </Typography>
          </Box>
          <IconButton disabled={submitting || otpLoading} onClick={() => { setIsModalOpen(false); resetPayoutModal(); }} sx={{ color: '#94a3b8' }}>
            <Close sx={{ fontSize: '18px' }} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: 'rgba(15, 23, 42, 0.05)', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'visible' }}>

          {!otpStep ? (
            <>
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
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: '13px', color: '#475569' }}>
                Enter the 6-digit code sent to <strong>{pendingMobile}</strong> to confirm this ₹{parseFloat(payoutAmount || '0').toLocaleString('en-IN')} withdrawal request.
              </Typography>

              <TextField
                fullWidth
                variant="outlined"
                placeholder="Enter 6-digit OTP"
                disabled={otpLoading}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                InputProps={{ style: { fontSize: 14, fontWeight: 600, color: '#0f172a', borderRadius: '8px' } }}
              />

              {otpError && (
                <Alert severity="error" icon={false} sx={{ borderRadius: '8px', fontSize: '12px' }}>
                  {otpError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Button
                  disabled={otpLoading}
                  onClick={() => { setOtpStep(false); setOtp(''); setOtpError(''); }}
                  sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 600, color: '#64748b', p: 0, minWidth: 'auto' }}
                >
                  Change amount
                </Button>
                <Button
                  disabled={otpLoading || resendCooldown > 0}
                  onClick={handleResendPayoutOtp}
                  sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 600, color: '#0f172a', p: 0, minWidth: 'auto' }}
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                </Button>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2, gap: 2 }}>
          {!otpStep ? (
            <>
              <Button disabled={submitting} onClick={() => { setIsModalOpen(false); resetPayoutModal(); }} sx={{ flex: 1, textTransform: 'none', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Cancel</Button>
              <Button
                variant="contained"
                disabled={submitting}
                onClick={handleRequestOtp}
                endIcon={submitting ? <CircularProgress size={16} /> : <ArrowForward />}
                sx={{ flex: 1, textTransform: 'none', fontSize: '13px', fontWeight: 600, py: 1.2, borderRadius: '8px', background: '#0f172a' }}
              >
                {submitting ? 'Sending OTP...' : 'Confirm Clear'}
              </Button>
            </>
          ) : (
            <>
              <Button disabled={otpLoading} onClick={() => { setIsModalOpen(false); resetPayoutModal(); }} sx={{ flex: 1, textTransform: 'none', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Cancel</Button>
              <Button
                variant="contained"
                disabled={otpLoading}
                onClick={handleVerifyAndSubmitPayout}
                endIcon={otpLoading ? <CircularProgress size={16} /> : <ArrowForward />}
                sx={{ flex: 1, textTransform: 'none', fontSize: '13px', fontWeight: 600, py: 1.2, borderRadius: '8px', background: '#0f172a' }}
              >
                {otpLoading ? 'Verifying...' : 'Verify & Submit'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
