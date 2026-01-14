import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface MetroTooltipBubbleProps {
  // Dot props
  dotSize?: number;
  dotColor?: string;

  // Data props
  metroName: string;
  year: string | number;
  population: string; // Population value to display (e.g., "9,000,000")
  populationChange: string; // Change percentage (e.g., "(+25%)")
  populationChangeColor?: string; // Color for the change text
  summerTemp: string;
  summerTempChange: string;
  winterTemp: string;
  winterTempChange: string;

  // Visibility controls
  visible: boolean;
  showPopulation?: boolean;  // Show population section
  showTemperature?: boolean; // Show temperature section
  onClose: () => void;
  onHover?: () => void;
  onHoverEnd?: () => void;
}

export const MetroTooltipBubble: React.FC<MetroTooltipBubbleProps> = ({
  dotSize = 6,
  dotColor = '#101728',
  metroName,
  year,
  population,
  populationChange,
  populationChangeColor = '#00a03c',
  summerTemp,
  summerTempChange,
  winterTemp,
  winterTempChange,
  visible,
  showPopulation = true,
  showTemperature = true,
  onClose,
  onHover,
  onHoverEnd,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHoverEnd?.();
  };

  // Styles object
  const styles = {
    container: {
      position: 'relative' as const,
      width: `${dotSize}px`,
      height: `${dotSize}px`,
      display: 'inline-block',
    },
    dot: {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${dotSize}px`,
      height: `${dotSize}px`,
      borderRadius: '50%',
      backgroundColor: dotColor,
      zIndex: 10,
    },
    tooltipContainer: {
      position: 'absolute' as const,
      bottom: `${dotSize / 2 + 5}px`, // Raised by 5px so arrow tip touches dot center
      left: '50%',
      transform: 'translateX(-50%)',
      opacity: visible ? 1 : 0,
      visibility: (visible ? 'visible' : 'hidden') as const,
      transition: 'opacity 0.2s ease, visibility 0.2s ease',
      pointerEvents: 'none' as const,
      zIndex: 100,
    },
    tooltip: {
      backgroundColor: isDark ? 'rgba(16, 23, 40, 0.5)' : 'rgba(255, 255, 255, 0.5)',
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      borderRadius: '8px',
      padding: '4px',
      width: '175px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
      boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
      pointerEvents: 'auto' as const,
    },
    tooltipArrow: {
      position: 'absolute' as const,
      bottom: '-5px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0,
      height: 0,
      borderLeft: '4.76px solid transparent',
      borderRight: '4.76px solid transparent',
      borderTop: isDark ? '5.25px solid rgba(16, 23, 40, 0.5)' : '5.25px solid rgba(255, 255, 255, 0.5)',
    },
    header: {
      borderRadius: '4px',
      overflow: 'hidden' as const,
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 8px',
      fontSize: '10px',
      lineHeight: 'normal',
      color: isDark ? '#ffffff' : '#101728',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    cityText: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
    },
    yearText: {
      fontWeight: 600,
    },
    section: {
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.35)' : 'rgba(255, 255, 255, 0.35)',
      borderRadius: '4px',
      overflow: 'hidden' as const,
    },
    sectionHeader: {
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.35)' : 'rgba(255, 255, 255, 0.35)',
      padding: '4px 8px',
      fontSize: '10px',
      fontWeight: 600,
      color: isDark ? '#A6A6A6' : '#65758B',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      lineHeight: 'normal',
    },
    sectionContent: {
      padding: '4px 8px',
    },
    valueRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '12px',
      lineHeight: 'normal',
    },
    valueBold: {
      fontWeight: 700,
      color: isDark ? '#ffffff' : '#101728',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    changeText: {
      fontWeight: 500,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    section2Grid: {
      display: 'flex',
      gap: 0,
    },
    section2Item: {
      flex: 1,
      padding: '4px 8px',
    },
    label: {
      fontSize: '9px',
      fontWeight: 500,
      color: isDark ? '#d1d5db' : '#101728',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      marginBottom: '2px',
      lineHeight: 'normal',
    },
    section2ValueRow: {
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
      fontSize: '12px',
      lineHeight: 'normal',
    },
    section2Change: {
      fontSize: '11px',
      fontWeight: 500,
      color: isDark ? '#9ca3af' : '#697487',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    closeButton: {
      position: 'absolute' as const,
      top: '-6px',
      right: '-6px',
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#666',
      border: 'none',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: 'bold' as const,
      zIndex: 10,
      pointerEvents: 'auto' as const,
    },
  };

  return (
    <div style={styles.container}>
      {/* Tooltip - Always show container, but only show sections if checkboxes are on */}
      {visible && (
        <div style={styles.tooltipContainer}>
          <div
            style={styles.tooltip}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header: City and Year - Always visible */}
            <div style={styles.header}>
              <div style={styles.headerContent}>
                <span style={styles.cityText}>{metroName}</span>
                <span style={styles.yearText}>{year}</span>
              </div>
            </div>

            {/* Section 1: Population Change - Only show if showPopulation is true */}
            {showPopulation && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>Population Change</div>
                <div style={styles.sectionContent}>
                  <div style={styles.valueRow}>
                    <span style={styles.valueBold}>{population}</span>
                    <span style={{ ...styles.changeText, color: populationChangeColor }}>
                      {populationChange}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Temperature Change - Only show if showTemperature is true */}
            {showTemperature && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>Avg Temperature Change</div>
                <div style={styles.section2Grid}>
                  {/* Summer */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>Summer</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{summerTemp}</span>
                      <span style={styles.section2Change}>{summerTempChange}</span>
                    </div>
                  </div>
                  {/* Winter */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>Winter</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{winterTemp}</span>
                      <span style={styles.section2Change}>{winterTempChange}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Triangle arrow */}
          <div style={styles.tooltipArrow} />
        </div>
      )}

      {/* Fixed dot - centered at the metro location */}
      <div style={styles.dot} />
    </div>
  );
};

export default MetroTooltipBubble;
