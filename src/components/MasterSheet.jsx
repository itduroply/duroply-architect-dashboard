import React, { useState, useEffect, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  FilterListOutlined as FilterIcon
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';

// ==========================================
// 🎨 LIGHT LUXURY EDITORIAL SHOWROOM THEME
// ==========================================
const premiumInventoryTheme = createTheme({
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
    h4: {
      fontWeight: 700,
      color: '#1A1A1A',
      letterSpacing: '-0.03em',
    },
    h6: {
      fontWeight: 600,
      color: '#1A1A1A',
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontFamily: 'ui-monospace, monospace',
      fontWeight: 600,
      fontSize: '0.85rem',
      color: '#B89047' 
    },
    body2: {
      fontSize: '0.825rem',
      color: '#555555',
      lineHeight: 1.6
    },
    caption: {
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#B89047' 
    }
  },
  components: {
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: '44px',
          borderBottom: '1px solid #EAEAEA',
          '& .MuiTabs-indicator': {
            height: '2px',
            backgroundColor: '#B89047' 
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: '44px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: 700,
          fontSize: '0.75rem',
          padding: '6px 0px',
          marginRight: '32px',
          color: '#707070',
          minWidth: 'auto',
          transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          '&:hover': { color: '#1A1A1A' },
          '&.Mui-selected': {
            color: '#1A1A1A',
          }
        }
      }
    }
  }
});

const ProductCatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  useEffect(() => {
    const fetchCatalogData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('product_sku_master')
          .select('group, sku, size, price');

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Error retrieving product matrix:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogData();
  }, []);

  // =========================================================
  // 🔄 DATA PIVOT SYSTEM (Maintained Exactly As Original)
  // =========================================================
  const structuredMatrices = useMemo(() => {
    const initialStructure = {
      PW: { title: "Plywood", sizes: new Set(), rows: {} },
      BB: { title: "Blockboard", sizes: new Set(), rows: {} },
      FD: { title: "Flush Doors", sizes: new Set(), rows: {} },
      DECORATIVE: { title: "Decorative Veneer", sizes: new Set(), rows: {} }
    };

    const extractBaseBrandName = (rawSku) => {
      if (!rawSku) return 'UNASSIGNED BRAND';
      let cleanName = rawSku.trim().toUpperCase();
      
      cleanName = cleanName.replace(/^(PW|BB|FD|DECORATIVE)-\s*/i, '');
      cleanName = cleanName.replace(/\b\d+\s*MM\b/gi, '');
      cleanName = cleanName.replace(/^[- ]+|[- ]+$/g, '');
      
      return cleanName || rawSku;
    };

    products.forEach((item) => {
      const rawGroup = (item.group || '').trim().toUpperCase();
      let categoryKey = 'PW';

      if (rawGroup.includes('BLOCK') || rawGroup === 'BB') {
        categoryKey = 'BB';
      } else if (rawGroup.includes('DOOR') || rawGroup === 'FD' || rawGroup.includes('FLUSH')) {
        categoryKey = 'FD';
      } else if (rawGroup.includes('DECOR') || rawGroup === 'DECORATIVE' || rawGroup.includes('VENEER')) {
        categoryKey = 'DECORATIVE';
      } else {
        categoryKey = 'PW';
      }

      const brandName = extractBaseBrandName(item.sku);
      const rawSize = (item.size || '').trim().toLowerCase();
      const isMultiSizeTable = categoryKey === 'PW' || categoryKey === 'BB';
      const sizeHeader = isMultiSizeTable ? (rawSize || 'Standard') : 'Values';

      if (rawSize || !isMultiSizeTable) {
        initialStructure[categoryKey].sizes.add(sizeHeader);
      }

      if (!initialStructure[categoryKey].rows[brandName]) {
        initialStructure[categoryKey].rows[brandName] = {};
      }
      
      initialStructure[categoryKey].rows[brandName][sizeHeader] = item.price;
    });

    Object.keys(initialStructure).forEach((key) => {
      const sizeArray = Array.from(initialStructure[key].sizes);
      if (key === 'PW' || key === 'BB') {
        sizeArray.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      }
      initialStructure[key].sizes = sizeArray.length > 0 ? sizeArray : ['Values'];
    });

    return initialStructure;
  }, [products]);

  const renderStructureTable = (matrixData) => {
    const brandEntries = Object.keys(matrixData.rows);
    const hasSubThicknessHeaders = matrixData.sizes.length > 1 || matrixData.sizes[0] !== 'Values';

    if (brandEntries.length === 0) return null;

    return (
      <Box sx={{ mb: 6, width: '100%' }}>
        <Typography variant="caption" sx={{ display: 'block', mb: 2, fontSize: '0.75rem' }}>
          {matrixData.title}
        </Typography>
        <TableContainer 
          component={Paper} 
          elevation={0} 
          sx={{ 
            background: '#FFFFFF', 
            borderRadius: '4px', 
            border: '1px solid #EAEAEA',
            boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
            width: '100%',
            overflowX: 'auto', // Enforces smooth horizontal panning on smaller touch displays
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { height: '6px' }, // Clean, subtle mobile scrollbar visual
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }
          }}
        >
          <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: { xs: 500, sm: '100%' } }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#FAFAFA' }}>
                <TableCell 
                  rowSpan={hasSubThicknessHeaders ? 2 : 1} 
                  sx={{ color: '#1A1A1A', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', py: 2, px: 2.5, borderRight: '1px solid #EAEAEA', borderBottom: '2px solid #1A1A1A', whiteSpace: 'nowrap' }}
                >
                  Brand Specifications
                </TableCell>
                <TableCell 
                  colSpan={matrixData.sizes.length} 
                  align="center"
                  sx={{ color: '#1A1A1A', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', py: 1.5, px: 2, borderBottom: hasSubThicknessHeaders ? '1px solid #EAEAEA' : '2px solid #1A1A1A' }}
                >
                  Value
                </TableCell>
              </TableRow>
              {hasSubThicknessHeaders && (
                <TableRow sx={{ backgroundColor: '#FAFAFA' }}>
                  {matrixData.sizes.map((size, idx) => (
                    <TableCell 
                      key={idx} 
                      align="center"
                      sx={{ color: '#707070', fontSize: '0.65rem', fontWeight: 700, py: 1.2, px: 1, textTransform: 'uppercase', borderRight: idx < matrixData.sizes.length - 1 ? '1px solid #EAEAEA' : 'none', borderBottom: '2px solid #1A1A1A', minWidth: '70px' }}
                    >
                      {size}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {brandEntries.map((brandName, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  sx={{
                    backgroundColor: rowIndex % 2 === 0 ? '#FFFFFF' : '#FCFCFC',
                    transition: 'background-color 0.2s ease',
                    '&:hover': { backgroundColor: 'rgba(184, 144, 71, 0.04)' }
                  }}
                >
                  <TableCell sx={{ py: 1.5, px: 2.5, borderRight: '1px solid #EAEAEA', borderBottom: '1px solid #EAEAEA', fontWeight: 700, color: '#1A1A1A', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {brandName}
                  </TableCell>
                  {matrixData.sizes.map((size, colIndex) => {
                    const priceValue = matrixData.rows[brandName][size];
                    return (
                      <TableCell 
                        key={colIndex} 
                        align={hasSubThicknessHeaders ? "center" : "right"}
                        sx={{ py: 1.5, px: 2.5, borderRight: colIndex < matrixData.sizes.length - 1 ? '1px solid #EAEAEA' : 'none', borderBottom: '1px solid #EAEAEA', fontFamily: 'ui-monospace, monospace', fontWeight: 600, fontSize: '0.825rem', color: priceValue ? '#1A1A1A' : '#D0D0D0' }}
                      >
                        {priceValue ? `${parseFloat(priceValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', bgcolor: '#FAFAFA' }}>
        <CircularProgress size={22} thickness={4} sx={{ color: '#B89047' }} />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={premiumInventoryTheme}>
      <CssBaseline />
      <Box sx={{ 
        pt: 0, 
        pb: 4, 
        px: { xs: 1, sm: 2, md: 4 }, // Fluid downscaling of core canvas padding
        bgcolor: 'background.default', 
        minHeight: '100vh', 
        width: '100%' 
      }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>

          {/* Filtering Control Layout Container - Responsive Flex adjustments */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, 
            alignItems: { xs: 'flex-start', sm: 'center' }, 
            gap: { xs: 1, sm: 2 }, 
            mb: 4, 
            pt: 0 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#B89047', pt: { xs: 1, sm: 0 } }}>
              <FilterIcon sx={{ fontSize: '1rem' }} />
              <Typography variant="caption" sx={{ color: '#1A1A1A', fontWeight: 700 }}>Filter View:</Typography>
            </Box>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
              <Tabs
                value={selectedFilter}
                onChange={(e, nextValue) => setSelectedFilter(nextValue)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile // Enables click buttons next to swiping tabs on mobile screens
              >
                <Tab label="All Categories" value="ALL" />
                <Tab label="Plywood" value="PW" />
                <Tab label="Blockboard" value="BB" />
                <Tab label="Doors" value="FD" />
                <Tab label="Decorative Veneers" value="DECORATIVE" />
              </Tabs>
            </Box>
          </Box>

          {/* Render Flow Canvas */}
          {products.length === 0 ? (
            <Box sx={{ py: 10, textAlign: 'center', border: '1px dashed #B89047', borderRadius: '4px', bgcolor: '#FFFFFF', mx: { xs: 1, sm: 0 } }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No active pricing metrics available in this view segment.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
              {(selectedFilter === 'ALL' || selectedFilter === 'PW') && 
                renderStructureTable(structuredMatrices.PW)
              }
              {(selectedFilter === 'ALL' || selectedFilter === 'BB') && 
                renderStructureTable(structuredMatrices.BB)
              }
              {(selectedFilter === 'ALL' || selectedFilter === 'FD') && 
                renderStructureTable(structuredMatrices.FD)
              }
              {(selectedFilter === 'ALL' || selectedFilter === 'DECORATIVE') && 
                renderStructureTable(structuredMatrices.DECORATIVE)
              }
            </Box>
          )}

        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default ProductCatalogPage;