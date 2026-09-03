import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { formatArchitectDisplayName } from './formatArchitectDisplayName';
import {  Box,  Typography,  Avatar,  Stack, Paper, Skeleton, Alert, Table, TableBody, TableCell,
  TableContainer, TableRow, ThemeProvider, createTheme, CssBaseline} from '@mui/material';
import {  PhoneOutlined as Phone,  LocationOnOutlined as LocationOn,  StorefrontOutlined as Storefront, 
  Fingerprint,  CalendarMonthOutlined as CalendarMonth,  VerifiedUserOutlined as VerifiedUser} from '@mui/icons-material';


// 🎨 LIGHT LUXURY CORPORATE EDITORIAL THEME

const premiumProfileTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#FAFAFA', 
      paper: '#FFFFFF' 
    },
    primary: { main: '#1A1A1A' }, 
    secondary: { main: '#B89047' }, 
    text: {
      primary: '#1A1A1A',   
      secondary: '#707070'  
    },
  },
  typography: {
    fontFamily: '"Inter", "-apple-system", sans-serif',
    caption: {
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#B89047'
    }
  }
});

export default function ProfileSection({ account_number }) {
  const [profileData, setProfileData] = useState(null);
  const [resolvedAccountNumber, setResolvedAccountNumber] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function fetchArchitectProfileData() {
      setIsLoading(true);
      setErrorMessage(null);
      
      try {
        let targetAccountNumber = account_number;

        if (!targetAccountNumber) {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (authError || !user) {
            setErrorMessage("Authentication session missing. Please log in or provide an account reference.");
            return;
          }
          
          targetAccountNumber = user?.user_metadata?.account_number;
        }

        if (!targetAccountNumber) {
          setErrorMessage("Could not resolve a valid account number for this profile session.");
          return;
        }

        setResolvedAccountNumber(targetAccountNumber);
        
        const { data: architectRow, error: profileError } = await supabase
          .from('master_architect')
          .select('influencer_name, enrollment_date, mobile_number, dealer, market_city, account_number')
          .eq('account_number', targetAccountNumber)
          .maybeSingle();

        if (profileError) throw profileError;
        
        if (!architectRow) {
          setErrorMessage(`No core profile record located for account sequence: ${targetAccountNumber}`);
          return;
        }

        // This read is UI-only: the ledger holds the display identity used by the dashboard.
        const { data: ledgerRow, error: ledgerError } = await supabase
          .from('commission_ledger')
          .select('architect_name')
          .ilike('architect_name', `${targetAccountNumber}%`)
          .limit(1)
          .maybeSingle();

        if (ledgerError) console.error('Could not load ledger display name:', ledgerError.message);
        const cleanName = formatArchitectDisplayName(
          ledgerRow?.architect_name || architectRow.influencer_name
        );
        
        setProfileData({
          ...architectRow,
          influencer_name: cleanName,
          account_identity: `${architectRow.account_number || '9999'}`,
          current_dealer: architectRow.dealer || 'Unassigned'
        });

      } catch (err) {
        console.error("Dossier data synchronization failure:", err);
        setErrorMessage(err.message || "Cloud pipeline configuration error.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchArchitectProfileData();
  }, [account_number]);

  const formattedEnrollmentDate = useMemo(() => {
    if (!profileData?.enrollment_date) return "—";
    try {
      const date = new Date(profileData.enrollment_date);
      return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch (e) {
      return profileData.enrollment_date;
    }
  }, [profileData?.enrollment_date]);

  if (errorMessage) {
    return (
      <Box sx={{ p: 4, maxWidth: 'md', mx: 'auto', mt: 4 }}>
        <Alert severity="error" variant="filled" sx={{ borderRadius: '4px', bgcolor: '#1A1A1A', color: '#FFFFFF', fontWeight: 600 }}>
          {errorMessage}
        </Alert>
      </Box>
    );
  }

  const avatarInitial = profileData?.influencer_name?.charAt(0).toUpperCase() || 'A';

  return (
    <ThemeProvider theme={premiumProfileTheme}>
      <CssBaseline />
      <Box sx={{ 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        pt: 1,
        pb: 1, 
        px: { xs: 2, md: 4 }
      }}>
        <Stack spacing={2} sx={{ width: '100%', maxWidth: '1200px' }}>
          
          
              {/* 📦 ROW 01: 50/50 SYMMETRICAL IDENTITY & TIMELINE ROW */}
             
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2, 
              width: '100%' 
            }}
          >
            {/* CORPORATE IDENTITY TERMINAL (LEFT - 50%) */}
            <Paper 
              elevation={0} 
              sx={{ 
                flex: 1,
                minWidth: 0,
                borderRadius: '4px', 
                border: '1px solid #EAEAEA', 
                bgcolor: '#FFFFFF', 
                p: 3, 
                display: 'flex', 
                alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%', minWidth: 0 }}>
                {isLoading ? (
                  <Skeleton variant="circular" sx={{ width: 56, height: 56, flexShrink: 0 }} />
                ) : (
                  <Avatar 
                    sx={{ 
                      width: 56, 
                      height: 56, 
                      fontSize: '18px', 
                      fontWeight: 700,
                      background: '#1A1A1A', 
                      color: '#B89047',
                      border: '1px solid #EAEAEA',
                      borderRadius: '4px',
                      flexShrink: 0
                    }}
                  >
                    {avatarInitial}
                  </Avatar>
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Corporate Account
                  </Typography>
                  <Typography noWrap sx={{ fontWeight: 700, color: '#1A1A1A', mb: 0.5, letterSpacing: '-0.02em', fontSize: '1.15rem' }}>
                    {isLoading ? <Skeleton width="60%" /> : profileData?.influencer_name}
                  </Typography>
                  <Typography sx={{ display: 'none' }}>
                    {isLoading ? <Skeleton width="40%" /> : (resolvedAccountNumber || '—')}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* ENROLLMENT METRIC TERMINAL (RIGHT - 50%) */}
            <Paper 
              elevation={0} 
              sx={{ 
                flex: 1,
                minWidth: 0,
                borderRadius: '4px', 
                p: 3, 
                border: '1px solid #EAEAEA', 
                background: '#FFFFFF', 
                color: '#1A1A1A',
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption">
                  Enrollment Timeline
                </Typography>
                <CalendarMonth sx={{ fontSize: '1.1rem', color: '#B89047' }} />
              </Box>

              <Typography noWrap sx={{ fontWeight: 700, color: '#1A1A1A', fontSize: '1.15rem', letterSpacing: '-0.01em', mb: 0.5 }}>
                {isLoading ? <Skeleton width="50%" /> : formattedEnrollmentDate}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#707070' }}>
                <VerifiedUser sx={{ fontSize: '0.85rem', color: '#B89047' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>Verified Account</Typography>
              </Box>
            </Paper>
          </Box>

          {/* ========================================================
              📊 ROW 02: VERIFICATION DOSSIER METRIC SPECIFICATIONS
          ======================================================== */}
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: '4px', 
              border: '1px solid #EAEAEA', 
              bgcolor: '#FFFFFF', 
              overflow: 'hidden', 
              p: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
            }}
          >
            <Box sx={{ pb: 2 }}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                System Verification Architecture
              </Typography>
            </Box>
            
            <TableContainer>
              <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                <TableBody>
                  {[
                    { icon: <Fingerprint sx={{ fontSize: 16, color: '#B89047' }} />, label: "Account Id", value: profileData?.account_identity, mono: true },
                    { icon: <Phone sx={{ fontSize: 16, color: '#B89047' }} />, label: "Registered Mobile", value: profileData?.mobile_number, mono: true },
                    { icon: <Storefront sx={{ fontSize: 16, color: '#B89047' }} />, label: "Dealers Location", value: profileData?.current_dealer, mono: false },
                    { icon: <LocationOn sx={{ fontSize: 16, color: '#B89047' }} />, label: "Market City", value: profileData?.market_city, mono: false }
                  ].map((row, index) => (
                    <TableRow 
                      key={index} 
                      sx={{ 
                        borderBottom: '1px solid #EAEAEA',
                        '&:last-child': { borderBottom: 0 },
                        '&:hover': { backgroundColor: 'rgba(184, 144, 71, 0.02)' },
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <TableCell sx={{ py: 1.5, px: 1, width: '40px' }}>
                        {row.icon}
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, fontWeight: 700, color: '#707070', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '40%' }}>
                        {row.label}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5, px: 2 }}>
                        {isLoading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Skeleton width="40%" /></Box>
                        ) : (
                          <Typography sx={{ fontWeight: 600, color: '#1A1A1A', fontSize: '0.8rem', fontFamily: row.mono ? 'ui-monospace, monospace' : 'inherit' }}>
                            {row.value || <Box component="span" sx={{ color: '#D0D0D0', fontStyle: 'italic', fontWeight: 400 }}>Unassigned Parameter</Box>}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

        </Stack>
      </Box>
    </ThemeProvider>
  );
}
