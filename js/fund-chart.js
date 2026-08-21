'use strict';

// ==================== State ====================
let allFunds = [];
let currentFundIndex = 0;
let currentType = null; // 'صدور' | 'ابطال' | 'آماری'
let currentRange = '1y';
let customStart = null;
let customEnd = null;
let chartInstance = null;

// ==================== DOM Elements ====================
const fundSelect = document.getElementById('fundSelect');
const typeButtons = document.getElementById('typeButtons');
const rangeButtons = document.getElementById('rangeButtons');
const customRangeRow = document.getElementById('customRangeRow');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyCustomRangeBtn = document.getElementById('applyCustomRange');
const chartEl = document.getElementById('chart');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');

// Info elements
const fundNameEl = document.getElementById('fundName');
const typeBadgeEl = document.getElementById('typeBadge');
const periodReturnEl = document.getElementById('periodReturn');
const startDateInfoEl = document.getElementById('startDateInfo');
const endDateInfoEl = document.getElementById('endDateInfo');
const updatedAtEl = document.getElementById('updatedAt');
const statsGridEl = document.getElementById('statsGrid');

// ==================== Date Utilities (Persian/Shamsi) ====================
function parseShamsi(str) {
    const parts = str.split('/').map(Number);
    return { year: parts[0], month: parts[1], day: parts[2] };
}

function compareShamsi(a, b) {
    // returns: -1 if a < b, 0 if equal, 1 if a > b
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return 0;
}

function shamsiToKey(str) {
    const p = parseShamsi(str);
    return p.year * 10000 + p.month * 100 + p.day;
}

function subtractMonthsShamsi(dateStr, months) {
    let { year, month, day } = parseShamsi(dateStr);
    month -= months;
    while (month <= 0) {
        month += 12;
        year--;
    }
    // Persian month lengths
    let maxDay = month <= 6 ? 31 : (month <= 11 ? 30 : (year % 33 === 1 || year % 33 === 5 || year % 33 === 9 || year % 33 === 13 || year % 33 === 17 || year % 33 === 22 || year % 33 === 26 || year % 33 === 30 ? 30 : 29));
    if (day > maxDay) day = maxDay;
    return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function findClosestDate(trendData, targetDateStr) {
    if (!trendData || trendData.length === 0) return null;
    const targetKey = shamsiToKey(targetDateStr);
    let closest = trendData[0];
    let minDiff = Infinity;
    for (const item of trendData) {
        const diff = Math.abs(shamsiToKey(item.x) - targetKey);
        if (diff < minDiff) {
            minDiff = diff;
            closest = item;
        }
    }
    return closest;
}

// ==================== Fetch Data ====================
async function loadFunds() {
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    try {
        const res = await fetch('./funds.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || !Array.isArray(data.funds) || data.funds.length === 0) {
            throw new Error('داده‌ای یافت نشد');
        }
        allFunds = data.funds;
        initControls();
        renderAll();
    } catch (err) {
        console.error(err);
        errorEl.textContent = 'خطا در بارگذاری funds.json';
        errorEl.style.display = 'block';
    } finally {
        loadingEl.style.display = 'none';
    }
}

// ==================== Initialize Controls ====================
function initControls() {
    // Populate fund select
    fundSelect.innerHTML = '';
    allFunds.forEach((fundData, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = fundData.fund.name;
        fundSelect.appendChild(opt);
    });
    
    fundSelect.addEventListener('change', () => {
        currentFundIndex = parseInt(fundSelect.value);
        currentType = null; // Reset type
        renderAll();
    });
    
    // Range buttons
    rangeButtons.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.dataset.range;
            setRange(range);
        });
    });
    
    // Custom range
    applyCustomRangeBtn.addEventListener('click', applyCustomRange);
}

function setRange(range) {
    currentRange = range;
    
    // Update active state
    rangeButtons.querySelectorAll('.btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });
    
    // Show/hide custom range inputs
    if (range === 'custom') {
        customRangeRow.style.display = 'flex';
    } else {
        customRangeRow.style.display = 'none';
        renderAll();
    }
}

function applyCustomRange() {
    const startStr = startDateInput.value.trim();
    const endStr = endDateInput.value.trim();
    
    if (!startStr || !endStr) {
        alert('لطفاً هر دو تاریخ را وارد کنید');
        return;
    }
    
    // Validate format
    const pattern = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!pattern.test(startStr) || !pattern.test(endStr)) {
        alert('فرمت تاریخ باید YYYY/MM/DD باشد');
        return;
    }
    
    if (shamsiToKey(startStr) > shamsiToKey(endStr)) {
        alert('تاریخ شروع باید قبل از تاریخ پایان باشد');
        return;
    }
    
    customStart = startStr;
    customEnd = endStr;
    renderAll();
}

// ==================== Render All ====================
function renderAll() {
    const fundData = allFunds[currentFundIndex];
    if (!fundData) return;
    
    // Get available types for this fund
    const availableTypes = Object.keys(fundData.returns);
    
    // If current type is invalid, set to first available
    if (!currentType || !availableTypes.includes(currentType)) {
        currentType = availableTypes[0];
    }
    
    // Render type buttons
    renderTypeButtons(availableTypes);
    
    // Render info
    renderInfo(fundData);
    
    // Render chart
    renderChart(fundData);
}

function renderTypeButtons(availableTypes) {
    typeButtons.innerHTML = '';
    availableTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = type;
        btn.dataset.type = type;
        if (type === currentType) btn.classList.add('active');
        btn.addEventListener('click', () => {
            currentType = type;
            renderAll();
        });
        typeButtons.appendChild(btn);
    });
}

function renderInfo(fundData) {
    const returnsData = fundData.returns[currentType];
    if (!returnsData) return;
    
    fundNameEl.textContent = fundData.fund.name;
    typeBadgeEl.textContent = currentType;
    
    // Updated at
    if (fundData.updated_at) {
        updatedAtEl.textContent = new Date(fundData.updated_at).toLocaleDateString('fa-IR');
    } else {
        updatedAtEl.textContent = '-';
    }
    
    // Stats cards (monthly, three_months, six_months, nine_months, yearly)
    const stats = [
        { label: 'یک ماهه', value: returnsData.monthly },
        { label: 'سه ماهه', value: returnsData.three_months },
        { label: 'شش ماهه', value: returnsData.six_months },
        { label: 'نه ماهه', value: returnsData.nine_months },
        { label: 'یک ساله', value: returnsData.yearly }
    ];
    
    statsGridEl.innerHTML = stats.map(s => `
        <div class="stat-card">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value">${s.value !== null && s.value !== undefined ? s.value.toFixed(2) + '%' : '-'}</div>
        </div>
    `).join('');
}

// ==================== Chart ====================
function renderChart(fundData) {
    const returnsData = fundData.returns[currentType];
    if (!returnsData || !returnsData.daily_trend || returnsData.daily_trend.length === 0) {
        if (chartInstance) {
            chartInstance.clear();
        }
        errorEl.textContent = 'داده‌ای برای نمودار موجود نیست';
        errorEl.style.display = 'block';
        return;
    }
    
    errorEl.style.display = 'none';
    
    // Sort by date
    const sortedTrend = [...returnsData.daily_trend].sort((a, b) => 
        shamsiToKey(a.x) - shamsiToKey(b.x)
    );
    
    // Filter by range
    let filteredTrend = sortedTrend;
    
    if (currentRange === 'custom' && customStart && customEnd) {
        const startKey = shamsiToKey(customStart);
        const endKey = shamsiToKey(customEnd);
        filteredTrend = sortedTrend.filter(item => {
            const key = shamsiToKey(item.x);
            return key >= startKey && key <= endKey;
        });
    } else if (currentRange !== 'all' && sortedTrend.length > 0) {
        const monthsMap = { '1m': 1, '3m': 3, '6m': 6, '9m': 9, '1y': 12 };
        const months = monthsMap[currentRange];
        if (months) {
            const latestDate = sortedTrend[sortedTrend.length - 1].x;
            const cutoffDate = subtractMonthsShamsi(latestDate, months);
            const cutoffKey = shamsiToKey(cutoffDate);
            filteredTrend = sortedTrend.filter(item => shamsiToKey(item.x) >= cutoffKey);
        }
    }
    
    if (filteredTrend.length === 0) {
        errorEl.textContent = 'داده‌ای در این بازه یافت نشد';
        errorEl.style.display = 'block';
        return;
    }
    
    // Update info
    const firstPoint = filteredTrend[0];
    const lastPoint = filteredTrend[filteredTrend.length - 1];
    
    startDateInfoEl.textContent = firstPoint.x;
    endDateInfoEl.textContent = lastPoint.x;
    
    // Calculate period return using compound formula
    const rStart = firstPoint.y;
    const rEnd = lastPoint.y;
    if (rStart !== null && rEnd !== null && rStart !== undefined && rEnd !== undefined) {
        const periodReturn = ((1 + rEnd / 100) / (1 + rStart / 100) - 1) * 100;
        periodReturnEl.textContent = periodReturn.toFixed(2) + '%';
        periodReturnEl.style.color = periodReturn >= 0 ? '#10b981' : '#ef4444';
    } else {
        periodReturnEl.textContent = '-';
    }
    
    // Prepare chart data
    const dates = filteredTrend.map(item => item.x);
    const values = filteredTrend.map(item => item.y);
    
    // Short date labels for x-axis
    const shortDates = dates.map(d => {
        const p = d.split('/');
        return `${p[1]}/${p[2]}`;
    });
    
    // Init or update chart
    if (!chartInstance) {
        chartInstance = echarts.init(chartEl);
    }
    
    const option = {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: '#2a5298',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#333', fontFamily: 'Vazir, IRANSans, Tahoma' },
            formatter: function(params) {
                const p = params[0];
                return `<div style="direction:rtl;text-align:right;">
                    <strong>${p.name}</strong><br/>
                    بازدهی: <strong>${p.value.toFixed(2)}%</strong>
                </div>`;
            }
        },
        grid: {
            left: '5%',
            right: '5%',
            bottom: '10%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: shortDates,
            boundaryGap: false,
            axisLabel: {
                fontSize: 10,
                color: '#666',
                fontFamily: 'Vazir, IRANSans, Tahoma',
                interval: 'auto',
                rotate: 30
            },
            axisLine: { lineStyle: { color: '#ccc' } }
        },
        yAxis: {
            type: 'value',
            name: 'بازدهی (%)',
            nameTextStyle: { fontFamily: 'Vazir, IRANSans, Tahoma', fontSize: 11 },
            axisLabel: {
                fontSize: 10,
                color: '#666',
                fontFamily: 'Vazir, IRANSans, Tahoma',
                formatter: '{value}%'
            },
            splitLine: {
                lineStyle: { color: '#eee', type: 'dashed' }
            }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { 
                type: 'slider', 
                start: 0, 
                end: 100,
                height: 20,
                bottom: 5,
                borderColor: '#ddd',
                fillerColor: 'rgba(42,82,152,0.15)',
                handleStyle: { color: '#2a5298' },
                textStyle: { fontSize: 9, fontFamily: 'Vazir, IRANSans, Tahoma' }
            }
        ],
        series: [{
            name: `بازدهی ${currentType}`,
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'circle',
            symbolSize: 3,
            showSymbol: false,
            lineStyle: {
                width: 2.5,
                color: '#2a5298'
            },
            itemStyle: {
                color: '#2a5298',
                borderColor: '#fff',
                borderWidth: 1
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(42,82,152,0.25)' },
                        { offset: 1, color: 'rgba(42,82,152,0.02)' }
                    ]
                }
            },
            emphasis: {
                focus: 'series',
                lineStyle: { width: 3.5 }
            },
            animationDuration: 800,
            animationEasing: 'cubicOut'
        }]
    };
    
    chartInstance.setOption(option, true);
    chartInstance.resize();
}

// ==================== Handle Window Resize ====================
window.addEventListener('resize', () => {
    if (chartInstance) {
        chartInstance.resize();
    }
});

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', loadFunds);
