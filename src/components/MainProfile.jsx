import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  GlobalStyles,
  Box,
  Paper,
  CircularProgress,
  Typography,
  Avatar,
  keyframes
} from '@mui/material';
import {
  AccountBalanceWalletOutlined as TotalAmountIcon,
  CheckCircleOutlined as SettledIcon,
  HourglassTopOutlined as PendingIcon,
  BusinessOutlined as SitesIcon,
  Inventory2Outlined as DeliveredIcon,
  RedeemOutlined as RedemptionIcon,
  ArrowForwardOutlined as NavigationArrow,
  KeyboardArrowDownOutlined as ScrollArrow
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { supabase } from '../supabaseClient';

// ==========================================
// 🎨 CORPORATE PALETTE ARCHITECTURE
// ==========================================
const OBSIDIAN_BLACK = '#0D0D0D';
const COUTURE_CHAMPAGNE = '#F4EAD4';
const AMBIENT_CREAM = '#FCFBF7';
const MUTED_CHARCOAL = '#5A5A5A';
const PURE_WHITE = '#FFFFFF';
const GOLD_ACCENT = '#C5A059';

const KPI_FONT = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const GOLD_GRADIENT_STYLE = {
  background: 'linear-gradient(135deg, #8A6414 0%, #C5A059 40%, #684C0B 70%, #966B24 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
};

// Helper function to cleanly format monetary values with an elegant Rupee symbol
const renderFormattedValue = (value) => {
  if (typeof value === 'string' && value.startsWith('₹')) {
    const numericPart = value.substring(1);
    return (
      <>
        <Box component="span" sx={{ fontWeight: 500, opacity: 0.9, mr: '2px', fontSize: '0.95em' }}>
          ₹
        </Box>
        {numericPart}
      </>
    );
  }
  return value;
};

const corporateTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: AMBIENT_CREAM,
      paper: PURE_WHITE
    },
    primary: { main: OBSIDIAN_BLACK },
    secondary: { main: MUTED_CHARCOAL },
    text: { primary: OBSIDIAN_BLACK, secondary: MUTED_CHARCOAL },
  },
  typography: {
    fontFamily: "'Merriweather', Georgia, serif",
    h2: { 
      fontFamily: "'Merriweather', Georgia, serif", 
      fontWeight: 700, 
      letterSpacing: '-0.01em', 
      color: OBSIDIAN_BLACK 
    },
    h6: { 
      fontFamily: "'Merriweather', Georgia, serif",
      fontWeight: 700, 
      color: OBSIDIAN_BLACK, 
      textTransform: 'uppercase', 
      letterSpacing: '0.08em',
      fontSize: '0.8rem'
    },
    body1: { fontFamily: "'Merriweather', Georgia, serif", fontSize: '0.9rem', lineHeight: 1.6, color: OBSIDIAN_BLACK },
    body2: { fontFamily: "'Merriweather', Georgia, serif", fontSize: '0.85rem', lineHeight: 1.5, color: MUTED_CHARCOAL },
  },
  shape: { borderRadius: 16 },
});

const wordReveal = keyframes`
  0% { 
    opacity: 0; 
    filter: blur(8px); 
    transform: translateY(15px); 
  }
  100% { 
    opacity: 1; 
    filter: blur(0); 
    transform: translateY(0); 
  }
`;

const bounceAnimation = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
`;

const formatArchitectName = (name) => {
  if (!name) return '';
  let formatted = name.trim();
  
  if (formatted.toUpperCase() === 'RAJUSHARMA') return 'RAJU SHARMA';
  if (formatted.toUpperCase() === 'MASTERARCHITECT') return 'MASTER ARCHITECT';
  
  formatted = formatted
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

  const tokens = formatted.split(/\s+/);
  const totalLength = tokens.length;
  if (totalLength % 2 === 0) {
    const half = totalLength / 2;
    const firstHalf = tokens.slice(0, half).join(' ').toUpperCase();
    const secondHalf = tokens.slice(half).join(' ').toUpperCase();
    if (firstHalf === secondHalf) {
      return tokens.slice(0, half).join(' ');
    }
  }
  
  return formatted;
};

const DashboardPage = ({ account_number }) => {
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState({
    architectName: 'MASTER ARCHITECT', totalSheets: 0, totalPayout: 0, uniqueLeadsCount: 0,
    bifurcation: { PW: { total: 0 }, BB: { total: 0 }, FD: { total: 0 }, Decorative: { total: 0 }, Other: { total: 0 } }
  });
  const [remittanceData, setRemittanceData] = useState({ paid: 0, pending: 0, tier: 'Silver' });

  const categoryDistributionRef = useRef(null);

  // Scroll to top on page mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchLedgerMetrics = async () => {
      setLoading(true);
      try {
        const { data: cData, error: cError } = await supabase
          .from('commission_ledger')
          .select('architect_name, product_sku, total_eligible_sheets, total_payout_amount, lead_id')
          .ilike('architect_name', `${account_number}%`);

        if (cError) throw cError;

        let computedSheets = 0, computedPayout = 0, resolvedName = 'MASTER ARCHITECT';
        const distinctLeads = new Set();
        const taxonomy = { PW: { total: 0 }, BB: { total: 0 }, FD: { total: 0 }, Decorative: { total: 0 }, Other: { total: 0 } };

        if (cData && cData.length > 0) {
          const primaryRowName = cData[0].architect_name;
          if (primaryRowName && primaryRowName.includes('|')) resolvedName = primaryRowName.split('|')[1].trim();

          cData.forEach(row => {
            const sheets = Number(row.total_eligible_sheets) || 0;
            const payout = Number(row.total_payout_amount) || 0;
            computedSheets += sheets; computedPayout += payout;
            if (row.lead_id) distinctLeads.add(row.lead_id);
            
            const rawSku = row.product_sku ? String(row.product_sku).trim() : '';
            const skuUpper = rawSku.toUpperCase();
            let matchedBucket = 'Other';
            if (skuUpper.startsWith('PW') || skuUpper.includes('PUMAPLY') || skuUpper.includes('PLY')) matchedBucket = 'PW';
            else if (skuUpper.startsWith('BB') || skuUpper.includes('BOARD')) matchedBucket = 'BB';
            else if (skuUpper.startsWith('FD') || skuUpper.includes('DOOR')) matchedBucket = 'FD';
            else if (skuUpper.includes('DECORATIVE')) matchedBucket = 'Decorative';

            taxonomy[matchedBucket].total += sheets;
          });
        }

        const { data: remData, error: remError } = await supabase
          .from('remittances')
          .select('amount, status')
          .eq('account_number', account_number);
          
        let paidAmount = 0;
        if (remData && !remError) remData.forEach(r => { if (r.status === 'Paid') paidAmount += (Number(r.amount) || 0); });
        const pendingAmount = computedPayout - paidAmount;
        
        setLedgerData({ architectName: resolvedName, totalSheets: computedSheets, totalPayout: computedPayout, uniqueLeadsCount: distinctLeads.size, bifurcation: taxonomy });
        setRemittanceData({ paid: paidAmount, pending: pendingAmount });
      } catch (err) { 
        console.error('Core metric parser failure:', err); 
      } finally { 
        setLoading(false); 
      }
    };
    if (account_number) fetchLedgerMetrics();
  }, [account_number]);

  const graphData = useMemo(() => {
    const labelMapping = {
      PW: 'Plywood',
      BB: 'Blockboard',
      FD: 'Flush Door',
      Decorative: 'Decorative'
    };
    return [
      { name: labelMapping.PW, sheets: ledgerData.bifurcation.PW.total },
      { name: labelMapping.BB, sheets: ledgerData.bifurcation.BB.total },
      { name: labelMapping.FD, sheets: ledgerData.bifurcation.FD.total },
      { name: labelMapping.Decorative, sheets: ledgerData.bifurcation.Decorative.total }
    ];
  }, [ledgerData.bifurcation]);

  const scrollToCategoryDistribution = () => {
    categoryDistributionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={30} thickness={3} sx={{ color: OBSIDIAN_BLACK }} />
      </Box>
    );
  }

  const financialKpis = [
    { title: 'lifetime earnings', value: `₹${ledgerData.totalPayout.toLocaleString()}`, unit: 'INR', icon: <TotalAmountIcon sx={{ color: '#1976d2', fontSize: 20 }} />, titleColor: '#1976d2' },
    { title: 'Amount Settled', value: `₹${remittanceData.paid.toLocaleString()}`, unit: 'INR', icon: <SettledIcon sx={{ color: '#2e7d32', fontSize: 20 }} />, titleColor: '#2e7d32' },
    { title: 'Amount Available For Redemption', value: `₹${remittanceData.pending.toLocaleString()}`, unit: 'INR', icon: <PendingIcon sx={{ color: '#d32f2f', fontSize: 20 }} />, titleColor: '#d32f2f' }
  ];

  const structuralKpis = [
    { title: 'Site Details', value: ledgerData.uniqueLeadsCount.toLocaleString(), unit: 'Locations', icon: <SitesIcon sx={{ color: OBSIDIAN_BLACK, fontSize: 20 }} />, link: '/locations' },
    { title: 'Total Sheet Delivered', value: ledgerData.totalSheets.toLocaleString(), unit: 'Units', icon: <DeliveredIcon sx={{ color: OBSIDIAN_BLACK, fontSize: 20 }} />, isScrollTrigger: true },
    { title: 'Click Here For Redemption', icon: <RedemptionIcon sx={{ color: OBSIDIAN_BLACK, fontSize: 20 }} />, link: '/remittance' }
  ];

  const kpiPaperCardStyles = {
    p: 3, 
    width: '100%',
    height: '100%',
    display: 'flex', 
    flexDirection: 'column',
    justify: 'space-between',
    alignItems: 'flex-start',
    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.45) 100%)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.02), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7)',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    '&:hover': { 
      borderColor: GOLD_ACCENT,
      background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.6) 100%)',
      boxShadow: '0 12px 36px 0 rgba(197, 160, 89, 0.15)',
      '& .action-arrow-icon': { transform: 'translateX(3px)', color: OBSIDIAN_BLACK },
      '& .scroll-arrow-icon': { animation: `${bounceAnimation} 1s infinite ease-in-out`, color: OBSIDIAN_BLACK }
    }
  };

  return (
    <ThemeProvider theme={corporateTheme}>
      <CssBaseline />
      <GlobalStyles styles={`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Merriweather:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');
      `} />
      <Box sx={{ width: '100%', p: 0 }}>
        
        {/* ================= HEADER HERO ROW ================= */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' }, 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', lg: 'center' }, 
          gap: 4, 
          mb: 5,
          width: '100%'
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
            <Box sx={{ display: 'flex', gap: '0.8em', flexWrap: 'wrap', mb: 2 }}>
              {['Welcome', 'To', 'DUROPLY'].map((word, i) => {
                const isBrandWord = word === 'DUROPLY';
                return (
                  <Typography
                    variant="h2"
                    key={word}
                    sx={{
                      fontSize: { xs: '1.8rem', md: '2.4rem' },
                      fontFamily: "'Merriweather', Georgia, serif",
                      display: 'inline-block',
                      opacity: 0,
                      animation: `${wordReveal} 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                      animationDelay: `${i * 0.1}s`,
                      background: isBrandWord 
                        ? 'linear-gradient(135deg, #8A6414 0%, #C5A059 40%, #684C0B 70%, #966B24 100%)' 
                        : 'none',
                      backgroundSize: isBrandWord ? '200% auto' : 'auto',
                      WebkitBackgroundClip: isBrandWord ? 'text' : 'unset',
                      WebkitTextFillColor: isBrandWord ? 'transparent' : 'unset',
                      color: isBrandWord ? 'transparent' : OBSIDIAN_BLACK,
                      fontWeight: isBrandWord ? 700 : 400, 
                      letterSpacing: isBrandWord ? '-0.01em' : 'inherit',
                    }}
                  >
                    {isBrandWord ? (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                        DUROPLY
                        <Box component="span" sx={{ fontSize: '0.35em', fontWeight: 400, color: OBSIDIAN_BLACK, WebkitTextFillColor: OBSIDIAN_BLACK, marginLeft: '2px', lineHeight: 1 }}>
                          ®
                        </Box>
                      </Box>
                    ) : (
                      word
                    )}
                  </Typography>
                );
              })}
            </Box>
          </Box>

          {/* ================= IDENTITY CARD SPECIFICATION ================= */}
          <Box sx={{ 
            width: { xs: '100%', sm: '350px', md: '365px' }, 
            height: '180px',
            background: 'linear-gradient(180deg, #1A1A1A 0%, #0D0D0D 100%)',
            backgroundImage: 'repeating-linear-gradient(90deg, rgba(197, 160, 89, 0.08) 0px, rgba(197, 160, 89, 0.08) 2px, transparent 2px, transparent 40px, rgba(255, 255, 255, 0.06) 40px, rgba(255, 255, 255, 0.06) 42px, transparent 42px, transparent 80px), linear-gradient(180deg, #1A1A1A 0%, #0D0D0D 100%)',
            border: '1px solid rgba(197, 160, 89, 0.35)',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.3)',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            alignSelf: { xs: 'stretch', lg: 'center' },
            borderRadius: '12px',
            position: 'relative',
            boxSizing: 'border-box'
          }}>
            <Box>
              <Typography sx={{ 
                fontFamily: KPI_FONT,
                fontWeight: 600, 
                fontSize: '1.2rem', 
                letterSpacing: '0.02em', 
                textTransform: 'uppercase',
                ...GOLD_GRADIENT_STYLE
              }}>
                {formatArchitectName(ledgerData.architectName)}
              </Typography>
            </Box>

            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start', 
              width: '100%',
              mt: 'auto'
            }}>
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ 
                  fontFamily: KPI_FONT, 
                  fontSize: '0.6rem', 
                  fontWeight: 600, 
                  color: 'rgba(255, 255, 255, 0.45)', 
                  letterSpacing: '0.06em', 
                  mb: 0.3,
                  lineHeight: 1
                }}>
                  ACCOUNT NUMBER
                </Typography>
                <Typography sx={{ 
                  color: '#C5A059', 
                  fontFamily: 'monospace', 
                  fontSize: '0.95rem', 
                  fontWeight: 500, 
                  lineHeight: 1.2 
                }}>
                  {account_number ? String(account_number).replace(/(.{4})/g, '$1 ').trim() : '2511 0011 31'}
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ 
                  fontFamily: KPI_FONT, 
                  fontSize: '0.6rem', 
                  fontWeight: 600, 
                  color: 'rgba(255, 255, 255, 0.45)', 
                  letterSpacing: '0.06em', 
                  mb: 0.3,
                  lineHeight: 1
                }}>
                  VOLUME POOL
                </Typography>
                <Typography sx={{ 
                  color: '#FFFFFF', 
                  fontFamily: KPI_FONT, 
                  fontSize: '1.15rem', 
                  fontWeight: 600, 
                  lineHeight: 1.2 
                }}>
                  <Box component="span" sx={{ fontWeight: 500, opacity: 0.9, mr: '2px' }}>₹</Box>
                  {ledgerData.totalPayout.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ================= LEVEL 1 FINANCIAL CARDS LAYER ================= */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, 
          gap: 3, 
          width: '100%', 
          mb: 3 
        }}>
          {financialKpis.map((kpi, idx) => (
            <Paper 
              key={idx}
              sx={kpiPaperCardStyles}
            >
              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', width: '100%', mb: 2 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(0,0,0,0.015)', border: '1px solid rgba(255,255,255,0.6)' }}>
                    {kpi.icon}
                  </Avatar>
                </Box>
                <Typography sx={{ 
                  fontFamily: KPI_FONT, 
                  color: kpi.titleColor, 
                  fontSize: '0.775rem', 
                  fontWeight: 600, 
                  letterSpacing: '0.05em', 
                  textTransform: 'uppercase', 
                  mb: 0.8 
                }}>
                  {kpi.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography sx={{ 
                    fontFamily: KPI_FONT, 
                    fontSize: '1.5rem', 
                    color: OBSIDIAN_BLACK, 
                    fontWeight: 600, 
                    letterSpacing: '-0.01em' 
                  }}>
                    {renderFormattedValue(kpi.value)}
                  </Typography>
                  <Typography sx={{ 
                    fontFamily: KPI_FONT, 
                    fontSize: '0.725rem', 
                    color: MUTED_CHARCOAL, 
                    fontWeight: 500, 
                    ml: 0.5 
                  }}>
                    {kpi.unit}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* ================= LEVEL 2 STRUCTURAL CARDS LAYER ================= */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, 
          gap: 3, 
          width: '100%', 
          mb: 5 
        }}>
          {structuralKpis.map((kpi, idx) => {
            const isLink = !!kpi.link;
            const isScroll = !!kpi.isScrollTrigger;
            const isRedemptionButton = kpi.title === 'Click Here For Redemption';

            return (
              <Paper 
                key={idx}
                component={isLink ? Link : 'div'} 
                to={isLink ? kpi.link : undefined} 
                onClick={() => {
                  if (isScroll) scrollToCategoryDistribution();
                  if (isLink) window.scrollTo(0, 0);
                }}
                sx={{ 
                  ...kpiPaperCardStyles,
                  position: 'relative',
                  textDecoration: 'none', 
                  cursor: (isLink || isScroll) ? 'pointer' : 'default'
                }}
              >
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 2 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(0,0,0,0.015)', border: '1px solid rgba(255,255,255,0.6)' }}>
                      {kpi.icon}
                    </Avatar>
                    {isLink && (
                      <NavigationArrow 
                        className="action-arrow-icon"
                        sx={{ color: MUTED_CHARCOAL, fontSize: 16, transition: 'all 0.2s ease' }} 
                      />
                    )}
                    {isScroll && (
                      <ScrollArrow 
                        className="scroll-arrow-icon"
                        sx={{ color: MUTED_CHARCOAL, fontSize: 20, transition: 'all 0.2s ease' }} 
                      />
                    )}
                  </Box>

                  <Typography sx={{ 
                    fontFamily: KPI_FONT, 
                    color: MUTED_CHARCOAL, 
                    fontSize: '0.775rem', 
                    fontWeight: 600, 
                    letterSpacing: '0.05em', 
                    textTransform: 'uppercase', 
                    mb: 0.8 
                  }}>
                    {kpi.title}
                  </Typography>
                </Box>

                {isRedemptionButton ? (
                  <Box sx={{ 
                    width: '100%', 
                    mt: 3, 
                    py: 1.2, 
                    px: 2, 
                    bgcolor: OBSIDIAN_BLACK, 
                    color: PURE_WHITE, 
                    borderRadius: '8px', 
                    textAlign: 'center',
                    fontFamily: KPI_FONT,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#262626'
                    }
                  }}>
                    Redeem Now
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 2 }}>
                    <Typography sx={{ 
                      fontFamily: KPI_FONT, 
                      fontSize: '1.5rem', 
                      color: OBSIDIAN_BLACK, 
                      fontWeight: 600, 
                      letterSpacing: '-0.01em' 
                    }}>
                      {renderFormattedValue(kpi.value)}
                    </Typography>
                    <Typography sx={{ 
                      fontFamily: KPI_FONT, 
                      fontSize: '0.725rem', 
                      color: MUTED_CHARCOAL, 
                      fontWeight: 500, 
                      ml: 0.5 
                    }}>
                      {kpi.unit}
                    </Typography>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>

        {/* ================= MATERIAL DISTRIBUTION ANALYSIS ================= */}
        <Box ref={categoryDistributionRef} sx={{ mb: 2, width: '100%', scrollMarginTop: '24px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', mb: 3 }}>
            <Typography variant="h6" sx={{ fontFamily: "'Merriweather', serif", color: OBSIDIAN_BLACK, textTransform: 'none', letterSpacing: '0.01em', fontSize: '1.05rem', fontWeight: 700 }}>
              Category Distribution
            </Typography>
          </Box>

          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, 
            gap: 3, 
            width: '100%', 
            mb: 4 
          }}>
            {graphData.map((category) => (
              <Box key={category.name} sx={{ 
                width: '100%',
                p: 2.5,
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-start',
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.3) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.01)',
                transition: 'all 0.25s ease',
                '&:hover': { 
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderColor: GOLD_ACCENT,     
                  transform: 'translateY(-1px)',
                  '& .cat-metric': { color: 'black' }
                }
              }}>
                <Typography className="cat-label" sx={{ fontFamily: KPI_FONT, color: OBSIDIAN_BLACK, fontSize: '0.825rem', fontWeight: 600, letterSpacing: '0.01em', mb: 0.5 }}>
                  {category.name}
                </Typography>
                <Typography className="cat-metric" sx={{ fontFamily: KPI_FONT, color: OBSIDIAN_BLACK, fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.01em', transition: 'color 0.2s' }}>
                  {category.sheets.toLocaleString()}
                </Typography>
                <Typography className="cat-unit" sx={{ fontFamily: KPI_FONT, fontSize: '0.65rem', color: MUTED_CHARCOAL, textTransform: 'uppercase', mt: 0.5, letterSpacing: '0.02em' }}>
                  Total Sheets
                </Typography>
              </Box>
            ))}
          </Box>

          <Paper sx={{ 
            p: { xs: 2, md: 3 }, 
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.2) 100%)', 
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.4)', 
            boxShadow: 'none',
            overflow: 'hidden',
            width: '100%'
          }}>
            <Box sx={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={graphData} 
                  margin={{ top: 20, right: 10, left: -25, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="corporateBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={OBSIDIAN_BLACK} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={COUTURE_CHAMPAGNE} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="rgba(0, 0, 0, 0.03)" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: OBSIDIAN_BLACK, fontSize: 11, fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis 
                    tick={{ fill: MUTED_CHARCOAL, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.01)' }}
                    contentStyle={{ 
                      backgroundColor: OBSIDIAN_BLACK, 
                      border: 'none',
                      color: PURE_WHITE,
                      fontFamily: KPI_FONT,
                      fontSize: '0.8rem',
                      padding: '10px 14px',
                      borderRadius: '8px'
                    }}
                    itemStyle={{ color: COUTURE_CHAMPAGNE, fontSize: '0.95rem', marginTop: '2px', fontWeight: 400 }}
                    formatter={(value) => [value.toLocaleString(), 'Sheets Volume']}
                  />
                  <Bar 
                    dataKey="sheets" 
                    fill="url(#corporateBarGradient)"
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  >
                    {graphData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        style={{ transition: 'opacity 0.2s ease' }}
                        onMouseEnter={(e) => e.target.style.opacity = 0.85}
                        onMouseLeave={(e) => e.target.style.opacity = 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default DashboardPage;


















// import React, { useState, useEffect, useMemo } from 'react';
// import { Link } from 'react-router-dom';
// import {
//   ThemeProvider,
//   createTheme,
//   CssBaseline,
//   Box,
//   Grid,
//   Paper,
//   CircularProgress,
//   Typography,
//   Avatar,
//   keyframes
// } from '@mui/material';
// import {
//   LayersOutlined as ProductIcon,
//   LinkOutlined as LinkIcon,
//   AccountBalanceWalletOutlined as WalletIcon,
//   PendingActionsOutlined as PendingIcon,
//   WorkspacePremiumOutlined as PremiumIcon
// } from '@mui/icons-material';
// import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
// import {
//   BarChart,
//   Bar,
//   Cell,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer
// } from 'recharts';
// import { supabase } from '../supabaseClient';

// // ==========================================
// // 🎨 LUXURY NATURAL PALETTE
// // ==========================================
// const OBSIDIAN_BLACK = '#0D0D0D';
// const COUTURE_CHAMPAGNE = '#F4EAD4';
// const AMBIENT_CREAM = '#FCFBF7';
// const MUTED_CHARCOAL = '#5A5A5A';
// const PURE_WHITE = '#FFFFFF';

// // Authentic raw plywood/blockboard textures with layered core plies
// const RAW_PLYWOOD_GRAIN = `
//   repeating-linear-gradient(90deg, rgba(94, 68, 43, 0.02) 0px, rgba(94, 68, 43, 0.02) 4px, transparent 4px, transparent 24px),
//   repeating-linear-gradient(185deg, rgba(255, 255, 255, 0.15) 0px, rgba(255, 255, 255, 0.15) 2px, transparent 2px, transparent 14px),
//   linear-gradient(145deg, #ECDDC7 0%, #DFCDBC 40%, #D5C0AC 70%, #C9B39F 100%)
// `;

// const PLYWOOD_CORE_LAYERS = 'inset 0 1px 2px rgba(255,255,255,0.5), inset -4px -4px 0px rgba(110, 85, 60, 0.15), 0 16px 40px rgba(54, 43, 33, 0.12)';

// const luxuryDashboardTheme = createTheme({
//   palette: {
//     mode: 'light',
//     background: {
//       default: AMBIENT_CREAM,
//       paper: PURE_WHITE
//     },
//     primary: { main: OBSIDIAN_BLACK },
//     secondary: { main: MUTED_CHARCOAL },
//     text: { primary: OBSIDIAN_BLACK, secondary: MUTED_CHARCOAL },
//   },
//   typography: {
//     fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
//     h2: { 
//       fontFamily: "'Playfair Display', 'Didot', 'Georgia', serif", 
//       fontWeight: 500, 
//       letterSpacing: '-0.02em', 
//       color: OBSIDIAN_BLACK 
//     },
//     h6: { 
//       fontFamily: "'Plus Jakarta Sans', sans-serif",
//       fontWeight: 600, 
//       color: OBSIDIAN_BLACK, 
//       textTransform: 'uppercase', 
//       letterSpacing: '0.15em',
//       fontSize: '0.85rem'
//     },
//     body1: { fontSize: '0.95rem', lineHeight: 1.6, color: OBSIDIAN_BLACK },
//     body2: { fontSize: '0.875rem', lineHeight: 1.5, color: MUTED_CHARCOAL },
//   },
//   shape: { borderRadius: 24 },
// });

// const wordReveal = keyframes`
//   0% { 
//     opacity: 0; 
//     filter: blur(10px); 
//     transform: translateY(20px); 
//   }
//   100% { 
//     opacity: 1; 
//     filter: blur(0); 
//     transform: translateY(0); 
//   }
// `;

// const DashboardPage = ({ account_number }) => {
//   const [loading, setLoading] = useState(true);
//   const [ledgerData, setLedgerData] = useState({
//     architectName: 'MASTER ARCHITECT', totalSheets: 0, totalPayout: 0, uniqueLeadsCount: 0,
//     bifurcation: { PW: { total: 0 }, BB: { total: 0 }, FD: { total: 0 }, Decorative: { total: 0 }, Other: { total: 0 } }
//   });
//   const [remittanceData, setRemittanceData] = useState({ paid: 0, pending: 0, tier: 'Silver' });

//   useEffect(() => {
//     const fetchLedgerMetrics = async () => {
//       setLoading(true);
//       try {
//         const { data: cData, error: cError } = await supabase
//           .from('commission_ledger')
//           .select('architect_name, product_sku, total_eligible_sheets, total_payout_amount, lead_id')
//           .ilike('architect_name', `${account_number}%`);

//         if (cError) throw cError;

//         let computedSheets = 0, computedPayout = 0, resolvedName = 'MASTER ARCHITECT';
//         const distinctLeads = new Set();
//         const taxonomy = { PW: { total: 0 }, BB: { total: 0 }, FD: { total: 0 }, Decorative: { total: 0 }, Other: { total: 0 } };

//         if (cData && cData.length > 0) {
//           const primaryRowName = cData[0].architect_name;
//           if (primaryRowName && primaryRowName.includes('|')) resolvedName = primaryRowName.split('|')[1].trim();

//           cData.forEach(row => {
//             const sheets = Number(row.total_eligible_sheets) || 0;
//             const payout = Number(row.total_payout_amount) || 0;
//             computedSheets += sheets; computedPayout += payout;
//             if (row.lead_id) distinctLeads.add(row.lead_id);
            
//             const rawSku = row.product_sku ? String(row.product_sku).trim() : '';
//             const skuUpper = rawSku.toUpperCase();
//             let matchedBucket = 'Other';
//             if (skuUpper.startsWith('PW') || skuUpper.includes('PUMAPLY') || skuUpper.includes('PLY')) matchedBucket = 'PW';
//             else if (skuUpper.startsWith('BB') || skuUpper.includes('BOARD')) matchedBucket = 'BB';
//             else if (skuUpper.startsWith('FD') || skuUpper.includes('DOOR')) matchedBucket = 'FD';
//             else if (skuUpper.includes('DECORATIVE')) matchedBucket = 'Decorative';

//             taxonomy[matchedBucket].total += sheets;
//           });
//         }

//         const { data: remData, error: remError } = await supabase
//           .from('remittances')
//           .select('amount, status')
//           .eq('account_number', account_number);
          
//         let paidAmount = 0;
//         if (remData && !remError) remData.forEach(r => { if (r.status === 'Paid') paidAmount += (Number(r.amount) || 0); });
//         const pendingAmount = computedPayout - paidAmount;
        
//         let tier = 'Silver';
//         if (computedPayout > 25000 && computedPayout < 100000) tier = 'Gold';
//         if (computedPayout >= 100000) tier = 'Platinum';
        
//         setLedgerData({ architectName: resolvedName, totalSheets: computedSheets, totalPayout: computedPayout, uniqueLeadsCount: distinctLeads.size, bifurcation: taxonomy });
//         setRemittanceData({ paid: paidAmount, pending: pendingAmount, tier });
//       } catch (err) { 
//         console.error('Core metric parser failure:', err); 
//       } finally { 
//         setLoading(false); 
//       }
//     };
//     if (account_number) fetchLedgerMetrics();
//   }, [account_number]);

//   const graphData = useMemo(() => {
//     const labelMapping = {
//       PW: 'Plywood',
//       BB: 'Blockboard',
//       FD: 'Flush Door',
//       Decorative: 'Decorative'
//     };
//     return [
//       { name: labelMapping.PW, sheets: ledgerData.bifurcation.PW.total },
//       { name: labelMapping.BB, sheets: ledgerData.bifurcation.BB.total },
//       { name: labelMapping.FD, sheets: ledgerData.bifurcation.FD.total },
//       { name: labelMapping.Decorative, sheets: ledgerData.bifurcation.Decorative.total }
//     ];
//   }, [ledgerData.bifurcation]);

//   if (loading) {
//     return (
//       <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
//         <CircularProgress size={40} thickness={3} sx={{ color: OBSIDIAN_BLACK }} />
//       </Box>
//     );
//   }

//   const financialKpis = [
//     { title: 'Pending Clearance', value: `₹${remittanceData.pending.toLocaleString()}`, unit: 'INR Balance', icon: <PendingIcon sx={{ color: OBSIDIAN_BLACK }} />, gradient: 'linear-gradient(135deg, #FFFFFF 0%, #FDFBF7 100%)' },
//     { title: 'Remitted Capital', value: `₹${remittanceData.paid.toLocaleString()}`, unit: 'INR Settled', icon: <WalletIcon sx={{ color: OBSIDIAN_BLACK }} />, gradient: 'linear-gradient(135deg, #FFFFFF 0%, #F5F7FA 100%)' },
//     { title: 'Total Payout Pool', value: `₹${ledgerData.totalPayout.toLocaleString()}`, unit: 'INR Volume', icon: <PremiumIcon sx={{ color: OBSIDIAN_BLACK }} />, gradient: 'linear-gradient(135deg, #FFF9EE 0%, #F9F3E6 100%)' }
//   ];

//   const structuralKpis = [
//     { title: 'Active Channels', value: ledgerData.uniqueLeadsCount.toLocaleString(), unit: 'Secured Leads', icon: <LinkIcon sx={{ color: OBSIDIAN_BLACK, fontSize: 20 }} />, link: '/locations' },
//     { title: 'Cumulative Volume', value: ledgerData.totalSheets.toLocaleString(), unit: 'Total Sheets', icon: <ProductIcon sx={{ color: OBSIDIAN_BLACK, fontSize: 20 }} /> }
//   ];

//   return (
//     <ThemeProvider theme={luxuryDashboardTheme}>
//       <CssBaseline />
//       <Box sx={{ p: { xs: 1, md: 2 } }}>
        
//         {/* ================= HEADER HERO ROW ================= */}
//         <Box sx={{ 
//           display: 'flex', 
//           flexDirection: { xs: 'column', md: 'row' }, 
//           justifyContent: 'space-between', 
//           alignItems: { xs: 'flex-start', md: 'center' }, 
//           gap: 4, 
//           mb: 6, 
//           mt: 2 
//         }}>
//           <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
//             <Typography variant="h6" sx={{ color: MUTED_CHARCOAL, mb: 1.5, fontWeight: 500, opacity: 0.8 }}>
//               Metrics & Distribution Insights
//             </Typography>
            
//             <Box sx={{ display: 'flex', gap: '0.3em', flexWrap: 'wrap', mb: 3 }}>
//               {['Welcome', 'To', 'The', 'DUROPLY'].map((word, i) => {
//                 const isBrandWord = word === 'DUROPLY';
//                 return (
//                   <Typography
//                     variant="h2"
//                     key={word}
//                     sx={{
//                       fontSize: { xs: '2rem', md: '2.8rem' },
//                       display: 'inline-block',
//                       opacity: 0,
//                       animation: `${wordReveal} 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
//                       animationDelay: `${i * 0.15}s`,
//                       background: isBrandWord 
//                         ? 'linear-gradient(135deg, #8A6414 0%, #C5A059 40%, #684C0B 70%, #966B24 100%)' 
//                         : 'none',
//                       backgroundSize: isBrandWord ? '200% auto' : 'auto',
//                       WebkitBackgroundClip: isBrandWord ? 'text' : 'unset',
//                       WebkitTextFillColor: isBrandWord ? 'transparent' : 'unset',
//                       color: isBrandWord ? 'transparent' : OBSIDIAN_BLACK,
//                       fontWeight: isBrandWord ? 900 : 'inherit', 
//                       letterSpacing: isBrandWord ? '-0.02em' : 'inherit',
//                       transform: isBrandWord ? 'scaleY(0.95)' : 'none',
//                       filter: isBrandWord ? 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.15))' : 'none',
//                     }}
//                   >
//                     {isBrandWord ? (
//                       <Box component="span" sx={{ display: 'inline-flex', alignItems: 'flex-start' }}>
//                         DUROPLY
//                         <Box 
//                           component="span" 
//                           sx={{ 
//                             fontSize: '0.35em',
//                             fontWeight: 400,
//                             color: OBSIDIAN_BLACK,
//                             WebkitTextFillColor: OBSIDIAN_BLACK,
//                             marginLeft: '2px',
//                             marginTop: '-2px',
//                             lineHeight: 1
//                           }}
//                         >
//                           ®
//                         </Box>
//                       </Box>
//                     ) : (
//                       word
//                     )}
//                   </Typography>
//                 );
//               })}
//             </Box>

//             <Box sx={{ 
//               display: 'inline-flex', 
//               alignItems: 'center', 
//               gap: 1.5,
//               border: '1px solid rgba(0, 0, 0, 0.06)',
//               padding: '6px 20px',
//               borderRadius: '50px',
//               backgroundColor: 'rgba(255, 255, 255, 0.6)',
//               backdropFilter: 'blur(10px)'
//             }}>
//               <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: OBSIDIAN_BLACK, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
//                 {ledgerData.architectName}
//               </Typography>
//               <Box sx={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: MUTED_CHARCOAL }} />
//               <Typography sx={{ fontSize: '0.8rem', color: MUTED_CHARCOAL, fontWeight: 500 }}>
//                 Tier Status: {remittanceData.tier}
//               </Typography>
//             </Box>
//           </Box>

//           {/* ================= NATURAL STRUCTURAL WOOD SHEET PANEL ================= */}
//           <Box 
//             sx={{ 
//               width: { xs: '100%', sm: '440px' },
//               height: '210px',
//               borderRadius: '4px', // Hard squared structural core aesthetic like true plywood sheets
//               background: RAW_PLYWOOD_GRAIN,
//               boxShadow: PLYWOOD_CORE_LAYERS,
//               p: 3.5,
//               display: 'flex',
//               flexDirection: 'column',
//               justifyContent: 'space-between',
//               position: 'relative',
//               alignSelf: { xs: 'stretch', md: 'auto' },
//               border: '1px solid #BAA590',
//               overflow: 'hidden',
//               // Clean subtle stamp overlay representing a manufacturing specification stamp
//               '&::before': {
//                 content: '"DUROPLY IND. SPECIFICATION SHEET"',
//                 position: 'absolute',
//                 bottom: '12px',
//                 right: '16px',
//                 fontSize: '0.52rem',
//                 fontFamily: 'monospace',
//                 color: 'rgba(54, 43, 33, 0.35)',
//                 letterSpacing: '2px',
//                 fontWeight: 700
//               }
//             }}
//           >
//             {/* Top Row: Technical Stamp Information */}
//             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
//               <Box>
//                 <Typography 
//                   variant="caption" 
//                   sx={{ 
//                     color: 'rgba(30, 24, 18, 0.5)', 
//                     letterSpacing: '0.1em', 
//                     fontSize: '0.6rem', 
//                     fontWeight: 700,
//                     textTransform: 'uppercase',
//                     display: 'block',
//                     mb: 0.5
//                   }}
//                 >
//                   Architectural Core / Premium Grade
//                 </Typography>
//                 <Typography 
//                   sx={{ 
//                     color: '#2A1F16', 
//                     fontFamily: "'Playfair Display', serif", 
//                     fontSize: '1.4rem', 
//                     fontWeight: 700, 
//                     letterSpacing: '0.02em',
//                     textTransform: 'uppercase'
//                   }}
//                 >
//                   {ledgerData.architectName}
//                 </Typography>
//               </Box>

//               <Box 
//                 sx={{ 
//                   border: '1.5px dashed rgba(54, 43, 33, 0.4)', 
//                   px: 1.5, py: 0.5,
//                   borderRadius: '2px',
//                   backgroundColor: 'rgba(255, 255, 255, 0.15)'
//                 }}
//               >
//                 <Typography sx={{ color: '#2A1F16', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '1px', fontFamily: 'monospace' }}>
//                   {remittanceData.tier.toUpperCase()} CORE
//                 </Typography>
//               </Box>
//             </Box>
            
//             {/* Bottom Row: Direct Burned / Laser Etched Financial Metrics */}
//             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1 }}>
//               <Box>
//                 <Typography variant="caption" sx={{ color: 'rgba(30, 24, 18, 0.5)', fontSize: '0.55rem', letterSpacing: '0.12em', display: 'block', fontWeight: 700 }}>
//                   BATCH LEDGER INDEX
//                 </Typography>
//                 <Typography sx={{ color: '#3A2B1D', fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '1.5px', mt: 0.2, fontWeight: 700 }}>
//                   {account_number ? String(account_number).replace(/(.{4})/g, '$1 ').trim() : '•••• •••• ••••'}
//                 </Typography>
//               </Box>
              
//               <Box sx={{ textAlign: 'right' }}>
//                 <Typography variant="caption" sx={{ color: 'rgba(30, 24, 18, 0.5)', fontSize: '0.55rem', letterSpacing: '0.12em', display: 'block', fontWeight: 700 }}>
//                   SECURED POOL VOLUME
//                 </Typography>
//                 <Typography sx={{ fontFamily: "'Playfair Display', serif", color: '#1B130B', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
//                   ₹{ledgerData.totalPayout.toLocaleString()}
//                 </Typography>
//               </Box>
//             </Box>
//           </Box>
//         </Box>

//         {/* ================= FINANCIAL CARDS LAYER ================= */}
//         <Grid container spacing={14} sx={{ mb: 6 }}>
//           {financialKpis.map((kpi, idx) => (
//             <Grid item xs={12} md={4} key={idx}>
//               <Paper 
//                 sx={{ 
//                   p: 4, 
//                   height: '100%', 
//                   display: 'flex', 
//                   flexDirection: 'column', 
//                   alignItems: 'flex-start',
//                   background: kpi.gradient,
//                   borderRadius: '24px',
//                   border: '1px solid rgba(0, 0, 0, 0.04)',
//                   boxShadow: '0 10px 30px rgba(0, 0, 0, 0.01)',
//                   transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
//                   '&:hover': { 
//                     transform: 'translateY(-4px)',
//                     boxShadow: '0 20px 40px rgba(0, 0, 0, 0.03)',
//                     borderColor: 'rgba(0, 0, 0, 0.1)'
//                   }
//                 }}
//               >
//                 <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.05)', mb: 3, width: 44, height: 44 }}>
//                   {kpi.icon}
//                 </Avatar>
//                 <Typography sx={{ textTransform: 'uppercase', color: MUTED_CHARCOAL, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em', mb: 1 }}>
//                   {kpi.title}
//                 </Typography>
//                 <Typography sx={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', color: OBSIDIAN_BLACK, mb: 1, fontWeight: 400 }}>
//                   {kpi.value}
//                 </Typography>
//                 <Typography sx={{ fontSize: '0.75rem', color: MUTED_CHARCOAL, opacity: 0.8 }}>
//                   {kpi.unit}
//                 </Typography>
//               </Paper>
//             </Grid>
//           ))}
//         </Grid>

//         {/* ================= CENTERED CHANNEL KPIs ================= */}
//         <Grid container spacing={8} sx={{ mb: 6, ml: 14 }} justifyContent="center">
//           {structuralKpis.map((kpi, idx) => (
//             <Grid item xs={12} sm={6} md={4} key={idx}>
//               <Paper 
//                 component={kpi.link ? Link : 'div'} 
//                 to={kpi.link || undefined} 
//                 sx={{ 
//                   p: 3, 
//                   display: 'flex', 
//                   alignItems: 'center',
//                   justifyContent: 'space-between',
//                   textDecoration: 'none', 
//                   backgroundColor: 'rgba(255, 255, 255, 0.5)',
//                   backdropFilter: 'blur(10px)',
//                   borderRadius: '20px',
//                   border: '1px solid rgba(0, 0, 0, 0.04)',
//                   cursor: kpi.link ? 'pointer' : 'default',
//                   transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
//                   '&:hover': { 
//                     backgroundColor: 'rgba(255, 255, 255, 0.9)',
//                     borderColor: 'rgba(0, 0, 0, 0.1)',
//                     boxShadow: '0 12px 30px rgba(0, 0, 0, 0.02)',
//                     '& .arrow-icon': { transform: 'translateX(3px)', color: OBSIDIAN_BLACK }
//                   } 
//                 }}
//               >
//                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
//                   <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)' }}>
//                     {kpi.icon}
//                   </Avatar>
//                   <Box>
//                     <Typography sx={{ color: MUTED_CHARCOAL, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.2 }}>
//                       {kpi.title}
//                     </Typography>
//                     <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
//                       <Typography sx={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: OBSIDIAN_BLACK, fontWeight: 500 }}>
//                         {kpi.value}
//                       </Typography>
//                       <Typography sx={{ fontSize: '0.75rem', color: MUTED_CHARCOAL }}>
//                         {kpi.unit}
//                       </Typography>
//                     </Box>
//                   </Box>
//                 </Box>
//                 {kpi.link && (
//                   <ArrowForwardIosIcon 
//                     className="arrow-icon"
//                     sx={{ color: MUTED_CHARCOAL, fontSize: 13, mr: 1, transition: 'all 0.2s ease' }} 
//                   />
//                 )}
//               </Paper>
//             </Grid>
//           ))}
//         </Grid>

//         {/* ================= MATERIAL DISTRIBUTION ANALYSIS ================= */}
//         <Box sx={{ mb: 2 }}>
//           <Box sx={{ display: 'flex', flexDirection: 'column', mb: 4 }}>
//             <Typography variant="h6" sx={{ color: OBSIDIAN_BLACK, mb: 0.5, textTransform: 'none', letterSpacing: '0.02em', fontSize: '1.2rem' }}>
//               Material Distribution Analysis
//             </Typography>
//             <Typography sx={{ color: MUTED_CHARCOAL, fontSize: '0.88rem' }}>
//               Strategic throughput analysis across active structural and design elements.
//             </Typography>
//           </Box>

//           <Box sx={{ display: 'flex', gap: 2.5, mb: 4, flexWrap: 'wrap' }}>
//             {graphData.map((category) => (
//               <Box key={category.name} sx={{ 
//                 flex: '1 1 calc(25% - 20px)',
//                 minWidth: '160px',
//                 p: 3,
//                 display: 'flex', 
//                 flexDirection: 'column', 
//                 alignItems: 'flex-start',
//                 backgroundColor: 'rgba(255, 255, 255, 0.4)',
//                 borderRadius: '16px',
//                 border: '1px solid rgba(0, 0, 0, 0.03)',
//                 transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
//                 '&:hover': { 
//                   backgroundColor: OBSIDIAN_BLACK,
//                   borderColor: OBSIDIAN_BLACK,
//                   transform: 'translateY(-2px)',
//                   '& .cat-label, & .cat-unit': { color: 'rgba(255,255,255,0.6)' },
//                   '& .cat-metric': { color: PURE_WHITE }
//                 }
//               }}>
//                 <Typography className="cat-label" sx={{ color: MUTED_CHARCOAL, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', mb: 1, transition: 'color 0.2s' }}>
//                   {category.name}
//                 </Typography>
//                 <Typography className="cat-metric" sx={{ fontFamily: "'Playfair Display', serif", color: OBSIDIAN_BLACK, fontSize: '1.8rem', fontWeight: 400, transition: 'color 0.2s' }}>
//                   {category.sheets.toLocaleString()}
//                 </Typography>
//                 <Typography className="cat-unit" sx={{ fontSize: '0.7rem', color: MUTED_CHARCOAL, textTransform: 'uppercase', mt: 0.5, letterSpacing: '0.05em', transition: 'color 0.2s' }}>
//                   Total Sheets
//                 </Typography>
//               </Box>
//             ))}
//           </Box>

//           <Paper sx={{ 
//             p: { xs: 2, md: 4 }, 
//             backgroundColor: 'rgba(255, 255, 255, 0.3)', 
//             borderRadius: '24px',
//             border: '1px solid rgba(0, 0, 0, 0.04)', 
//             boxShadow: 'none',
//             overflow: 'hidden'
//           }}>
//             <Box sx={{ width: '100%', height: 380 }}>
//               <ResponsiveContainer width="100%" height="100%">
//                 <BarChart 
//                   data={graphData} 
//                   margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
//                 >
//                   <defs>
//                     <linearGradient id="luxuryBarGradient" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="0%" stopColor={OBSIDIAN_BLACK} stopOpacity={1} />
//                       <stop offset="60%" stopColor="#2A2A2A" stopOpacity={0.9} />
//                       <stop offset="100%" stopColor={COUTURE_CHAMPAGNE} stopOpacity={0.2} />
//                     </linearGradient>
//                   </defs>
                  
//                   <CartesianGrid 
//                     strokeDasharray="4 4" 
//                     stroke="rgba(0, 0, 0, 0.04)" 
//                     vertical={false}
//                   />
//                   <XAxis 
//                     dataKey="name" 
//                     tick={{ fill: MUTED_CHARCOAL, fontSize: 11, fontWeight: 500, letterSpacing: '0.05em' }}
//                     axisLine={false}
//                     tickLine={false}
//                     dy={10}
//                   />
//                   <YAxis 
//                     tick={{ fill: MUTED_CHARCOAL, fontSize: 11 }}
//                     axisLine={false}
//                     tickLine={false}
//                   />
//                   <Tooltip 
//                     cursor={{ fill: 'rgba(0, 0, 0, 0.015)' }}
//                     contentStyle={{ 
//                       backgroundColor: OBSIDIAN_BLACK, 
//                       border: 'none',
//                       color: PURE_WHITE,
//                       fontFamily: "'Plus Jakarta Sans', sans-serif",
//                       fontSize: '0.85rem',
//                       padding: '12px 16px',
//                       borderRadius: '12px',
//                       boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
//                     }}
//                     itemStyle={{ color: COUTURE_CHAMPAGNE, fontSize: '1.1rem', fontFamily: "'Playfair Display', serif", marginTop: '4px' }}
//                     formatter={(value) => [value.toLocaleString(), 'Sheets Volume']}
//                   />
//                   <Bar 
//                     dataKey="sheets" 
//                     fill="url(#luxuryBarGradient)"
//                     radius={[8, 8, 0, 0]} 
//                     barSize={44}
//                   >
//                     {graphData.map((entry, index) => (
//                       <Cell 
//                         key={`cell-${index}`} 
//                         style={{ transition: 'opacity 0.3s ease' }}
//                         onMouseEnter={(e) => e.target.style.opacity = 0.8}
//                         onMouseLeave={(e) => e.target.style.opacity = 1}
//                       />
//                     ))}
//                   </Bar>
//                 </BarChart>
//               </ResponsiveContainer>
//             </Box>
//           </Paper>
//         </Box>
//       </Box>
//     </ThemeProvider>
//   );
// };

// export default DashboardPage;