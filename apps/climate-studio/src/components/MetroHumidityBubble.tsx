import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface MetroHumidityBubbleProps {
  // Dot props
  dotSize?: number;
  dotColor?: string;

  // Data props
  metroName: string;
  year: string | number;
  peakHumidity: string; // Peak humidity value (e.g., "68%")
  wetBulbEvents: string; // Number of wet bulb events (e.g., "35")
  humidTemp: string; // Humid temperature (e.g., "128°")
  daysOver100: string; // Days over 100° (e.g., "58")

  // Visibility controls
  visible: boolean;
  showHumidityWetBulb?: boolean;  // Show humidity & wet bulb section
  showTempHumidity?: boolean; // Show temperature & humidity section
  showAverageTemperatures?: boolean; // Show average summer/winter temperatures
  summerAvg?: string; // Summer average temperature (e.g., "85.2°F")
  winterAvg?: string; // Winter average temperature (e.g., "42.1°F")
  onClose: () => void;
  onHover?: () => void;
  onHoverEnd?: () => void;
  // Active state management
  isActive?: boolean;
  onClick?: () => void;
}

export const MetroHumidityBubble: React.FC<MetroHumidityBubbleProps> = ({
  dotSize = 6,
  dotColor = '#8b5cf6', // Purple for humidity
  metroName,
  year,
  peakHumidity,
  wetBulbEvents,
  humidTemp,
  daysOver100,
  visible,
  showHumidityWetBulb = true,
  showTempHumidity = true,
  showAverageTemperatures = false,
  summerAvg,
  winterAvg,
  onClose,
  onHover,
  onHoverEnd,
  isActive: isActiveProp,
  onClick,
}) => {
  const [internalIsActive, setInternalIsActive] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);

  // Use prop if provided, otherwise use internal state
  const isActive = isActiveProp !== undefined ? isActiveProp : internalIsActive;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      // Fallback to internal state management
      const newActiveState = !internalIsActive;
      setInternalIsActive(newActiveState);
      if (newActiveState) {
        onHover?.();
      } else {
        onHoverEnd?.();
      }
    }
  };

  // Handle clicks outside to deactivate (only if using internal state)
  useEffect(() => {
    if (isActiveProp !== undefined) return; // Don't handle if parent manages state

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setInternalIsActive(false);
        onHoverEnd?.();
      }
    };

    if (internalIsActive) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [internalIsActive, isActiveProp, onHoverEnd]);

  // Styles object - recompute when isHovered changes
  const styles = useMemo(() => ({
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
      zIndex: isActive ? 1000 : 100, // Higher z-index when active to bring to top
    },
    tooltip: {
      backgroundColor: isDark ? 'rgba(16, 23, 40, 0.85)' : 'rgba(255, 255, 255, 0.85)',
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
      borderTop: isDark ? '5.25px solid rgba(16, 23, 40, 0.85)' : '5.25px solid rgba(255, 255, 255, 0.85)',
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
    valueLabel: {
      fontWeight: 500,
      color: isDark ? '#d1d5db' : '#697487',
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
  }), [isActive, visible, dotSize, isDark]);

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Tooltip - Always show container, but only show sections if checkboxes are on */}
      {visible && (
        <div style={styles.tooltipContainer}>
          <div
            style={styles.tooltip}
            onClick={handleClick}
          >
            {/* Header: City and Year - Always visible */}
            <div style={styles.header}>
              <div style={styles.headerContent}>
                <span style={styles.cityText}>{metroName}</span>
                <span style={styles.yearText}>{year}</span>
              </div>
            </div>

            {/* Section 1: Humidity & Wet Bulb Events - Only show if showHumidityWetBulb is true */}
            {showHumidityWetBulb && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>Humidity & Wet Bulb Events</div>
                <div style={styles.section2Grid}>
                  {/* Peak Humidity */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>Peak Humidity</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{peakHumidity}</span>
                    </div>
                  </div>
                  {/* # Wet Bulbs */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}># Wet Bulbs</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{wetBulbEvents}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Temperature & Humidity - Only show if showTempHumidity is true */}
            {showTempHumidity && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>Temperature & Humidity</div>
                <div style={styles.section2Grid}>
                  {/* Humid Temp */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>Humid Temp</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{humidTemp}</span>
                    </div>
                  </div>
                  {/* 100°+ Days */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>100°+ Days</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{daysOver100}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Average Temperatures - Only show if showAverageTemperatures is true */}
            {showAverageTemperatures && summerAvg && winterAvg && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>Average Temperatures</div>
                <div style={styles.section2Grid}>
                  {/* Summer Average */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>Summer Avg</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{summerAvg}</span>
                    </div>
                  </div>
                  {/* Winter Average */}
                  <div style={styles.section2Item}>
                    <div style={styles.label}>Winter Avg</div>
                    <div style={styles.section2ValueRow}>
                      <span style={styles.valueBold}>{winterAvg}</span>
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

export default MetroHumidityBubble;
