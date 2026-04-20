import dayjs from 'dayjs';
import { PERIOD_TYPES } from '@shared/constants/business';
import type { PeriodInfo, PeriodType } from '@shared/types';

function withYear(month: number, day: number, baseYear: number) {
  return dayjs(`${baseYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

export class PeriodParserService {
  static parse(label: string, importedAt = new Date()): PeriodInfo {
    const cleanLabel = label.trim();
    const normalizedLabel = cleanLabel
      .replace(/^退货分析/, '')
      .replace(/新品数据$/, '')
      .replace(/新品近30天数据$/, '近30天')
      .replace(/整月新品数据$/, '月整月')
      .trim();
    const baseYear = dayjs(importedAt).year();

    if (/近\s*30\s*天/.test(normalizedLabel)) {
      const end = dayjs(importedAt);
      const start = end.subtract(29, 'day');
      return {
        periodLabel: '近30天',
        periodStart: start.format('YYYY-MM-DD'),
        periodEnd: end.format('YYYY-MM-DD'),
        periodType: PERIOD_TYPES.rolling30d
      };
    }

    const monthMatch = normalizedLabel.match(/(\d{1,2})月整月/);
    if (monthMatch) {
      const month = Number(monthMatch[1]);
      const start = dayjs(`${baseYear}-${String(month).padStart(2, '0')}-01`);
      return {
        periodLabel: `${month}月整月`,
        periodStart: start.startOf('month').format('YYYY-MM-DD'),
        periodEnd: start.endOf('month').format('YYYY-MM-DD'),
        periodType: PERIOD_TYPES.monthly
      };
    }

    const rangeMatch = normalizedLabel.match(/(\d{1,2})\.(\d{1,2})\s*-\s*(\d{1,2})\.(\d{1,2})/);
    if (rangeMatch) {
      const startMonth = Number(rangeMatch[1]);
      const startDay = Number(rangeMatch[2]);
      const endMonth = Number(rangeMatch[3]);
      const endDay = Number(rangeMatch[4]);
      let start = withYear(startMonth, startDay, baseYear);
      let end = withYear(endMonth, endDay, baseYear);
      if (end.isBefore(start)) {
        start = start.subtract(1, 'year');
      }
      const diff = end.diff(start, 'day');
      const type: PeriodType = diff <= 7 ? PERIOD_TYPES.weeklyExact : PERIOD_TYPES.rangeExact;
      return {
        periodLabel: `${startMonth}.${startDay}-${endMonth}.${endDay}`,
        periodStart: start.format('YYYY-MM-DD'),
        periodEnd: end.format('YYYY-MM-DD'),
        periodType: type
      };
    }

    return {
      periodLabel: normalizedLabel,
      periodStart: null,
      periodEnd: null,
      periodType: PERIOD_TYPES.unknown
    };
  }
}
