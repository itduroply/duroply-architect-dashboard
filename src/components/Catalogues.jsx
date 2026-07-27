import React, { useMemo } from 'react';
import { 
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box, 
  Typography, 
  Button, 
  CardMedia,
  Chip
} from '@mui/material';
import { 
  FileDownloadOutlined as FileDownloadIcon
} from '@mui/icons-material';

// Asset Imports
import catalogFile1 from './Digital_Bohemia_Catalog.pdf';
import catalogFile2 from './Duro_Catalogue.pdf';
import catalogFile3 from './Dyed_Veneers_catalogue.pdf';
import catalogFile4 from './Kohinoor_of_Veneers_digital.pdf';
import catalogFile5 from './MASTERPIECE_2026.pdf';

import image1 from './image1.jpeg'; 
import image2 from './image2.jpeg';
import image3 from './image3.jpeg';
import image4 from './image4.jpeg';
import image5 from './image5.jpeg';

// ==========================================
// 🌟 LIGHT LUXURY SHOWROOM THEME
// ==========================================
const premiumLuxeTheme = createTheme({
  palette: {
    mode: 'light',
    background: { 
      default: '#FAFAFA', 
      paper: '#FFFFFF' 
    },
    primary: { main: '#B89047' }, // Soft Metallic Gold
    text: { 
      primary: '#1A1A1A', 
      secondary: '#707070' 
    },
  },
  typography: {
    fontFamily: '"Inter", "-apple-system", BlinkMacSystemFont, sans-serif',
    h4: {
      fontWeight: 300,
      letterSpacing: '1px',
      color: '#1A1A1A',
      textTransform: 'uppercase'
    },
    h6: { 
      fontWeight: 600, 
      letterSpacing: '-0.2px',
      fontSize: '1rem',
      color: '#1A1A1A'
    },
    body2: { 
      fontSize: '0.825rem',
      lineHeight: 1.6,
      color: '#666666'
    },
    caption: {
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#B89047'
    }
  }
});

export default function CatalogShowcase() {
  
  const catalogList = useMemo(() => [
    { 
      id: 'cat-01', 
      title: 'MASTERPIECE VENEERS', 
      catalogName: 'Nature Signature',
      category: 'Premium Veneers', 
      size: '7.77 MB', 
      version: 'v1.1', 
      fileAsset: catalogFile1, 
      imageAsset: image1,
      description: 'Comprehensive architectural layouts, premium color palettes, and structural wood veneer matrices.',
    },
    { 
      id: 'cat-02', 
      title: 'KOHINOOR OF VENEERS', 
      catalogName: 'Nature Signature',
      category: 'Eco Certified', 
      size: '18.6 MB', 
      version: 'v1.2', 
      fileAsset: catalogFile2, 
      imageAsset: image2,
      description: 'Eco-certified compliance layouts, tracking, and structural high-grade materials catalog.',
    },
    { 
      id: 'cat-03', 
      title: 'DYED VENEERS', 
      catalogName: 'Nature Signature',
      category: 'Treated Surfaces', 
      size: '4.62 MB', 
      version: 'v1.3', 
      fileAsset: catalogFile3, 
      imageAsset: image3,
      description: 'Technical grading charts, moisture resistance indices, and pristine treated finish guides.',
    },
    { 
      id: 'cat-04', 
      title: 'PRODUCT RANGE', 
      catalogName: 'Nature Signature',
      category: 'High Density', 
      size: '50.0 MB', 
      version: 'v1.4', 
      fileAsset: catalogFile4, 
      imageAsset: image4,
      description: 'High-density spatial design metrics, zoning layouts, and elite material surface configurations.',
    },
    { 
      id: 'cat-05', 
      title: 'BOHEMIA VENEERS', 
      catalogName: 'Nature Signature',
      category: 'Smart Systems', 
      size: '22.1 MB', 
      version: 'v1.5', 
      fileAsset: catalogFile5, 
      imageAsset: image5,
      description: 'Smart infrastructure asset schematics, advanced telemetry routing, and system integrations.',
    }
  ], []);

  return (
    <ThemeProvider theme={premiumLuxeTheme}>
      <CssBaseline />
      <Box sx={{ 
        p: { xs: 2, md: 4 }, 
        display: 'flex', 
        justifyContent: 'center', 
        bgcolor: 'background.default', 
        minHeight: '100vh' 
      }}>
        <Box sx={{ width: '100%', maxWidth: '1200px', mx: 'auto' }}>
          
          {/* ==========================================
              🏆 MINIMALIST LUXURY HEADER
          ========================================== */}
          <Box sx={{ mb: 6, mt: 2 }}>
            <Typography variant="caption" component="span" sx={{ display: 'block', mb: 0.5 }}>
              Curated Architectural Materials
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              The FindIt <span style={{ fontWeight: 300, color: '#B89047' }}>Collection</span>
            </Typography>
          </Box>

          {/* ==========================================
              📋 GALLERY GRID
          ========================================== */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
            gap: 4 
          }}>
            {catalogList.map((catalog) => {
              return (
                <Box 
                  key={catalog.id}
                  sx={{
                    backgroundColor: 'background.paper',
                    borderRadius: '4px',
                    p: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid #EAEAEA',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: '#B89047',
                      boxShadow: '0 12px 30px rgba(184, 144, 71, 0.08)',
                      '& .catalog-media': { transform: 'scale(1.03)' },
                      '& .gold-btn': { bgcolor: '#1A1A1A', color: '#FFFFFF' }
                    }
                  }}
                >
                  <Box>
                    {/* Visual Preview Window */}
                    <Box sx={{
                      width: '100%',
                      aspectRatio: '16 / 10',
                      overflow: 'hidden',
                      borderRadius: '2px',
                      mb: 2.5,
                      bgcolor: '#F5F5F5'
                    }}>
                      <CardMedia
                        component="img"
                        image={catalog.imageAsset}
                        alt={catalog.title}
                        className="catalog-media"
                        sx={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          transition: 'transform 0.5s ease'
                        }}
                      />
                    </Box>

                    {/* Meta Indicators */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Chip 
                        label={catalog.category} 
                        size="small" 
                        sx={{ 
                          height: '18px',
                          backgroundColor: 'rgba(184, 144, 71, 0.08)', 
                          color: '#B89047',
                          fontWeight: 700,
                          fontSize: '0.6rem',
                          borderRadius: '2px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          border: 'none'
                        }} 
                      />
                      <Typography sx={{ color: '#A0A0A0', fontWeight: 600, fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        {catalog.catalogName}
                      </Typography>
                    </Box>
                    
                    {/* Content */}
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {catalog.title}
                    </Typography>

                    <Typography variant="body2" sx={{ mb: 3 }}>
                      {catalog.description}
                    </Typography>
                  </Box>

                  {/* Operational Footer */}
                  <Box>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      mb: 2,
                      px: 0.5 
                    }}>
                      <Box>
                        <Typography sx={{ display: 'block', fontSize: '0.6rem', color: '#AAAAAA', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Version</Typography>
                        <Typography sx={{ fontWeight: 500, color: '#1A1A1A', fontSize: '0.75rem' }}>
                          {catalog.version}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ display: 'block', fontSize: '0.6rem', color: '#AAAAAA', textTransform: 'uppercase', letterSpacing: '0.5px' }}>File Size</Typography>
                        <Typography sx={{ fontWeight: 600, color: '#1A1A1A', fontSize: '0.75rem' }}>
                          {catalog.size}
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      component="a"
                      href={catalog.fileAsset}
                      download={`${catalog.title}.pdf`}
                      variant="outlined"
                      fullWidth
                      startIcon={<FileDownloadIcon sx={{ fontSize: '16px !important' }} />}
                      className="gold-btn"
                      sx={{
                        textTransform: 'uppercase',
                        color: '#1A1A1A',
                        letterSpacing: '1px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        py: 1,
                        borderRadius: '2px',
                        borderColor: '#1A1A1A',
                        backgroundColor: 'transparent',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Download Catalog
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>

        </Box>
      </Box>
    </ThemeProvider>
  );
}