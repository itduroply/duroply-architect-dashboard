import React, { useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, Typography, Button, Dialog,
  TextField, IconButton, Chip, Tabs, Tab, CircularProgress, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, MenuItem} from '@mui/material';
import { Close as CloseIcon, Search as SearchIcon, AssignmentTurnedIn as ResolvedIcon, AccessTime as PendingIcon, ArrowForward as ArrowIcon,
  CheckCircleOutlined as SuccessIcon, WarningAmberOutlined as WarningIcon, SettingsOutlined as ProductIcon, ChatBubbleOutlineOutlined as FeedbackIcon,
  CalendarTodayOutlined as VisitIcon, CardGiftcardOutlined as RewardIcon, LocationOnOutlined as LocationIcon} from '@mui/icons-material';
import { supabase } from '../supabaseClient';

// PREMIUM LUXURY EDITORIAL COLOR PALETTE

const premiumGoldTheme = createTheme({
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
    h4: {
      fontFamily: "'Playfair Display', serif",
      fontWeight: 700,
      color: '#111625',
      letterSpacing: '-0.02em',
    },
    h5: {
      fontFamily: "'Playfair Display', serif",
      fontWeight: 700,
      color: '#111625',
    },
    h6: { 
      fontFamily: "'Playfair Display', serif", 
      fontWeight: 600, 
      color: '#111625',
      fontSize: '1.05rem'
    },
    body2: { 
      fontSize: '0.825rem',
      lineHeight: 1.5,
      color: '#3A4250'
    },
    caption: {
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#C2A478'
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '1px', 
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '1px',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#EFECE8',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#C2A478',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#111625',
            borderWidth: '1px'
          },
        },
      },
    },
  }
});

const KPI_CATEGORIES = [
  {
    title: "Product Delivery Support",
    desc: "Get help with technical specifications, site configurations, and order delivery errors.",
    icon: <ProductIcon sx={{ fontSize: 20, color: '#C2A478' }} />
  },
  {
    title: "Reward Redemption",
    desc: "Claim your loyalty benefits, milestone rewards, and exclusive partner perks.",
    icon: <RewardIcon sx={{ fontSize: 20, color: '#C2A478' }} />
  },
  {
    title: "Site Claim Request",
    desc: "Schedule structural site assessments, technical reviews, or architect consultations.",
    icon: <VisitIcon sx={{ fontSize: 20, color: '#C2A478' }} />
  },
  {
    title: "Feedback & Ideas",
    desc: "Share your suggestions and ideas to help improve our products and services.",
    icon: <FeedbackIcon sx={{ fontSize: 20, color: '#C2A478' }} />
  }
];

const QueryRaisePage = ({ account_number }) => {
  const [activeTab, setActiveTab] = useState(0); 
  const [openModal, setOpenModal] = useState(false);
  const [openNotification, setOpenNotification] = useState(false);
  const [openValidationAlert, setOpenValidationAlert] = useState(false); 
  
  const [supportLogs, setSupportLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingName, setFetchingName] = useState(true);
  
  const [statusFilterTab, setStatusFilterTab] = useState(0); 
  const [searchQuery, setSearchQuery] = useState('');

  const [backendMeta, setBackendMeta] = useState({
    account_identity: account_number,
    name: '',
    mobile_no: ''
  });

  const [uniqueLeadIds, setUniqueLeadIds] = useState([]);
  const [leadDetailsMap, setLeadDetailsMap] = useState({}); // Stores address and state mapped by lead_id
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [dropdownError, setDropdownError] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const fetchLedgerAndLogs = async () => {
      setLoading(true);
      setFetchingName(true);
      try {
        // 1. Fetch influencer_name & mobile_number from master_architect
        const { data: architectData, error: architectError } = await supabase
          .from('master_architect')
          .select('influencer_name, mobile_number')
          .eq('account_number', account_number)
          .maybeSingle();

        if (architectError) {
          console.error("Error fetching master_architect:", architectError.message);
        }

        const fetchedName = architectData?.influencer_name || '';
        const fetchedMobile = architectData?.mobile_number || '';

        setBackendMeta(prev => ({ 
          ...prev, 
          name: fetchedName,
          mobile_no: fetchedMobile 
        }));

        // 2. Query commission_ledger for lead_id dropdown
        const { data: ledgerData, error: ledgerError } = await supabase
          .from('commission_ledger')
          .select('lead_id')
          .ilike('architect_name', `${account_number}%`);

        if (ledgerError) throw ledgerError;

        if (ledgerData && ledgerData.length > 0) {
          const leads = ledgerData
            .map(row => row.lead_id)
            .filter((id, idx, self) => id !== null && id !== undefined && id !== '' && self.indexOf(id) === idx);
          
          setUniqueLeadIds(leads);

          // 2b. Fetch address and state from leads_master for matching lead_ids
          if (leads.length > 0) {
            const { data: leadsMasterData, error: leadsMasterError } = await supabase
              .from('leads_master')
              .select('lead_id, address, state')
              .in('lead_id', leads);

            if (leadsMasterError) {
              console.error("Error fetching leads_master:", leadsMasterError.message);
            } else if (leadsMasterData) {
              const detailsMap = {};
              leadsMasterData.forEach(item => {
                detailsMap[item.lead_id] = {
                  address: item.address || '',
                  state: item.state || ''
                };
              });
              setLeadDetailsMap(detailsMap);
            }
          }
        }

        setFetchingName(false);

        // 3. Fetch Query Support Logs
        const { data: logsData, error: logsError } = await supabase
          .from('query_support')
          .select('*')
          .eq('account_identity', account_number)
          .order('id', { ascending: false });

        if (logsError) throw logsError;
        setSupportLogs(logsData || []);

      } catch (err) {
        console.error("Supabase integration error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    if (account_number) {
      setBackendMeta(prev => ({ ...prev, account_identity: account_number }));
      fetchLedgerAndLogs();
    }
  }, [account_number]);

  const handleKpiCardClick = (categoryTitle) => {
    setSelectedCategory(categoryTitle);
    setOpenModal(true);
  };
  
  const handleCloseModal = () => {
    setOpenModal(false);
    setDescription('');
    setSelectedLeadId('');
    setDropdownError(false);
  };

  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Explicit Validation Check for Site Claim Request
    if (selectedCategory === "Site Claim Request" && !selectedLeadId) {
      setDropdownError(true);
      setOpenValidationAlert(true);
      return;
    }

    if (!backendMeta.name || !selectedCategory || !description.trim()) return;

    try {
      const generatedTicketStr = String(Math.floor(10000 + Math.random() * 90000));
      
      const leadLocation = leadDetailsMap[selectedLeadId];
      const locationInfoStr = leadLocation 
        ? `Location: ${[leadLocation.address, leadLocation.state].filter(Boolean).join(', ')}`
        : '';

      const structuredDetail = selectedCategory === "Site Claim Request"
        ? `Lead ID: ${selectedLeadId} ${locationInfoStr ? `(${locationInfoStr})` : ''} | ${description}`
        : description;

      const { data, error } = await supabase
        .from('query_support')
        .insert([
          {
            account_identity: backendMeta.account_identity,
            name: backendMeta.name,
            mobile_no: backendMeta.mobile_no,
            query_type: selectedCategory,
            query_detail: structuredDetail,
            ticket: generatedTicketStr
          }
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setSupportLogs(prev => [data[0], ...prev]);
      }
      
      handleCloseModal();
      setOpenNotification(true); 
    } catch (err) {
      console.error("Failed executing data insertion payload:", err.message);
    }
  };

  const filteredLogs = useMemo(() => {
    const cleanQuery = searchQuery.toLowerCase().trim();

    return supportLogs.filter(log => {
      if (cleanQuery !== '') {
        const individualTicket = log.ticket ? String(log.ticket).toLowerCase() : '';
        return individualTicket.includes(cleanQuery);
      }

      const isResolved = log.status?.trim().toLowerCase() === 'resolved';
      if (statusFilterTab === 0 && isResolved) return false;
      if (statusFilterTab === 1 && !isResolved) return false;

      return true;
    });
  }, [supportLogs, statusFilterTab, searchQuery]);

  if (loading && supportLogs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', bgcolor: '#F9F8F6' }}>
        <CircularProgress size={26} thickness={4} sx={{ color: '#C2A478' }} />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={premiumGoldTheme}>
      <CssBaseline />
      
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, bgcolor: '#F9F8F6', width: '100%' }}>
        <Box sx={{ maxWidth: '1080px', width: '100%', mx: 'auto' }}>
          
          {/* TAB HEADER BAR */}
          <Box sx={{ borderBottom: '1.5px solid #EFECE8', mb: 3 }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, val) => setActiveTab(val)}
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
              TabIndicatorProps={{
                style: {
                  backgroundColor: '#C2A478',
                  height: '3px',
                  borderRadius: '2px 2px 0 0'
                }
              }}
              sx={{
                minHeight: 'auto',
                '& .MuiTabs-scrollButtons': {
                  color: '#C2A478',
                },
                '& .MuiTab-root': {
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  fontSize: '0.73rem',
                  letterSpacing: '1.8px',
                  minWidth: 'auto',
                  px: 2.5,
                  pb: 1.5,
                  pt: 0.5,
                  mr: 2,
                  color: '#6E7787',
                  '&.Mui-selected': {
                    color: '#111625',
                  }
                }
              }}
            >
              <Tab label="Raise Query" />
              <Tab label="See Status" />
            </Tabs>
          </Box>

          {/* TAB 1: RAISE QUERY */}
          {activeTab === 0 && (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
              gap: '16px' 
            }}>
              {KPI_CATEGORIES.map((kpi, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleKpiCardClick(kpi.title)}
                  sx={{
                    bgcolor: '#FFFFFF',
                    p: 2.5,
                    borderRadius: '2px',
                    border: '1px solid #EFECE8',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '145px',
                    position: 'relative',
                    transition: 'all 0.25s ease',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -1,
                      left: 0,
                      right: 0,
                      height: '3px',
                      backgroundColor: '#C2A478',
                      opacity: 0,
                    },
                    '&:hover': {
                      borderColor: '#C2A478',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 12px rgba(194, 164, 120, 0.05)',
                      '&::before': { opacity: 1 }
                    }
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.8rem', letterSpacing: '1px', opacity: 0.8, fontWeight: 800 }}>
                        {`0${idx + 1}`}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, bgcolor: '#F9F8F6' }}>
                        {kpi.icon}
                      </Box>
                    </Box>
                    <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.01em', color: '#111625' }}>
                      {kpi.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', lineHeight: 1.4 }}>
                      {kpi.desc}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                    <ArrowIcon sx={{ fontSize: 14, color: '#C2A478' }} />
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* TAB 2: SEE STATUS */}
          {activeTab === 1 && (
            <Box>
              {/* TOP FILTERS */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 2, gap: 2 }}>
                <Tabs 
                  value={statusFilterTab} 
                  onChange={(e, newVal) => setStatusFilterTab(newVal)}
                  textColor="primary"
                  indicatorColor="secondary"
                  sx={{
                    minHeight: 'auto',
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      minWidth: 80,
                      px: 1.5,
                      py: 0.5,
                      minHeight: 'auto',
                      mr: 1
                    }
                  }}
                >
                  <Tab label="Under Process" />
                  <Tab label="Solved" />
                </Tabs>

                <TextField
                  size="small"
                  placeholder="Search Ticket..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ 
                    minWidth: { xs: '100%', sm: 280 },
                    '& .MuiOutlinedInput-root': {
                      height: '36px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '2px',
                      border: '1px solid #EFECE8',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#C2A478', fontSize: 16 }} />
                      </InputAdornment>
                    ),
                    style: { fontSize: '0.78rem', fontWeight: 500 }
                  }}
                />
              </Box>

              {/* TABLE CONTAINER */}
              <TableContainer sx={{
                maxHeight: '420px', 
                overflowY: 'auto', 
                overflowX: 'auto',
                bgcolor: '#FFFFFF',
                border: '1px solid #EFECE8',
                borderRadius: '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                '&::-webkit-scrollbar': { 
                  width: '8px',
                  height: '8px',
                  display: 'block' 
                },
                '&::-webkit-scrollbar-track': { background: '#EFECE8' },
                '&::-webkit-scrollbar-thumb': { 
                  background: '#C2A478', 
                  border: '2px solid #EFECE8',
                  '&:hover': { background: '#A68A5E' }
                },
                scrollbarWidth: 'thin',
                scrollbarColor: '#C2A478 #EFECE8'
              }}>
                <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#111625', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', py: 1.5, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Ticket ID</TableCell>
                      <TableCell sx={{ bgcolor: '#111625', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', py: 1.5, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Inquiry Type</TableCell>
                      <TableCell sx={{ bgcolor: '#111625', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', py: 1.5, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Description Details</TableCell>
                      <TableCell sx={{ bgcolor: '#111625', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', py: 1.5, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Filed Date</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#111625', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', py: 1.5, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Current Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.78rem' }}>
                            No support queries registered matching this ticket criteria.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => {
                        const checkStatusIsResolved = log.status?.trim().toLowerCase() === 'resolved';
                        return (
                          <TableRow key={log.id} sx={{ '&:hover': { bgcolor: '#FAFAF9' }, '& td': { borderColor: '#EFECE8', py: 1.8 } }}>
                            <TableCell>
                              <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: '0.72rem', color: '#C2A478' }}>
                                #{log.ticket || '00000'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#111625' }}>
                                {log.query_type}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ maxWidth: '300px' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.72rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.query_detail}>
                                {log.query_detail || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                {(() => {
                                  if (!log.created_at) return 'Recent';
                                  const safeDate = log.created_at.replace(' ', 'T').replace(/\+00$/, 'Z');
                                  const parsed = new Date(safeDate);
                                  return isNaN(parsed.getTime()) 
                                    ? 'Recent' 
                                    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                })()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                icon={checkStatusIsResolved ? <ResolvedIcon style={{ color: '#2E7D32', fontSize: 10 }} /> : <PendingIcon style={{ color: '#B78103', fontSize: 10 }} />}
                                label={checkStatusIsResolved ? 'Solved' : 'Process'}
                                size="small"
                                sx={{
                                  height: '20px',
                                  fontSize: '0.55rem',
                                  fontWeight: 800,
                                  borderRadius: '1px',
                                  bgcolor: checkStatusIsResolved ? '#E8F5E9' : '#FFF8E1',
                                  color: checkStatusIsResolved ? '#2E7D32' : '#B78103',
                                  border: `1px solid ${checkStatusIsResolved ? '#C8E6C9' : '#FFE082'}`
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* MAIN FORM MODAL */}
          <Dialog
            open={openModal}
            onClose={handleCloseModal}
            maxWidth="sm" 
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: '2px',
                bgcolor: '#FFFFFF',
                borderTop: '4px solid #C2A478',
                boxShadow: '0 24px 48px rgba(17, 22, 37, 0.08)',
                mx: 2
              }
            }}
          >
            <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#C2A478' }}>
                    Direct Inquiry Desk
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {selectedCategory}
                  </Typography>
                </Box>
                <IconButton onClick={handleCloseModal} size="small" sx={{ color: '#111625', mt: -0.5 }}>
                  <CloseIcon sx={{ fontSize: '1.25rem' }} />
                </IconButton>
              </Box>

              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'stretch', 
                gap: 2.5 
              }}>
                {/* CONDITIONAL MANDATORY DROPDOWN FOR SITE CLAIM REQUEST */}
                {selectedCategory === "Site Claim Request" && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      select
                      label="Select Lead ID"
                      value={selectedLeadId}
                      onChange={(e) => {
                        setSelectedLeadId(e.target.value);
                        setDropdownError(false);
                      }}
                      required
                      error={dropdownError}
                      helperText={dropdownError ? "Selecting an associated Lead ID is compulsory." : ""}
                      fullWidth
                      variant="outlined"
                      size="small"
                      InputLabelProps={{ style: { fontSize: '0.825rem' } }}
                      SelectProps={{ style: { fontSize: '0.825rem' } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#F9F8F6' } }}
                    >
                      {uniqueLeadIds.length === 0 ? (
                        <MenuItem disabled value="">
                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>No unique Lead IDs linked</Typography>
                        </MenuItem>
                      ) : (
                        uniqueLeadIds.map((id) => {
                          const details = leadDetailsMap[id];
                          const locStr = details 
                            ? [details.address, details.state].filter(Boolean).join(', ')
                            : '';
                          return (
                            <MenuItem key={id} value={id}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.825rem' }}>
                                  {id}
                                </Typography>
                                {locStr && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', ml: 1 }}>
                                    {locStr}
                                  </Typography>
                                )}
                              </Box>
                            </MenuItem>
                          );
                        })
                      )}
                    </TextField>

                    {/* SELECTED LEAD LOCATION PREVIEW */}
                    {selectedLeadId && leadDetailsMap[selectedLeadId] && (
                      <Box sx={{
                        p: 1.5,
                        bgcolor: '#F9F8F6',
                        border: '1px solid #EFECE8',
                        borderRadius: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5
                      }}>
                        <LocationIcon sx={{ fontSize: 18, color: '#C2A478' }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: '#C2A478', fontWeight: 800, display: 'block', mb: 0.2 }}>
                            Site Location Details
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#111625', fontWeight: 600 }}>
                            {[
                              leadDetailsMap[selectedLeadId].address && `Address: ${leadDetailsMap[selectedLeadId].address}`,
                              leadDetailsMap[selectedLeadId].state && `State: ${leadDetailsMap[selectedLeadId].state}`
                            ].filter(Boolean).join(' • ')}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' }, 
                  alignItems: 'stretch', 
                  gap: 3 
                }}>
                  <TextField
                    placeholder="Provide supplementary context here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={4}
                    required
                    fullWidth
                    variant="outlined"
                    inputProps={{ style: { fontSize: '0.825rem', lineHeight: '1.6' } }}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: '#F9F8F6' } }}
                  />

                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'row', sm: 'column' }, 
                    justifyContent: 'space-between', 
                    minWidth: { xs: '100%', sm: '110px' }, 
                    gap: 1.5 
                  }}>
                    <Button
                      onClick={handleFormSubmit}
                      disabled={fetchingName || !backendMeta.name || !description.trim()}
                      variant="contained"
                      fullWidth
                      sx={{
                        fontSize: '0.78rem',
                        py: 1.5,
                        bgcolor: '#111625',
                        color: '#FFFFFF',
                        border: '1px solid #111625',
                        flex: { xs: 1, sm: 'none' },
                        '&:hover': { bgcolor: '#C2A478', borderColor: '#C2A478' }
                      }}
                    >
                      Send
                    </Button>
                    <Button
                      onClick={handleCloseModal}
                      fullWidth
                      sx={{
                        fontSize: '0.78rem',
                        py: 1.5,
                        color: '#6E7787',
                        border: '1px solid #EFECE8',
                        flex: { xs: 1, sm: 'none' },
                        '&:hover': { bgcolor: '#F9F8F6', borderColor: '#C2A478' }
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Dialog>

          {/* BEAUTIFUL VALIDATION POPUP (ALERT DIALOG WHEN LEAD_ID IS MISSING) */}
          <Dialog
            open={openValidationAlert}
            onClose={() => setOpenValidationAlert(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: { 
                borderRadius: '2px', 
                p: { xs: 3, sm: 4 }, 
                textAlign: 'center', 
                borderTop: '4px solid #D32F2F', 
                mx: 2 
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <WarningIcon sx={{ color: '#D32F2F', fontSize: '3rem' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#111625' }}>
                Lead ID Selection Required
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', px: 1, fontSize: '0.8rem', lineHeight: 1.6 }}>
                You have added details inside the description field, but a **Lead ID** has not been chosen. Please pick a valid Lead ID parameter configuration from the dropdown selection list before filing this site claim request.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setOpenValidationAlert(false)}
                sx={{
                  mt: 1.5,
                  width: '100%',
                  fontSize: '0.8rem',
                  py: 1.2,
                  bgcolor: '#D32F2F',
                  color: '#FFFFFF',
                  borderRadius: '1px',
                  '&:hover': { bgcolor: '#B71C1C' }
                }}
              >
                Return & Fix Selection
              </Button>
            </Box>
          </Dialog>

          {/* SUCCESS POPUP CONFIRMATION */}
          <Dialog
            open={openNotification}
            onClose={() => setOpenNotification(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: { borderRadius: '1px', p: { xs: 3, sm: 4 }, textAlign: 'center', border: '1px solid #EFECE8', mx: 2 }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <SuccessIcon sx={{ color: '#C2A478', fontSize: '3rem' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Inquiry Successfully Logged
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', px: 1, fontSize: '0.78rem', lineHeight: 1.6 }}>
                We have registered your ticket. A representative will assess your request parameters and get back to you within **2 to 3 days**.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setOpenNotification(false)}
                sx={{
                  mt: 1.5,
                  width: '100%',
                  fontSize: '0.8rem',
                  py: 1.2,
                  bgcolor: '#111625',
                  color: '#FFFFFF',
                  '&:hover': { bgcolor: '#C2A478' }
                }}
              >
                Acknowledge
              </Button>
            </Box>
          </Dialog>

        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default QueryRaisePage;