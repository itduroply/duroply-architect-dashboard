import React, { useState, useEffect, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  CircularProgress,
  Button,
  TextField,
  Paper,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Slide,
  Collapse
} from '@mui/material';
import {
  LocationOn as LocationPinIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  InfoOutlined as InfoIcon,
  Close as CloseIcon,
  ConfirmationNumberOutlined as TicketIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  HomeWorkOutlined as AddressIcon
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const cleanWorkspaceTheme = createTheme({
  palette: {
    mode: 'light',
    background: { 
      default: '#F9F8F6', 
      paper: '#FFFFFF' 
    },
    primary: { main: '#111625' }, 
    secondary: { main: '#C2A478' }, 
    text: { 
      primary: '#111625',   
      secondary: '#6E7787'  
    },
  },
  typography: {
    fontFamily: '"Inter", "-apple-system", sans-serif',
    h6: { 
      fontFamily: '"Inter", sans-serif', 
      fontWeight: 600, 
      color: '#111625',
      fontSize: '1.25rem'
    },
    body2: { 
      fontSize: '0.85rem',
      lineHeight: 1.6,
      color: '#3A4250'
    },
    caption: {
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: '#6E7787'
    }
  }
});

const executeFuzzySaaSMatch = (claimProductCode, masterSkuRows) => {
  if (!claimProductCode || !masterSkuRows || masterSkuRows.length === 0) return null;
  const rawClaimStr = String(claimProductCode).trim().toUpperCase();
  const isDoorException = rawClaimStr.includes('DECORATIVE') || rawClaimStr.includes('DOOR') || rawClaimStr.includes('FLUSH') || rawClaimStr.startsWith('FD');
  if (!isDoorException && !/[0-9]+\s*MM$/i.test(rawClaimStr)) return null; 

  const normalize = (str) => String(str).toUpperCase().replace(/[\s_\-]/g, '');
  const targetToken = normalize(rawClaimStr);

  let match = masterSkuRows.find(row => normalize(row.sku) === targetToken);
  if (match) return match;

  if (isDoorException) {
    const baseClaimToken = rawClaimStr.replace(/_?\s*\d+\s*MM$/i, '').replace(/[\s_\-]/g, '');
    match = masterSkuRows.find(row => {
      const baseMasterToken = String(row.sku).toUpperCase().replace(/ALLTHICKNESS/i, '').replace(/[\s_\-]/g, '');
      return baseMasterToken === baseClaimToken || baseClaimToken.startsWith(baseMasterToken) || baseMasterToken.startsWith(baseClaimToken);
    });
    if (match) return match;
  }

  match = masterSkuRows.find(row => {
    const masterToken = normalize(row.sku);
    return targetToken.includes(masterToken) || masterToken.includes(targetToken);
  });
  return match || null;
};

const LocationPage = ({ account_number }) => {
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [availableCities, setAvailableCities] = useState([]);
  const [dashboardMetrics, setDashboardMetrics] = useState({ pipelineNetValue: 0, globalSheetCount: 0 });
  const [claimedSites, setClaimedSites] = useState([]);

  // 📂 Independent Site Collapse/Expand State
  const [openSites, setOpenSites] = useState({});

  const toggleSite = (leadId) => {
    setOpenSites(prev => ({
      ...prev,
      [leadId]: prev[leadId] !== undefined ? !prev[leadId] : true
    }));
  };

  // 🏛️ Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    name: '',
    mobileNo: '',
    siteOwner: '',
    siteAddress: '',
    district: '',
    state: '',
    pincode: '',
    description: ''
  });

  useEffect(() => {
    const querySaaSIntelligence = async () => {
      setLoading(true);
      try {
        if (account_number) {
          const { data: archData } = await supabase
            .from('master_architect')
            .select('influencer_name, mobile_number')
            .eq('account_number', account_number)
            .maybeSingle();

          if (archData) {
            setFormData(prev => ({
              ...prev,
              name: archData.influencer_name || '',
              mobileNo: archData.mobile_number || ''
            }));
          }
        }

        // 📍 Fetching city, district, state, pincode, AND address from leads_master
        const { data: leadsMaster, error: leadsError } = await supabase
          .from('leads_master')
          .select('lead_id, lead_status, city, district, state, pincode, linked_architect, address')
          .not('linked_architect', 'is', null)
          .ilike('linked_architect', `%${account_number}%`);

        if (leadsError) throw leadsError;
        if (!leadsMaster || leadsMaster.length === 0) return;

        const activeIds = leadsMaster.map(l => l.lead_id);
        const coreCities = [...new Set(leadsMaster.map(l => l.city).filter(Boolean))].sort();
        if (coreCities.length > 0) setAvailableCities(coreCities);

        const { data: claimsMaster, error: claimsError } = await supabase
          .from('dmi_claims')
          .select('lead_id, product_code, approved_qty, status')
          .in('lead_id', activeIds);

        if (claimsError) throw claimsError;

        const verifiedClaims = (claimsMaster || []).filter(c => c.status && c.status.toUpperCase() === 'APPROVED');
        const { data: productSkuMaster, error: skuError } = await supabase.from('product_sku_master').select('sku, price');
        if (skuError) throw skuError;

        const aggregationMap = {};
        let netPipelineSum = 0;
        let cumulativeVolumeSum = 0;

        verifiedClaims.forEach(claim => {
          const matchedCatalogRow = executeFuzzySaaSMatch(claim.product_code, productSkuMaster || []);
          if (matchedCatalogRow) {
            const qty = parseFloat(claim.approved_qty) || 0;
            const baselinePrice = parseFloat(matchedCatalogRow.price) || 0;
            
            const standardCode = claim.product_code.trim().toUpperCase();
            const isEligibleForPrototype = !(
              standardCode.includes('INELIGIBLE') || 
              standardCode.includes('PUMAPLY_12MM') || 
              standardCode.includes('PW_DURO PUMAPLY_12MM') || 
              standardCode.includes('DECORATIVE')
            );

            const computedNetLineValue = isEligibleForPrototype ? (qty * baselinePrice) : 0;

            if (isEligibleForPrototype) {
              netPipelineSum += computedNetLineValue;
            }

            cumulativeVolumeSum += qty;

            if (!aggregationMap[claim.lead_id]) aggregationMap[claim.lead_id] = {};
            const uniqueProductKey = claim.product_code;
            if (!aggregationMap[claim.lead_id][uniqueProductKey]) {
              aggregationMap[claim.lead_id][uniqueProductKey] = { 
                productCode: claim.product_code, 
                totalQty: 0, 
                calculatedTotalValue: 0,
                isEligible: isEligibleForPrototype,
                basePrice: baselinePrice
              };
            }

            aggregationMap[claim.lead_id][uniqueProductKey].totalQty += qty;
            aggregationMap[claim.lead_id][uniqueProductKey].calculatedTotalValue += computedNetLineValue;
          }
        });

        setDashboardMetrics({ pipelineNetValue: netPipelineSum, globalSheetCount: cumulativeVolumeSum });

        const claimedPool = [];
        leadsMaster.forEach(lead => {
          const breakdown = Object.values(aggregationMap[lead.lead_id] || {});
          const siteValuation = breakdown.reduce((sum, item) => sum + item.calculatedTotalValue, 0);
          const model = { ...lead, siteValuation, breakdown };
          
          if (breakdown.length > 0) {
            claimedPool.push(model);
          }
        });

        claimedPool.sort((x, y) => y.siteValuation - x.siteValuation);
        setClaimedSites(claimedPool);
      } catch (err) {
        console.error("Tracking pipeline error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (account_number) querySaaSIntelligence();
  }, [account_number]);

  const liveFilteredList = useMemo(() => {
    if (selectedCity === 'ALL') return claimedSites;
    return claimedSites.filter(item => item.city === selectedCity);
  }, [claimedSites, selectedCity]);

  const cumulativeGlobalCount = useMemo(() => {
    return claimedSites.length;
  }, [claimedSites]);

  // 🎲 5-Digit Ticket Generator
  const generateFiveDigitTicket = () => {
    return String(Math.floor(10000 + Math.random() * 90000));
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 📩 Submit Ticket Handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const { name, mobileNo, siteOwner, siteAddress, district, state, pincode, description } = formData;

    if (!siteAddress || !district || !state || !pincode || !name || !mobileNo || !description) {
      setToast({ open: true, message: 'Please complete all required fields.', severity: 'error' });
      return;
    }

    setSubmitting(true);
    const generatedTicket = generateFiveDigitTicket();

    try {
      const payload = {
        account_identity: account_number || 'N/A',
        query_type: 'Missing Site Information',
        query_detail: `Site Address: ${siteAddress} | District: ${district} | State: ${state} | Pincode: ${pincode}${siteOwner ? ` | Site Owner: ${siteOwner}` : ''}${description ? ` | Description: ${description}` : ''}`,
        status: 'pending',
        ticket: generatedTicket,
        name: name,
        mobile_no: mobileNo
      };

      const { error } = await supabase.from('query_support').insert([payload]);

      if (error) throw error;

      setToast({ 
        open: true, 
        message: 'Query submitted successfully! You can see status in Help Desk.', 
        severity: 'success' 
      });

      setIsModalOpen(false);
      setFormData(prev => ({
        ...prev,
        siteOwner: '',
        siteAddress: '',
        district: '',
        state: '',
        pincode: '',
        description: ''
      }));
    } catch (err) {
      console.error('Error creating support ticket:', err.message);
      setToast({ open: true, message: 'Failed to create support query. Please try again.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
        <CircularProgress size={24} thickness={4} sx={{ color: '#C2A478' }} />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={cleanWorkspaceTheme}>
      <CssBaseline />
      <Box sx={{ width: '100%', maxWidth: '950px', mx: 'auto', px: { xs: 2, sm: 3 }, pt: 2 }}>
        
        {/* 🌿 LIGHT & SOOTHING PROMINENT TOP BANNER */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            p: { xs: 2.5, sm: 3 },
            mb: 4,
            bgcolor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #EFECE8',
            borderLeft: '5px solid #C2A478',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                bgcolor: '#FDF8F0',
                borderRadius: '8px',
                border: '1px solid rgba(194, 164, 120, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <InfoIcon sx={{ color: '#C2A478', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: '#111625', fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.05rem' }, mb: 0.3 }}>
                Can't find your project site here?
              </Typography>
              <Typography variant="body2" sx={{ color: '#6E7787', fontSize: '0.825rem', lineHeight: 1.4 }}>
                Report any unlisted active site to sync your project records.
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={() => setIsModalOpen(true)}
            disableRipple
            sx={{
              px: 3,
              py: 1.25,
              bgcolor: '#111625',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.85rem',
              textTransform: 'none',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: '#222B3E',
                boxShadow: 'none'
              }
            }}
          >
            + Report Site
          </Button>
        </Paper>

        {/* 🏁 METRICS LAYOUT BAR */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          width: '100%',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: { xs: 2.5, md: 2 },
          pb: 3, 
          borderBottom: '1px solid #EFECE8', 
          mb: 3
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, 
            gap: { xs: 2.5, sm: 0 }, 
            width: '100%'
          }}>
            <Box sx={{ flex: 1, minWidth: '140px' }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.6, color: '#C2A478' }}>Lifetime Earnings</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1.25rem', sm: '1.4rem' } }}>
                ₹{dashboardMetrics.pipelineNetValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
            
            <Box sx={{ 
              flex: 1, 
              minWidth: '140px',
              pl: { xs: 0, sm: 4 }, 
              pt: { xs: 2, sm: 0 },
              borderLeft: { xs: 'none', sm: '1px solid #EFECE8' }, 
              borderTop: { xs: '1px solid #EFECE8', sm: 'none' }
            }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.6 }}>Total Sheets Delivered</Typography>
              <Typography variant="h6" sx={{ fontWeight: 500, fontSize: { xs: '1.25rem', sm: '1.4rem' } }}>
                {dashboardMetrics.globalSheetCount.toLocaleString()} 
              </Typography>
            </Box>

            <Box sx={{ 
              flex: 1, 
              minWidth: '140px',
              pl: { xs: 0, sm: 4 }, 
              pt: { xs: 2, sm: 0 },
              borderLeft: { xs: 'none', sm: '1px solid #EFECE8' }, 
              borderTop: { xs: '1px solid #EFECE8', sm: 'none' }
            }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.6 }}>Project Sites</Typography>
              <Typography variant="h6" sx={{ fontWeight: 500, fontSize: { xs: '1.25rem', sm: '1.4rem' } }}>
                {cumulativeGlobalCount}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 🎛️ PILL ROW FILTER */}
        <Box sx={{ mb: 5, width: '100%' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%' }}>
            <Button
              onClick={() => setSelectedCity('ALL')}
              disableRipple
              sx={{
                px: 2,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '20px',
                bgcolor: selectedCity === 'ALL' ? '#111625' : '#EFECE8',
                color: selectedCity === 'ALL' ? '#FFFFFF' : '#111625',
                '&:hover': { bgcolor: selectedCity === 'ALL' ? '#111625' : '#E5E2DE' }
              }}
            >
              All Regions ({claimedSites.length})
            </Button>
            {availableCities.map((city) => {
              const cityCount = claimedSites.filter(s => s.city === city).length;
              return (
                <Button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  disableRipple
                  sx={{
                    px: 2,
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '20px',
                    bgcolor: selectedCity === city ? '#111625' : '#EFECE8',
                    color: selectedCity === city ? '#FFFFFF' : '#111625',
                    '&:hover': { bgcolor: selectedCity === city ? '#111625' : '#E5E2DE' }
                  }}
                >
                  {city} ({cityCount})
                </Button>
              );
            })}
          </Box>
        </Box>

        {/* 📋 DATA STREAM RECORD LOG */}
        {liveFilteredList.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', border: '1px dashed #C2A478', borderRadius: '2px' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              No active records found for this zone.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {liveFilteredList.map((site) => {
              const locationDetails = [site.city, site.district, site.state, site.pincode].filter(Boolean).join(', ');
              const fullAddress = site.address || '';
              const isSiteOpen = openSites[site.lead_id] ?? false; 

              return (
                <Box key={site.lead_id} sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  
                  {/* Lead Heading Row - ALWAYS VISIBLE ADDRESS HERE */}
                  <Box 
                    onClick={() => toggleSite(site.lead_id)}
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' }, 
                      justifyContent: 'space-between', 
                      alignItems: { xs: 'flex-start', sm: 'center' }, 
                      gap: { xs: 1.5, sm: 2 },
                      mb: 2,
                      pb: 1.5,
                      borderBottom: '1px solid #EFECE8',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'opacity 0.2s ease',
                      '&:hover': { opacity: 0.85 }
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, pr: { sm: 2 } }}>
                      <Typography sx={{ fontSize: '1.1rem', color: '#111625', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
                        Lead #{site.lead_id}
                      </Typography>
                      {/* 🏠 VISIBLE FULL ADDRESS */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                        <AddressIcon sx={{ color: '#C2A478', fontSize: 16, mt: 0.2, flexShrink: 0 }} />
                        <Typography sx={{ color: '#3A4250', fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {fullAddress || locationDetails || 'No address recorded'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, width: { xs: '100%', sm: 'auto' }, justifyContent: 'space-between' }}>
                      <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.2, color: '#C2A478' }}>AGGREGATED VALUE</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#111625' }}>
                          ₹{site.siteValuation ? site.siteValuation.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                        </Typography>
                      </Box>

                      {/* 🔽 EXPAND/COLLAPSE PILL WITH ARROW */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.75, 
                          px: 1.75, 
                          py: 0.75, 
                          borderRadius: '20px', 
                          bgcolor: isSiteOpen ? '#111625' : '#F4F1EA', 
                          color: isSiteOpen ? '#FFFFFF' : '#111625',
                          border: isSiteOpen ? '1px solid #111625' : '1px solid #E5E2DE',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          flexShrink: 0
                        }}
                      >
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2px' }}>
                          {isSiteOpen ? 'Hide' : 'View'}
                        </Typography>
                        {isSiteOpen ? (
                          <ArrowUpIcon sx={{ fontSize: 18, color: '#C2A478' }} />
                        ) : (
                          <ArrowDownIcon sx={{ fontSize: 18, color: '#111625' }} />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Collapsible Content */}
                  <Collapse in={isSiteOpen} timeout="auto" unmountOnExit={false}>
                    
                    {/* 📍 CITY, DISTRICT, STATE & PINCODE CARD INSIDE HIDE/VIEW */}
                    <Box 
                      sx={{ 
                        p: 2, 
                        mb: 2.5, 
                        bgcolor: '#FFFFFF', 
                        borderRadius: '8px', 
                        border: '1px solid #EFECE8',
                        borderLeft: '4px solid #111625',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      <LocationPinIcon sx={{ color: '#C2A478', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ color: '#C2A478', display: 'block', mb: 0.3, letterSpacing: '0.5px' }}>
                          REGION / DISTRICT / STATE / Pincode
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#111625', fontWeight: 500, lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {locationDetails || 'No location coordinates configured'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Inventory Matrix Grid */}
                    {site.breakdown && site.breakdown.length > 0 ? (
                      <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <Box sx={{ minWidth: '600px', width: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #111625', pb: 1, mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111625', fontSize: '0.65rem', flex: 2.5 }}>PRODUCT CODE</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111625', fontSize: '0.65rem', flex: 1, textAlign: 'right' }}>VOLUME</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111625', fontSize: '0.65rem', flex: 1, textAlign: 'right' }}>UNIT PRICE</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111625', fontSize: '0.65rem', flex: 1, textAlign: 'right' }}>NET VALUE</Typography>
                          </Box>

                          {site.breakdown.map((prod, idx) => {
                            const displayUnitPrice = prod.isEligible ? prod.basePrice : 0;
                            const displayNetValue = prod.isEligible ? prod.calculatedTotalValue : 0;

                            return (
                              <Box 
                                key={idx} 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center',
                                  py: 1.5,
                                  borderBottom: '1px solid #EFECE8',
                                  '&:last-child': { borderBottom: 'none' }
                                }}
                              >
                                <Box sx={{ flex: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, pr: 1 }}>
                                  <Typography noWrap sx={{ fontWeight: 600, color: '#111625', fontSize: '0.85rem', fontFamily: 'ui-monospace, monospace' }}>
                                    {prod.productCode}
                                  </Typography>
                                  <Box sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.3,
                                    px: 0.8,
                                    py: 0.15,
                                    bgcolor: prod.isEligible ? '#E8F5E9' : '#FFEBEE',
                                    color: prod.isEligible ? '#2E7D32' : '#C62828',
                                    borderRadius: '2px',
                                    flexShrink: 0
                                  }}>
                                    {prod.isEligible ? <CheckCircleIcon sx={{ fontSize: 9, color: 'inherit' }} /> : <CancelIcon sx={{ fontSize: 9, color: 'inherit' }} />}
                                    <Typography sx={{ fontSize: '0.525rem', fontWeight: 700, textTransform: 'uppercase', color: 'inherit' }}>
                                      {prod.isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                                    </Typography>
                                  </Box>
                                </Box>

                                <Typography sx={{ flex: 1, textAlign: 'right', color: '#6E7787', fontSize: '0.85rem' }}>
                                  {prod.totalQty.toLocaleString()}
                                </Typography>
                                <Typography sx={{ flex: 1, textAlign: 'right', color: '#3A4250', fontSize: '0.85rem' }}>
                                  ₹{displayUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                                <Typography sx={{ flex: 1, textAlign: 'right', fontWeight: 600, color: '#111625', fontSize: '0.85rem' }}>
                                  ₹{displayNetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>

                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    ) : (
                      <Typography sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.75rem', pt: 1 }}>
                        No transactions recorded.
                      </Typography>
                    )}
                  </Collapse>

                </Box>
              );
            })}
          </Box>
        )}

        {/* =========================================================
            MISSING SITE MODAL POPUP
        ========================================================= */}
        <Dialog
          open={isModalOpen}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setIsModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            elevation: 8,
            sx: {
              borderRadius: '8px',
              border: '1px solid #EFECE8',
              bgcolor: '#FFFFFF'
            }
          }}
          BackdropProps={{
            sx: { backdropFilter: 'blur(3px)', bgcolor: 'rgba(17, 22, 37, 0.4)' }
          }}
        >
          <DialogTitle sx={{ m: 0, p: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: '#F9F8F6', borderRadius: '6px', border: '1px solid #EFECE8', display: 'flex' }}>
                <TicketIcon sx={{ color: '#C2A478', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#111625', lineHeight: 1.2 }}>
                  Report Site
                </Typography>
                <Typography variant="caption" sx={{ color: '#6E7787', textTransform: 'none', letterSpacing: 'normal' }}>
                  Submit site coordinates to create an official support ticket.
                </Typography>
              </Box>
            </Box>
            <IconButton
              aria-label="close"
              onClick={() => setIsModalOpen(false)}
              sx={{ color: '#6E7787', '&:hover': { color: '#111625' } }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: 3, pt: 2 }}>
            <Box component="form" onSubmit={handleFormSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              
              {/* READ-ONLY PREFILLED CONTACT & MOBILE FIELDS */}
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  label="Contact Name"
                  name="name"
                  fullWidth
                  value={formData.name}
                  required
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                  sx={{ bgcolor: '#F5F5F5' }}
                />
                <TextField
                  label="Mobile Number"
                  name="mobileNo"
                  fullWidth
                  value={formData.mobileNo}
                  required
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                  sx={{ bgcolor: '#F5F5F5' }}
                />
              </Box>

              {/* 👤 SITE OWNER FIELD (OPTIONAL) */}
              <TextField
                label="Site Owner (Optional)"
                name="siteOwner"
                fullWidth
                value={formData.siteOwner}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
                placeholder="Enter site owner's name..."
              />

              <TextField
                label="Site Address"
                name="siteAddress"
                multiline
                rows={2}
                fullWidth
                value={formData.siteAddress}
                onChange={handleInputChange}
                required
                variant="outlined"
                size="small"
                placeholder="Enter complete building street address..."
              />

              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  label="District"
                  name="district"
                  fullWidth
                  value={formData.district}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  size="small"
                />
                <TextField
                  label="State"
                  name="state"
                  fullWidth
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  size="small"
                />
              </Box>

              <TextField
                label="Pincode"
                name="pincode"
                fullWidth
                value={formData.pincode}
                onChange={handleInputChange}
                required
                variant="outlined"
                size="small"
              />

              {/* DESCRIPTION / NOTES INPUT FIELD */}
              <TextField
                required
                label="Description / Additional Notes"
                name="description"
                multiline
                rows={3}
                fullWidth
                value={formData.description}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
                placeholder="Describe landmark, missing details, or special requests regarding this site..."
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                <Button
                  onClick={() => setIsModalOpen(false)}
                  sx={{
                    px: 3,
                    py: 1,
                    color: '#6E7787',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#F9F8F6', color: '#111625' }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{
                    px: 3,
                    py: 1,
                    bgcolor: '#111625',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#222B3E', boxShadow: 'none' }
                  }}
                >
                  {submitting ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Submit Query'}
                </Button>
              </Box>

            </Box>
          </DialogContent>
        </Dialog>

        {/* SNACKBAR NOTIFICATION */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity={toast.severity} sx={{ width: '100%', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {toast.message}
          </Alert>
        </Snackbar>

      </Box>
    </ThemeProvider>
  );
};

export default LocationPage;