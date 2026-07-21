'use client';
import { useI18n } from '@/contexts/I18nContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AttendanceToday {
  total: string;
  present_count: string;
  absent_count: string;
  late_count: string;
}

interface AttendanceTrendPoint {
  session_date: string;
  present_count: string;
  absent_count: string;
  late_count: string;
  total: string;
}

interface AttendanceOverviewProps {
  attendanceToday?: AttendanceToday;
  attendanceTrend?: AttendanceTrendPoint[];
}

// Today's attendance donut + 7-day trend bars — shared by the Dashboard (system/branch-scoped)
// and a single Branch's detail page (that branch's groups only).
export function AttendanceOverview({ attendanceToday, attendanceTrend }: AttendanceOverviewProps) {
  const { t } = useI18n();

  const presentN = parseInt(attendanceToday?.present_count || '0');
  const absentN = parseInt(attendanceToday?.absent_count || '0');
  const lateN = parseInt(attendanceToday?.late_count || '0');
  const totalN = parseInt(attendanceToday?.total || '0');
  const attendancePct = totalN > 0 ? Math.round(((presentN + lateN) / totalN) * 100) : 0;

  // Rang har bir elementga biriktirilgan — 0 qiymatlilar tushib qolganda ranglar surilib ketmaydi
  const pieData = [
    { name: t('dashboard.present'), value: presentN, color: '#22c55e' },
    { name: t('dashboard.absent'), value: absentN, color: '#ef4444' },
    { name: t('dashboard.late'), value: lateN, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const trendData = (attendanceTrend || []).map(d => ({
    date: new Date(d.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    present: parseInt(d.present_count),
    absent: parseInt(d.absent_count),
    late: parseInt(d.late_count),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Today's attendance – faqat diagramma va foiz, qo'shimcha katakchalar yo'q */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {t('dashboard.todayAttendance')}
        </h2>
        {totalN === 0 ? (
          <div className="flex items-center justify-center h-52 text-sm text-gray-400">
            No sessions today
          </div>
        ) : (
          <>
            {/* Doira — legenda recharts'dan tashqarida (HTML) chiziladi, matn ustma-ust tushmaydi */}
            <div className="relative">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, '']} />
                </PieChart>
              </ResponsiveContainer>
              {/* Davomat foizi — doira markazida */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{attendancePct}%</span>
                <span className="text-[10px] text-gray-400 mt-1">{t('dashboard.attendanceRate')}</span>
              </div>
            </div>
            {/* Legenda: soni bilan, joy yetmasa keyingi qatorga tartibli o'raladi */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
              {pieData.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  {d.name}
                  <span className="font-semibold text-gray-900 dark:text-white">{d.value}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Trend chart */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {t('dashboard.attendanceTrend')}
        </h2>
        {trendData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="present" name={t('dashboard.present')} fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name={t('dashboard.absent')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name={t('dashboard.late')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
