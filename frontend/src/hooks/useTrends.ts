/**
 * Trends data hooks
 *
 * Wraps the real /api/v1/trends endpoints. TrendsPage shows either a single
 * volume's detailed trends (file types, capacity forecast - both inherently
 * per-volume concepts) or an all-volumes growth summary, depending on
 * whether a volumeId is selected.
 */

import {
  useGetApiV1TrendsSummary,
  useGetApiV1TrendsVolumesVolumeId,
} from '@/api/orval-generated/api';
import type { TrendFilters } from '@/pages/TrendsPage/TrendsPage.types';

const TIME_RANGE_TO_DAYS: Record<TrendFilters['timeRange'], number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  all: 365,
};

export const useTrends = (volumeId: string | undefined, filters: TrendFilters) => {
  const days = TIME_RANGE_TO_DAYS[filters.timeRange];

  const volumeQuery = useGetApiV1TrendsVolumesVolumeId(
    volumeId ?? '',
    { days, aggregation: filters.aggregation === 'hour' ? 'day' : filters.aggregation },
    { query: { enabled: !!volumeId } },
  );

  const summaryQuery = useGetApiV1TrendsSummary();

  const volumeData =
    volumeQuery.data?.status === 200 ? volumeQuery.data.data : undefined;
  const summaryData =
    summaryQuery.data?.status === 200 ? summaryQuery.data.data : undefined;

  return {
    volumeTrends: volumeData,
    allVolumesSummary: summaryData,
    isLoading: volumeQuery.isLoading || summaryQuery.isLoading,
    error: volumeQuery.error ?? summaryQuery.error,
    refresh: () => {
      volumeQuery.refetch();
      summaryQuery.refetch();
    },
  };
};
