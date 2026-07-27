import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaExchangeAlt, 
  FaMapMarkerAlt, 
  FaBookOpen, 
  FaUser, 
  FaSignOutAlt, 
  FaCog, 
  FaBars, 
  FaTimes 
} from 'react-icons/fa';
import { BiSupport } from "react-icons/bi";
import { supabase } from '../supabaseClient'; 

// MUI Imports
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Avatar, 
  Button,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Drawer,
  IconButton,
  useMediaQuery
} from '@mui/material';

// Custom Luxury Theme
const luxuryTheme = createTheme({
  palette: {
    background: {
      default: '#F8F9FA', 
    },
    text: {
      primary: '#0D0D0D',   
      secondary: '#666666', 
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    h1: {
      fontFamily: "'Playfair Display', 'Didot', 'Georgia', serif",
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.95rem',
      letterSpacing: '-0.01em',
    },
  },
});

const MainLayout = ({ onLogout, account_number }) => {
  const location = useLocation();
  const [influencerName, setInfluencerName] = useState('Loading...');
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Check if screen width is below desktop (1200px)
  const isMobile = useMediaQuery(luxuryTheme.breakpoints.down('lg'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Fetch the influencer_name matching the account_number
  useEffect(() => {
    const fetchArchitectDetails = async () => {
      if (!account_number) return;

      try {
        const { data, error } = await supabase
          .from('master_architect')
          .select('influencer_name')
          .eq('account_number', account_number)
          .single();

        if (error) throw error;
        
        if (data && data.influencer_name) {
          const rawName = data.influencer_name.trim();
          
          // FORMATTING LOGIC: Deduplicates repeating names like "Harman Singh Harman Singh"
          const words = rawName.split(/\s+/);
          const uniqueWords = words.filter((word, index) => words.indexOf(word) === index);
          const cleanName = uniqueWords.join(' ');

          setInfluencerName(cleanName);
        }
      } catch (error) {
        console.error('Error fetching data from master_architect:', error.message);
        setInfluencerName('User');
      }
    };

    fetchArchitectDetails();
  }, [account_number]);

  const routeHeadings = {
    '/': 'Dashboard Overview',
    '/remittance': 'Transactions Analysis',
    '/locations': 'Project Sites Overview',
    '/catalogues': 'Product Catalogues',
    '/profile': 'Architect Profile',
    '/master': 'Sheet Value',
    '/query': 'Customer Support',
  };

  const currentHeading = routeHeadings[location.pathname] || 'Architect Portal';

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <FaTachometerAlt /> },
    { path: '/remittance', label: 'Payments', icon: <FaExchangeAlt /> },
    { path: '/locations', label: 'Site Details', icon: <FaMapMarkerAlt /> },
    { path: '/catalogues', label: 'Catalogues', icon: <FaBookOpen /> },
    { path: '/query', label: 'Help Desk', icon: <BiSupport /> },
    { path: '/master', label: 'Sheet Price', icon: <FaCog /> },
    { path: '/profile', label: 'Profile', icon: <FaUser /> },
  ];

  // Extracted Sidebar Content
  const sidebarContent = (
    <>
      {/* Brand/Logo Section with internal Mobile Close Button */}
      <Box sx={{ mb: 6, p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700, 
            letterSpacing: '0.1em', 
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: '1.1rem'
          }}
        >
          <Box 
            component="span" 
            sx={{ 
              background: 'linear-gradient(135deg, #8A6414 0%, #C5A059 40%, #684C0B 70%, #966B24 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: "'Playfair Display', 'Georgia', serif", 
              fontStyle: 'italic', 
              fontWeight: 900, 
              fontSize: '1.2rem', 
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
              display: 'inline-block',
              filter: 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.15))',
              mx: 0.5
            }}
          >
            Design Partner+
          </Box>
        </Typography>

        {/* Dynamic Cross Icon: Inside Mobile Drawer Layout frame */}
        {isMobile && (
          <IconButton 
            onClick={handleDrawerToggle}
            sx={{ color: '#0D0D0D', p: 0.5 }}
          >
            <FaTimes size={20} />
          </IconButton>
        )}
      </Box>
      
      {/* Navigation Links */}
      <Box component="nav">
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 0 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={() => isMobile && setMobileOpen(false)}
                  sx={{
                    borderRadius: '50px',
                    px: 2.5,
                    py: 1.5,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: isActive ? '#0D0D0D' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#555555',
                    '&:hover': {
                      backgroundColor: isActive ? '#0D0D0D' : 'rgba(0, 0, 0, 0.04)',
                      color: isActive ? '#FFFFFF' : '#0D0D0D',
                      transform: isActive ? 'none' : 'translateX(4px)'
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 36, 
                      color: 'inherit',
                      fontSize: '1.1rem'
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label} 
                    primaryTypographyProps={{ 
                      fontSize: '0.9rem', 
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: '0.02em'
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* SIGN OUT ELEMENT */}
      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          onClick={onLogout}
          fullWidth
          startIcon={<FaSignOutAlt />}
          sx={{
            borderRadius: '50px',
            py: 1.5,
            color: '#666666',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.9rem',
            border: '1px solid rgba(0,0,0,0.08)',
            backgroundColor: 'rgba(255,255,255,0.6)',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: '#0D0D0D',
              color: '#FFFFFF',
              borderColor: '#0D0D0D'
            }
          }}
        >
          Sign Out
        </Button>
      </Box>
    </>
  );

  return (
    <ThemeProvider theme={luxuryTheme}>
      <CssBaseline />
      
      <Box 
        sx={{ 
          display: 'flex', 
          minHeight: '100vh',
          background: 'radial-gradient(circle at top right, #FFF7E6 0%, #F4F6F8 45%, #FFFFFF 100%)',
          p: { xs: 2, md: 3 },
          gap: 3
        }}
      >
        {/* DESKTOP SIDEBAR */}
        <Box 
          component="aside" 
          sx={{ 
            width: 320, 
            position: 'fixed',
            top: 0,         
            bottom: 0,
            left: 0,
            zIndex: 100,
            backgroundColor: '#FFFFFF', 
            borderRadius: '24px',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            display: { xs: 'none', lg: 'flex' }, 
            flexDirection: 'column',
            p: 3,
            boxShadow: '0 10px 40px rgba(13, 13, 13, 0.05)' 
          }}
        >
          {sidebarContent}
        </Box>

        {/* MOBILE SIDEBAR (DRAWER) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: 280,
              p: 3,
              borderTopRightRadius: '24px',
              borderBottomRightRadius: '24px',
              border: 'none',
              boxShadow: '10px 0 40px rgba(13, 13, 13, 0.05)'
            },
          }}
        >
          {sidebarContent}
        </Drawer>

        {/* MAIN BODY FRAME */}
        <Box 
          sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3,
            marginLeft: { xs: 0, lg: '304px' }, 
            width: '100%'
          }}
        >
          {/* FLOATING NAVBAR */}
          <Box 
            component="header" 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.45)', 
              backdropFilter: 'blur(30px)',
              borderRadius: '24px',
              p: { xs: '12px 16px', sm: '16px 32px' },
              border: '1px solid rgba(255, 255, 255, 0.7)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.01)',
              position: 'sticky', 
              top: 0,
              zIndex: 90
            }}
          >
            {/* Left Section: Main Hamburger Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {!mobileOpen && (
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ display: { lg: 'none' }, color: '#0D0D0D' }}
                >
                  <FaBars size={20} />
                </IconButton>
              )}
              
              <Typography 
                variant="h1" 
                sx={{ 
                  fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' }, 
                  color: '#0D0D0D',
                  letterSpacing: '-0.02em',
                  ml: mobileOpen ? { xs: 4, lg: 0 } : 0
                }}
              >
                {currentHeading}
              </Typography>
            </Box>
            
            {/* Topbar User Widget Displaying clean "Welcome, Mr. Harman Singh" */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 1, sm: 1.5 },
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                borderRadius: '50px',
                p: { xs: '4px 8px', sm: '6px 18px 6px 8px' },
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}
            >
              <Avatar 
                sx={{ 
                  bgcolor: '#0D0D0D', 
                  width: { xs: 28, sm: 36 }, 
                  height: { xs: 28, sm: 36 },
                  fontSize: '0.95rem'
                }}
              >
                <FaUser size={isMobile ? 10 : 14} />
              </Avatar>
              
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.88rem' }, fontWeight: 600, color: '#0D0D0D', lineHeight: 1.2 }}>
                  Welcome, {influencerName}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.62rem', sm: '0.7rem' }, color: '#666666', fontFamily: 'monospace', mt: 0.25 }}>
                  {account_number || '—'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ROUTE VIEW AREA */}
          <Box 
            component="main" 
            sx={{ 
              flexGrow: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.4)', 
              backdropFilter: 'blur(20px)',
              borderRadius: '24px', 
              p: { xs: 2, sm: 3, md: 4 },
              border: '1px solid rgba(255, 255, 255, 0.6)',
              boxShadow: '0 30px 60px rgba(0,0,0,0.015)'
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;