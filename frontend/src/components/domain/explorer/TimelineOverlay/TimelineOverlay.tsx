import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Calendar, TrendingUp, Filter, X, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/utils/class-names/cn';

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'modified' | 'accessed' | 'deleted';
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  details?: string;
}

export interface TimelineFilter {
  startDate: Date | null;
  endDate: Date | null;
  eventTypes: Set<string>;
  minFileSize: number;
  maxFileSize: number;
  pathPattern: string;
}

export interface TimelineStats {
  totalEvents: number;
  filesCounted: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  eventTypeBreakdown: Record<string, number>;
  activityByHour: Record<number, number>;
  largestFiles: TimelineEvent[];
}

export interface TimelineOverlayProps {
  /** Whether overlay is visible */
  isVisible: boolean;
  /** Called when overlay should be closed */
  onClose: () => void;
  /** Volume ID to analyze */
  volumeId: string;
  /** Path to analyze */
  path?: string;
  /** Initial time range (days back) */
  timeRangeDays?: number;
  /** Called when file is clicked */
  onFileClick?: (event: TimelineEvent) => void;
  /** Called when time range changes */
  onTimeRangeChange?: (start: Date, end: Date) => void;
}

type TimelineView = 'timeline' | 'heatmap' | 'stats';

/**
 * Timeline overlay for visualizing file system activity over time
 */
export const TimelineOverlay: React.FC<TimelineOverlayProps> = ({
  isVisible,
  onClose,
  volumeId,
  path = '/',
  timeRangeDays = 30,
  onFileClick,
  onTimeRangeChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [currentView, setCurrentView] = useState<TimelineView>('timeline');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [filters, setFilters] = useState<TimelineFilter>({
    startDate: new Date(Date.now() - timeRangeDays * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    eventTypes: new Set(['created', 'modified', 'accessed', 'deleted']),
    minFileSize: 0,
    maxFileSize: 0,
    pathPattern: '',
  });

  // Mock data generation
  const generateMockEvents = useCallback(() => {
    const eventTypes: TimelineEvent['type'][] = ['created', 'modified', 'accessed', 'deleted'];
    const mockEvents: TimelineEvent[] = [];
    const now = new Date();
    const startDate = new Date(now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);

    // Generate 200-500 events over the time range
    const eventCount = 200 + Math.random() * 300;
    
    for (let i = 0; i < eventCount; i++) {
      const timestamp = new Date(
        startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime())
      );
      
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const fileId = `file-${Math.floor(Math.random() * 1000)}`;
      
      // Generate realistic file names based on type
      const extensions = ['.jpg', '.mp4', '.pdf', '.docx', '.txt', '.zip', '.json'];
      const names = ['document', 'image', 'video', 'report', 'backup', 'config', 'data'];
      const fileName = `${names[Math.floor(Math.random() * names.length)]}_${Math.floor(Math.random() * 100)}${extensions[Math.floor(Math.random() * extensions.length)]}`;
      const filePath = `${path}/${fileName}`;
      
      const fileSize = Math.floor(Math.random() * 100000000); // Up to 100MB

      mockEvents.push({
        id: `event-${i}`,
        timestamp,
        type,
        fileId,
        fileName,
        filePath,
        fileSize,
        details: `File ${type} in ${path}`,
      });
    }

    return mockEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [timeRangeDays, path]);

  const generateMockStats = useCallback((events: TimelineEvent[]): TimelineStats => {
    const eventTypeBreakdown: Record<string, number> = {};
    const activityByHour: Record<number, number> = {};
    
    // Initialize counters
    ['created', 'modified', 'accessed', 'deleted'].forEach(type => {
      eventTypeBreakdown[type] = 0;
    });
    
    for (let hour = 0; hour < 24; hour++) {
      activityByHour[hour] = 0;
    }

    events.forEach(event => {
      eventTypeBreakdown[event.type]++;
      activityByHour[event.timestamp.getHours()]++;
    });

    const sortedBySize = [...events].sort((a, b) => b.fileSize - a.fileSize);
    
    return {
      totalEvents: events.length,
      filesCounted: new Set(events.map(e => e.fileId)).size,
      dateRange: {
        start: events[0]?.timestamp || new Date(),
        end: events[events.length - 1]?.timestamp || new Date(),
      },
      eventTypeBreakdown,
      activityByHour,
      largestFiles: sortedBySize.slice(0, 10),
    };
  }, []);

  // Load timeline data
  const loadTimelineData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockEvents = generateMockEvents();
      const mockStats = generateMockStats(mockEvents);
      
      setEvents(mockEvents);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load timeline data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [generateMockEvents, generateMockStats]);

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.startDate && event.timestamp < filters.startDate) return false;
      if (filters.endDate && event.timestamp > filters.endDate) return false;
      if (!filters.eventTypes.has(event.type)) return false;
      if (filters.minFileSize > 0 && event.fileSize < filters.minFileSize) return false;
      if (filters.maxFileSize > 0 && event.fileSize > filters.maxFileSize) return false;
      if (filters.pathPattern && !event.filePath.includes(filters.pathPattern)) return false;
      
      return true;
    });
  }, [events, filters]);

  // Timeline playback
  useEffect(() => {
    if (!isPlaying || filteredEvents.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTimeIndex(prev => {
        const next = prev + 1;
        if (next >= filteredEvents.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, filteredEvents.length]);

  // Load data when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      loadTimelineData();
    }
  }, [isVisible, loadTimelineData]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const getEventColor = (eventType: string) => {
    const colors = {
      created: 'bg-green-500',
      modified: 'bg-blue-500',
      accessed: 'bg-yellow-500',
      deleted: 'bg-red-500',
    };
    return colors[eventType as keyof typeof colors] || 'bg-gray-500';
  };

  const getEventIcon = (eventType: string) => {
    const icons = {
      created: '+',
      modified: '~',
      accessed: '○',
      deleted: '×',
    };
    return icons[eventType as keyof typeof icons] || '?';
  };

  const handlePlaybackToggle = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePlaybackReset = () => {
    setCurrentTimeIndex(0);
    setIsPlaying(false);
  };

  const handlePlaybackSkipToEnd = () => {
    setCurrentTimeIndex(filteredEvents.length - 1);
    setIsPlaying(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 bg-background border border-border rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">File System Timeline</h2>
              <p className="text-sm text-muted-foreground">
                Activity in {volumeId} • {path}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {([
                ['timeline', 'Timeline'],
                ['heatmap', 'Heatmap'],
                ['stats', 'Stats'],
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  className={cn(
                    'px-3 py-1 text-sm rounded',
                    currentView === view
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Playback Controls */}
            {currentView === 'timeline' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlaybackReset}
                  className="p-2 hover:bg-muted rounded"
                  title="Reset to start"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePlaybackToggle}
                  className="p-2 hover:bg-muted rounded"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handlePlaybackSkipToEnd}
                  className="p-2 hover:bg-muted rounded"
                  title="Skip to end"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded text-sm"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
            )}
          </div>

          {/* Filter Button */}
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1 border border-border rounded text-sm hover:bg-muted"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p>Loading timeline data...</p>
              </div>
            </div>
          )}

          {!isLoading && stats && (
            <>
              {currentView === 'timeline' && (
                <TimelineView
                  events={filteredEvents}
                  currentIndex={currentTimeIndex}
                  onEventClick={onFileClick}
                  formatFileSize={formatFileSize}
                  getEventColor={getEventColor}
                  getEventIcon={getEventIcon}
                />
              )}

              {currentView === 'heatmap' && (
                <HeatmapView
                  stats={stats}
                  events={filteredEvents}
                />
              )}

              {currentView === 'stats' && (
                <StatsView
                  stats={stats}
                  formatFileSize={formatFileSize}
                  onEventClick={onFileClick}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface TimelineViewProps {
  events: TimelineEvent[];
  currentIndex: number;
  onEventClick?: (event: TimelineEvent) => void;
  formatFileSize: (bytes: number) => string;
  getEventColor: (eventType: string) => string;
  getEventIcon: (eventType: string) => string;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  events,
  currentIndex,
  onEventClick,
  formatFileSize,
  getEventColor,
  getEventIcon,
}) => {
  const visibleEvents = events.slice(0, currentIndex + 1);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        {visibleEvents.map((event, index) => (
          <div
            key={event.id}
            className={cn(
              'flex items-start gap-4 p-3 rounded-lg border transition-all duration-300',
              index === currentIndex && 'ring-2 ring-primary bg-primary/5',
              onEventClick && 'cursor-pointer hover:bg-muted/50'
            )}
            onClick={() => onEventClick?.(event)}
          >
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold', getEventColor(event.type))}>
              {getEventIcon(event.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{event.fileName}</span>
                <span className="text-xs text-muted-foreground capitalize">{event.type}</span>
              </div>
              
              <div className="text-sm text-muted-foreground truncate">
                {event.filePath}
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{event.timestamp.toLocaleString()}</span>
                <span>{formatFileSize(event.fileSize)}</span>
              </div>
            </div>
          </div>
        ))}

        {visibleEvents.length === 0 && (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p>No events in the selected time range</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface HeatmapViewProps {
  stats: TimelineStats;
  events: TimelineEvent[];
}

const HeatmapView: React.FC<HeatmapViewProps> = ({ stats }) => {
  const maxActivity = Math.max(...Object.values(stats.activityByHour));
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Activity by Hour</h3>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 24 }, (_, hour) => {
              const activity = stats.activityByHour[hour] || 0;
              const intensity = activity / maxActivity;
              
              return (
                <div
                  key={hour}
                  className="aspect-square flex items-center justify-center text-xs border rounded"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                    color: intensity > 0.5 ? 'white' : 'inherit',
                  }}
                  title={`${hour}:00 - ${activity} events`}
                >
                  {hour}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Event Type Distribution</h3>
          <div className="space-y-2">
            {Object.entries(stats.eventTypeBreakdown).map(([type, count]) => {
              const percentage = (count / stats.totalEvents) * 100;
              
              return (
                <div key={type} className="flex items-center gap-4">
                  <span className="w-20 text-sm capitalize">{type}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-16 text-sm text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatsViewProps {
  stats: TimelineStats;
  formatFileSize: (bytes: number) => string;
  onEventClick?: (event: TimelineEvent) => void;
}

const StatsView: React.FC<StatsViewProps> = ({ stats, formatFileSize, onEventClick }) => {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-primary">{stats.totalEvents}</div>
            <div className="text-sm text-muted-foreground">Total Events</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-blue-500">{stats.filesCounted}</div>
            <div className="text-sm text-muted-foreground">Files Affected</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-green-500">
              {Math.round((stats.dateRange.end.getTime() - stats.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))}
            </div>
            <div className="text-sm text-muted-foreground">Days Analyzed</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-orange-500">
              {Math.round(stats.totalEvents / Math.max(1, (stats.dateRange.end.getTime() - stats.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)))}
            </div>
            <div className="text-sm text-muted-foreground">Events/Day</div>
          </div>
        </div>

        {/* Largest Files */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Largest Files in Timeline</h3>
          <div className="space-y-2">
            {stats.largestFiles.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className={cn(
                  'flex items-center justify-between p-3 border rounded-lg',
                  onEventClick && 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => onEventClick?.(event)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{event.fileName}</div>
                  <div className="text-sm text-muted-foreground truncate">{event.filePath}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatFileSize(event.fileSize)}</div>
                  <div className="text-sm text-muted-foreground capitalize">{event.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineOverlay;